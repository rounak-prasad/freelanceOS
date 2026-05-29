/**
 * /api/auth — registration, login, and session identity.
 *
 *   POST /register  { email, password, name?, workspaceName? }
 *                   → creates user + default workspace + owner membership
 *   POST /login     { email, password }  → { token, user, workspaces }
 *   GET  /me        (Bearer)             → { user, workspaces }
 *
 * Tokens are HS256 JWTs carrying { sub, email, wsid }. The wsid is the user's
 * default (owner) workspace; the client can switch with the X-Workspace-Id header.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { hashPassword, verifyPassword, signJwt } from '../lib/auth.js';
import { requireAuth, jwtSecret } from '../lib/authMiddleware.js';
import { asyncHandler, requireFields, isEmail, bad, HttpError } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import * as repo from '../db/repos.js';

const router = Router();
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

router.post('/register', asyncHandler((req, res) => {
  const db = getDb();
  const { email, password, name, workspaceName } = req.body || {};
  requireFields(req.body || {}, ['email', 'password']);
  if (!isEmail(email)) bad('Please enter a valid email address');
  if (String(password).length < 8) bad('Password must be at least 8 characters');
  if (repo.findUserByEmail(db, email)) bad('An account with this email already exists');

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
  db.tx((tx) => {
    repo.insertUser(tx, user);
    repo.insertWorkspace(tx, ws);
    repo.insertMembership(tx, { id: crypto.randomUUID(), workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now });
    repo.ensureAppState(tx, ws.id);
  });
  writeAudit(db, { workspaceId: ws.id, userId: user.id, action: 'auth.register', ip: req.ip });

  const token = signJwt({ sub: user.id, email: user.email, wsid: ws.id }, jwtSecret());
  res.status(201).json({ token, user: publicUser(user), workspaces: [{ id: ws.id, name: ws.name, role: 'owner' }] });
}));

router.post('/login', asyncHandler((req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['email', 'password']);
  const u = repo.findUserByEmail(db, req.body.email);
  if (!u || !verifyPassword(req.body.password, u.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const workspaces = repo.listWorkspacesForUser(db, u.id);
  const token = signJwt({ sub: u.id, email: u.email, wsid: workspaces[0]?.id }, jwtSecret());
  writeAudit(db, { workspaceId: workspaces[0]?.id, userId: u.id, action: 'auth.login', ip: req.ip });
  res.json({ token, user: publicUser(u), workspaces });
}));

router.get('/me', requireAuth, asyncHandler((req, res) => {
  const db = getDb();
  const u = repo.findUserById(db, req.auth.userId);
  if (!u) throw new HttpError(401, 'User not found');
  res.json({ user: publicUser(u), workspaces: repo.listWorkspacesForUser(db, u.id) });
}));

export default router;
