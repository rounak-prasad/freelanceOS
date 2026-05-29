/**
 * /api/clients — tenant-scoped CRUD. Every handler runs behind
 * requireAuth + resolveWorkspace, so repo calls are scoped to req.workspaceId
 * and one user can never read or mutate another tenant's clients.
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, resolveWorkspace } from '../lib/authMiddleware.js';
import { asyncHandler, requireFields, notFound } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import * as repo from '../db/repos.js';

const router = Router();
router.use(requireAuth, resolveWorkspace);

router.get('/', asyncHandler((req, res) => {
  res.json(repo.listClients(getDb(), req.workspaceId));
}));

router.post('/', asyncHandler((req, res) => {
  requireFields(req.body || {}, ['name']);
  const c = repo.createClient(getDb(), req.workspaceId, req.body);
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'client.create', entityType: 'client', entityId: c.id, ip: req.ip });
  res.status(201).json(c);
}));

router.get('/:id', asyncHandler((req, res) => {
  const c = repo.getClient(getDb(), req.workspaceId, req.params.id);
  if (!c) notFound('Client not found');
  res.json(c);
}));

router.patch('/:id', asyncHandler((req, res) => {
  const c = repo.updateClient(getDb(), req.workspaceId, req.params.id, req.body || {});
  if (!c) notFound('Client not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'client.update', entityType: 'client', entityId: c.id, ip: req.ip });
  res.json(c);
}));

router.delete('/:id', asyncHandler((req, res) => {
  const ok = repo.deleteClient(getDb(), req.workspaceId, req.params.id);
  if (!ok) notFound('Client not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'client.delete', entityType: 'client', entityId: req.params.id, ip: req.ip });
  res.json({ ok: true });
}));

export default router;
