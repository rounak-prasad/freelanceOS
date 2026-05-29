/**
 * /api/invoices — tenant-scoped CRUD with AUTHORITATIVE server-side GST.
 *
 * The client sends line items + flags; the server computes CGST/SGST/IGST and
 * the export/LUT zero-rating via the shared tax engine (never trusting
 * client-sent totals). All scoped to req.workspaceId.
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, resolveWorkspace } from '../lib/authMiddleware.js';
import { asyncHandler, requireFields, bad, notFound } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import * as repo from '../db/repos.js';

const router = Router();
router.use(requireAuth, resolveWorkspace);

router.get('/', asyncHandler((req, res) => {
  res.json(repo.listInvoices(getDb(), req.workspaceId));
}));

router.post('/', asyncHandler((req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.items) || body.items.length === 0) bad('At least one line item is required');
  const inv = repo.createInvoice(getDb(), req.workspaceId, body);
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'invoice.create', entityType: 'invoice', entityId: inv.id, ip: req.ip, meta: { number: inv.number, total_minor: inv.total_minor } });
  res.status(201).json(inv);
}));

router.get('/:id', asyncHandler((req, res) => {
  const inv = repo.getInvoice(getDb(), req.workspaceId, req.params.id);
  if (!inv) notFound('Invoice not found');
  res.json(inv);
}));

router.patch('/:id', asyncHandler((req, res) => {
  const inv = repo.updateInvoice(getDb(), req.workspaceId, req.params.id, req.body || {});
  if (!inv) notFound('Invoice not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'invoice.update', entityType: 'invoice', entityId: inv.id, ip: req.ip });
  res.json(inv);
}));

router.delete('/:id', asyncHandler((req, res) => {
  const ok = repo.deleteInvoice(getDb(), req.workspaceId, req.params.id);
  if (!ok) notFound('Invoice not found');
  writeAudit(getDb(), { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'invoice.delete', entityType: 'invoice', entityId: req.params.id, ip: req.ip });
  res.json({ ok: true });
}));

export default router;
