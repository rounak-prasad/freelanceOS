/**
 * /api/team — workspace membership + invitations (the Teams pillar).
 *
 *   GET    /members             list teammates (any member)
 *   PATCH  /members/:userId     change a role (owner/admin)
 *   DELETE /members/:userId     remove a member (owner/admin; last owner protected)
 *   GET    /invitations         list invites (owner/admin)
 *   POST   /invitations         invite by email (owner/admin; counts toward plan seats)
 *   DELETE /invitations/:id     revoke a pending invite (owner/admin)
 *
 * Invitation acceptance lives on a SEPARATE router (acceptRouter) that needs
 * only authentication — the invitee is not yet a member, so resolveWorkspace
 * (which requires membership) must not gate it.
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, resolveWorkspace, requireRole } from '../lib/authMiddleware.js';
import { asyncHandler, requireFields, isEmail, bad, notFound, HttpError } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { enforceLimit } from '../lib/entitlements.js';
import { sha256, randomToken } from '../lib/auth.js';
import { sendMail, inviteLink } from '../lib/mailer.js';
import * as repo from '../db/repos.js';

const router = Router();
const ASSIGNABLE_ROLES = ['admin', 'member', 'viewer']; // 'owner' is special-cased below

router.use(requireAuth, resolveWorkspace);

router.get('/members', asyncHandler((req, res) => {
  res.json(repo.listMembers(getDb(), req.workspaceId));
}));

router.patch('/members/:userId', requireRole('owner', 'admin'), asyncHandler((req, res) => {
  const role = String(req.body?.role || '');
  if (role !== 'owner' && !ASSIGNABLE_ROLES.includes(role)) {
    bad(`Role must be one of: owner, ${ASSIGNABLE_ROLES.join(', ')}`);
  }
  if (role === 'owner' && req.role !== 'owner') throw new HttpError(403, 'Only an owner can grant the owner role');
  const m = repo.updateMemberRole(getDb(), req.workspaceId, req.params.userId, role);
  if (!m) notFound('Member not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'member.role_change', entityType: 'membership', entityId: req.params.userId, ip: req.ip, meta: { role } });
  res.json(m);
}));

router.delete('/members/:userId', requireRole('owner', 'admin'), asyncHandler((req, res) => {
  const ok = repo.removeMember(getDb(), req.workspaceId, req.params.userId);
  if (!ok) notFound('Member not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'member.remove', entityType: 'membership', entityId: req.params.userId, ip: req.ip });
  res.json({ ok: true });
}));

router.get('/invitations', requireRole('owner', 'admin'), asyncHandler((req, res) => {
  res.json(repo.listInvitations(getDb(), req.workspaceId));
}));

router.post('/invitations', requireRole('owner', 'admin'), enforceLimit('members'), asyncHandler(async (req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['email']);
  const email = String(req.body.email).toLowerCase();
  if (!isEmail(email)) bad('Please enter a valid email address');
  const role = ASSIGNABLE_ROLES.includes(req.body.role) ? req.body.role : 'member';

  const existingUser = repo.findUserByEmail(db, email);
  if (existingUser && repo.getMembership(db, req.workspaceId, existingUser.id)) {
    bad('That person is already a member of this workspace');
  }
  // One active invite per email: replace any prior pending one.
  const pending = repo.findPendingInvitation(db, req.workspaceId, email);
  if (pending) repo.revokeInvitation(db, req.workspaceId, pending.id);

  const raw = randomToken();
  const inv = repo.createInvitation(db, req.workspaceId, { email, role, tokenHash: sha256(raw), invitedBy: req.auth.userId });
  const link = inviteLink(raw);
  await sendMail({
    to: email,
    subject: 'You have been invited to a FreelanceOS workspace',
    text: `You've been invited to join a workspace on FreelanceOS as "${role}".\n\nAccept the invite:\n${link}\n\nThis link expires in 7 days.`,
  });
  writeAudit(db, { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'invite.create', entityType: 'invitation', entityId: inv.id, ip: req.ip, meta: { email, role } });

  // Surface the raw link only outside production so it can be tested without a
  // configured mail provider. In production the link only goes by email.
  const inviteLinkForDev = process.env.NODE_ENV === 'production' ? undefined : link;
  res.status(201).json({ id: inv.id, email: inv.email, role: inv.role, status: inv.status, expiresAt: inv.expires_at, inviteLink: inviteLinkForDev });
}));

router.delete('/invitations/:id', requireRole('owner', 'admin'), asyncHandler((req, res) => {
  const ok = repo.revokeInvitation(getDb(), req.workspaceId, req.params.id);
  if (!ok) notFound('Pending invitation not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'invite.revoke', entityType: 'invitation', entityId: req.params.id, ip: req.ip });
  res.json({ ok: true });
}));

/* ── acceptance (auth only — invitee is not yet a member) ── */
export const acceptRouter = Router();
acceptRouter.post('/accept', requireAuth, asyncHandler((req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['token']);
  const me = repo.findUserById(db, req.auth.userId);
  const result = repo.acceptInvitation(db, {
    tokenHash: sha256(String(req.body.token)),
    userId: req.auth.userId,
    userEmail: me?.email,
  });
  writeAudit(db, { workspaceId: result.workspaceId, userId: req.auth.userId, action: 'invite.accept', entityType: 'workspace', entityId: result.workspaceId, ip: req.ip, meta: { role: result.role } });
  res.json({ ok: true, workspaceId: result.workspaceId, role: result.role, alreadyMember: result.alreadyMember });
}));

export default router;
