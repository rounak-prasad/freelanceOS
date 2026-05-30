/**
 * /api/auth — registration, login, session identity, and account security.
 *
 *   POST /register        { email, password, name?, workspaceName? }
 *                         → user + default workspace + owner membership
 *   POST /login           { email, password }            → { token, refreshToken, user, workspaces }
 *   GET  /me              (Bearer)                        → { user, workspaces }
 *   POST /refresh         { refreshToken }                → rotated { token, refreshToken }
 *   POST /logout          { refreshToken }                → revoke a refresh token
 *   POST /verify/request  (Bearer)                        → email a verification link
 *   POST /verify/confirm  { token }                       → mark email verified
 *   POST /password/forgot { email }                       → email a reset link (no enumeration)
 *   POST /password/reset  { token, password }             → set new password, revoke sessions
 *
 * Access tokens are short-ish HS256 JWTs carrying { sub, email, wsid }. Refresh
 * tokens are opaque, single-use, rotating, and stored only as a SHA-256 hash.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { hashPassword, verifyPassword, signJwt, sha256, randomToken } from '../lib/auth.js';
import { requireAuth, jwtSecret } from '../lib/authMiddleware.js';
import { asyncHandler, requireFields, isEmail, bad, HttpError } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { sendMail, verifyEmailLink, resetPasswordLink } from '../lib/mailer.js';
import * as repo from '../db/repos.js';

const router = Router();
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, emailVerified: !!u.email_verified });

const ACCESS_TTL = 60 * 60 * 2;          // 2h access token
const REFRESH_TTL_DAYS = 30;             // 30d rotating refresh token
const inDev = () => process.env.NODE_ENV !== 'production';

/** Mint an access JWT + a fresh rotating refresh token (hash persisted). */
async function issueSession(db, user, wsid) {
  const token = signJwt({ sub: user.id, email: user.email, wsid }, jwtSecret(), ACCESS_TTL);
  const refreshRaw = randomToken();
  await repo.createRefreshToken(db, { userId: user.id, tokenHash: sha256(refreshRaw), ttlDays: REFRESH_TTL_DAYS });
  return { token, refreshToken: refreshRaw };
}

/** Create + email an email-verification token. Returns the raw token (dev only). */
async function sendVerificationEmail(db, user) {
  const raw = randomToken();
  await repo.createEmailToken(db, { userId: user.id, kind: 'verify', tokenHash: sha256(raw), ttlHours: 48 });
  await sendMail({
    to: user.email,
    subject: 'Verify your FreelanceOS email',
    text: `Welcome to FreelanceOS! Confirm your email to secure your account:\n\n${verifyEmailLink(raw)}\n\nThis link expires in 48 hours.`,
  });
  return raw;
}

