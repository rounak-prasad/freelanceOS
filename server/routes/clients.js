/**
 * /api/clients — tenant-scoped CRUD. Every handler runs behind
 * requireAuth + resolveWorkspace, so repo calls are scoped to req.workspaceId
 * and one user can never read or mutate another tenant's clients. Mutations
 * require a writer role and respect the plan's client limit.
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, resolveWorkspace, requireRole } from '../lib/authMiddleware.js';
import { asyncHandler, requireFields, notFound } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import { enforceLimit } from '../lib/entitlements.js';
import * as repo from '../db/repos.js';

const router = Router();
router.use(requireAuth, resolveWorkspace);

// Roles allowed to mutate business data (viewers are read-only).
const CAN_WRITE = ['owner', 'admin', 'member'];

router.get('/', asyncHandler(async (req, res) => {
  res.json(await repo.listClients(getDb(), req.workspaceId));
}));

router.post('/', requireRole(...CAN_WRITE), enforceLimit('clients'), asyncHandler(async (req, res) => {
  requireFields(req.body || {}, ['name']);
  const c = await repo.createClient(getDb(), req.workspaceId, req.body);
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'client.create', entityType: 'client', entityId: c.id, ip: req.ip });
  res.status(201).json(c);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const c = await repo.getClient(getDb(), req.workspaceId, req.params.id);
  if (!c) notFound('Client not found');
  res.json(c);
}));

router.patch('/:id', requireRole(...CAN_WRITE), asyncHandler(async (req, res) => {
  const c = await repo.updateClient(getDb(), req.workspaceId, req.params.id, req.body || {});
  if (!c) notFound('Client not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'client.update', entityType: 'client', entityId: c.id, ip: req.ip });
  res.json(c);
}));

router.delete('/:id', requireRole(...CAN_WRITE), asyncHandler(async (req, res) => {
  const ok = await repo.deleteClient(getDb(), req.workspaceId, req.params.id);
  if (!ok) notFound('Client not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'client.delete', entityType: 'client', entityId: req.params.id, ip: req.ip });
  res.json({ ok: true });
}));

export default router;
