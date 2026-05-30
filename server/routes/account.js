/**
 * /api/account — the user's own account: DPDP/GDPR data portability + erasure.
 *
 *   GET  /export   right to access — the user + all their workspaces' data as JSON
 *   POST /delete   right to erasure — password-confirmed hard delete of the account
 *
 * Erasure cascades: workspaces the user OWNS (and all their data) are deleted;
 * memberships in workspaces owned by others are removed, leaving those intact.
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../lib/authMiddleware.js';
import { asyncHandler, requireFields, HttpError } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { verifyPassword } from '../lib/auth.js';
import * as repo from '../db/repos.js';
import { exportWorkspace } from '../lib/backup.js';

const router = Router();
router.use(requireAuth);

router.get('/export', asyncHandler(async (req, res) => {
  const db = getDb();
  const user = await repo.findUserById(db, req.auth.userId);
  if (!user) throw new HttpError(401, 'User not found');
  const memberships = await repo.listWorkspacesForUser(db, user.id);
  const workspaces = [];
  for (const m of memberships) workspaces.push({ role: m.role, data: await exportWorkspace(db, m.id) });
  await writeAudit(db, { userId: user.id, action: 'account.export', ip: req.ip });
  res.json({
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email, name: user.name, emailVerified: !!user.email_verified, createdAt: user.created_at },
    workspaces,
  });
}));

router.post('/delete', asyncHandler(async (req, res) => {
  const db = getDb();
  requireFields(req.body || {}, ['password']);
  const user = await repo.findUserById(db, req.auth.userId);
  if (!user || !verifyPassword(req.body.password, user.password_hash)) {
    throw new HttpError(401, 'Password is incorrect');
  }
  await repo.revokeAllRefreshTokensForUser(db, user.id);
  // Audit BEFORE deletion (audit_log has no user FK, so the record persists).
  await writeAudit(db, { userId: user.id, action: 'account.erasure', ip: req.ip, meta: { email: user.email } });
  await repo.deleteUser(db, user.id);
  res.json({ ok: true, deleted: true });
}));

export default router;