router.post('/register', asyncHandler(async (req, res) => {
  const db = getDb();
  const { email, password, name, workspaceName } = req.body || {};
  requireFields(req.body || {}, ['email', 'password']);
  if (!isEmail(email)) bad('Please enter a valid email address');
  if (String(password).length < 8) bad('Password must be at least 8 characters');
  if (await repo.findUserByEmail(db, email)) bad('An account with this email already exists');

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(), email: String(email).toLowerCase(),
    password_hash: hashPassword(password), name: name || null, created_at: now, updated_at: now,
  };
  const ws = {
    id: crypto.randomUUID(),
    name: workspaceName || (name ? `${name}'s Workspace` : 'My Workspace'),
    owner_user_id: user.id,
  };
  await db.tx(async (tx) => {
    await repo.insertUser(tx, user);
    await repo.insertWorkspace(tx, ws);
    await repo.insertMembership(tx, { id: crypto.randomUUID(), workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now });
    await repo.ensureAppState(tx, ws.id);
  });
  writeAudit(db, { workspaceId: ws.id, userId: user.id, action: 'auth.register', ip: req.ip });

  const session = await issueSession(db, user, ws.id);
  const verifyToken = await sendVerificationEmail(db, user);
  res.status(201).json({
    ...session,
    user: { ...publicUser(user), emailVerified: false },
    workspaces: [{ id: ws.id, name: ws.name, role: 'owner' }],
    ...(inDev() ? { verifyToken } : {}),
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['email', 'password']);
  const u = await repo.findUserByEmail(db, req.body.email);
  if (!u || !verifyPassword(req.body.password, u.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const workspaces = await repo.listWorkspacesForUser(db, u.id);
  const session = await issueSession(db, u, workspaces[0]?.id);
  writeAudit(db, { workspaceId: workspaces[0]?.id, userId: u.id, action: 'auth.login', ip: req.ip });
  res.json({ ...session, user: publicUser(u), workspaces });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const db = getDb();
  const u = await repo.findUserById(db, req.auth.userId);
  if (!u) throw new HttpError(401, 'User not found');
  res.json({ user: publicUser(u), workspaces: await repo.listWorkspacesForUser(db, u.id) });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['refreshToken']);
  const oldHash = sha256(String(req.body.refreshToken));
  const newRaw = randomToken();
  const r = await repo.rotateRefreshToken(db, { oldHash, newHash: sha256(newRaw), ttlDays: REFRESH_TTL_DAYS });
  if (r.error) {
    // A reused (already-rotated) token is a theft signal: revoke the whole family.
    if (r.error === 'revoked' && r.userId) await repo.revokeAllRefreshTokensForUser(db, r.userId);
    throw new HttpError(401, 'Invalid or expired refresh token — please sign in again');
  }
  const u = await repo.findUserById(db, r.userId);
  if (!u) throw new HttpError(401, 'User not found');
  const wsid = (await repo.listWorkspacesForUser(db, u.id))[0]?.id;
  const token = signJwt({ sub: u.id, email: u.email, wsid }, jwtSecret(), ACCESS_TTL);
  res.json({ token, refreshToken: newRaw, user: publicUser(u) });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const db = getDb();
  if (req.body?.refreshToken) await repo.revokeRefreshToken(db, sha256(String(req.body.refreshToken)));
  res.json({ ok: true });
}));

router.post('/verify/request', requireAuth, asyncHandler(async (req, res) => {
  const db = getDb();
  const u = await repo.findUserById(db, req.auth.userId);
  if (!u) throw new HttpError(401, 'User not found');
  if (u.email_verified) return res.json({ ok: true, alreadyVerified: true });
  const raw = await sendVerificationEmail(db, u);
  res.json({ ok: true, ...(inDev() ? { verifyToken: raw } : {}) });
}));

router.post('/verify/confirm', asyncHandler(async (req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['token']);
  const row = await repo.consumeEmailToken(db, { tokenHash: sha256(String(req.body.token)), kind: 'verify' });
  if (!row) throw new HttpError(400, 'This verification link is invalid or has expired');
  await repo.setEmailVerified(db, row.user_id, 1);
  writeAudit(db, { userId: row.user_id, action: 'auth.email_verified', ip: req.ip });
  res.json({ ok: true });
}));

router.post('/password/forgot', asyncHandler(async (req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['email']);
  const u = await repo.findUserByEmail(db, req.body.email);
  // Always 200 — never reveal whether an email is registered.
  if (u) {
    const raw = randomToken();
    await repo.createEmailToken(db, { userId: u.id, kind: 'reset', tokenHash: sha256(raw), ttlHours: 1 });
    await sendMail({
      to: u.email,
      subject: 'Reset your FreelanceOS password',
      text: `We received a request to reset your password. If this was you:\n\n${resetPasswordLink(raw)}\n\nThis link expires in 1 hour. If it wasn't you, you can ignore this email.`,
    });
    writeAudit(db, { userId: u.id, action: 'auth.password_forgot', ip: req.ip });
    if (inDev()) return res.json({ ok: true, resetToken: raw });
  }
  res.json({ ok: true });
}));

router.post('/password/reset', asyncHandler(async (req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['token', 'password']);
  if (String(req.body.password).length < 8) bad('Password must be at least 8 characters');
  const row = await repo.consumeEmailToken(db, { tokenHash: sha256(String(req.body.token)), kind: 'reset' });
  if (!row) throw new HttpError(400, 'This reset link is invalid or has expired');
  await repo.updateUserPassword(db, row.user_id, hashPassword(req.body.password));
  await repo.revokeAllRefreshTokensForUser(db, row.user_id); // sign out everywhere
  writeAudit(db, { userId: row.user_id, action: 'auth.password_reset', ip: req.ip });
  res.json({ ok: true });
}));

export default router;
