/**
 * /api/admin — workspace administration (owner/admin), behind requireAuth +
 * resolveWorkspace so everything is tenant-scoped.
 *
 *   GET  /audit     paginated audit-log entries (owner/admin)
 *   GET  /backup    full workspace backup JSON (owner)
 *   POST /restore   restore the workspace from a backup (owner; replaces data)
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, resolveWorkspace, requireRole } from '../lib/authMiddleware.js';
import { asyncHandler, HttpError } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import * as repo from '../db/repos.js';
import { exportWorkspace, restoreWorkspace } from '../lib/backup.js';

const router = Router();
router.use(requireAuth, resolveWorkspace);

const safeJson = (s) => { try { return JSON.parse(s); } catch { return s; } };

router.get('/audit', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Number(req.query.limit) || 100;
  const offset = Number(req.query.offset) || 0;
  const rows = await repo.listAuditLog(db, req.workspaceId, { limit, offset, action: req.query.action || null });
  res.json({
    total: await repo.countAuditLog(db, req.workspaceId),
    limit, offset,
    entries: rows.map((r) => ({ ...r, meta: r.meta ? safeJson(r.meta) : null })),
  });
}));

router.get('/backup', requireRole('owner'), asyncHandler(async (req, res) => {
  const backup = await exportWorkspace(getDb(), req.workspaceId);
  await writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'backup.export', ip: req.ip });
  res.json(backup);
}));

router.post('/restore', requireRole('owner'), asyncHandler(async (req, res) => {
  const backup = req.body?.backup;
  if (!backup) throw new HttpError(400, 'Provide { backup } from a prior export');
  const result = await restoreWorkspace(getDb(), req.workspaceId, backup, { mode: req.body?.mode || 'replace' });
  await writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'backup.restore', ip: req.ip, meta: result.restored });
  res.json({ ok: true, ...result });
}));

export default router;
