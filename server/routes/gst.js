/**
 * /api/gst — GST e-invoicing (IRN), e-way bill, and GSTR-1 filing.
 *
 *   GET  /invoices/:id/einvoice/preview   build the IRP payload + validation (dry run)
 *   POST /invoices/:id/einvoice           generate the IRN (sandbox, or live via GSP)
 *   POST /invoices/:id/ewaybill           generate an e-way bill
 *   GET  /gstr1?period=MMYYYY             GSTR-1 return JSON + summary for a period
 *   GET  /einvoice/status                 per-invoice IRN / e-way-bill status snapshot
 *
 * e-invoicing is gated behind the `eInvoicing` plan feature (Pro/Team). Going
 * live with the government IRP needs a GSP/ASP (IRP_BASE_URL + IRP_API_KEY);
 * without them the IRP adapter runs in deterministic SANDBOX mode.
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, resolveWorkspace, requireRole } from '../lib/authMiddleware.js';
import { asyncHandler, bad, notFound, HttpError } from '../lib/validate.js';
import { requireFeature } from '../lib/entitlements.js';
import { writeAudit } from '../lib/audit.js';
import * as repo from '../db/repos.js';
import { buildEInvoicePayload, validateEInvoice } from '../lib/einvoice.js';
import { buildEWayBillPayload, validateEWayBill } from '../lib/ewaybill.js';
import { buildGstr1, summarizeGstr1 } from '../lib/gstr1.js';
import { submitEInvoice, generateEWayBill, irpConfigured } from '../lib/irpClient.js';
import { periodToRange } from '../lib/gstFormat.js';

const router = Router();
router.use(requireAuth, resolveWorkspace);
const CAN_WRITE = ['owner', 'admin', 'member'];

async function loadInvoiceBundle(db, wsId, id) {
  const invoice = await repo.getInvoice(db, wsId, id);
  if (!invoice) notFound('Invoice not found');
  const workspace = await repo.getWorkspace(db, wsId);
  const client = invoice.client_id ? await repo.getClient(db, wsId, invoice.client_id) : null;
  return { invoice, workspace, client, items: invoice.items || [] };
}

router.get('/invoices/:id/einvoice/preview', requireFeature('eInvoicing'), asyncHandler(async (req, res) => {
  const bundle = await loadInvoiceBundle(getDb(), req.workspaceId, req.params.id);
  const validation = validateEInvoice(bundle);
  const { payload, supType } = buildEInvoicePayload(bundle);
  res.json({ supType, validation, payload });
}));

router.post('/invoices/:id/einvoice', requireRole(...CAN_WRITE), requireFeature('eInvoicing'), asyncHandler(async (req, res) => {
  const db = getDb();
  const bundle = await loadInvoiceBundle(db, req.workspaceId, req.params.id);
  if (bundle.invoice.irn) bad('This invoice already has an IRN');
  const validation = validateEInvoice(bundle);
  if (!validation.ok) throw new HttpError(422, 'Invoice is not ready for e-invoicing', { errors: validation.errors });

  const { payload } = buildEInvoicePayload(bundle);
  let result;
  try {
    result = await submitEInvoice(payload);
  } catch (e) {
    await repo.setInvoiceEInvoice(db, req.workspaceId, req.params.id, { status: 'failed', irn: null, ackNo: null, ackDt: null, signedQr: null });
    throw new HttpError(502, `IRP submission failed: ${e.message}`);
  }
  const invoice = await repo.setInvoiceEInvoice(db, req.workspaceId, req.params.id, {
    irn: result.irn, ackNo: result.ackNo, ackDt: result.ackDt, signedQr: result.signedQrCode, status: 'generated',
  });
  writeAudit(db, { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'einvoice.generate', entityType: 'invoice', entityId: req.params.id, ip: req.ip, meta: { irn: result.irn, mode: result.mode } });
  res.status(201).json({ mode: result.mode, irn: result.irn, ackNo: result.ackNo, ackDt: result.ackDt, signedQrCode: result.signedQrCode, invoice });
}));

router.post('/invoices/:id/ewaybill', requireRole(...CAN_WRITE), requireFeature('eInvoicing'), asyncHandler(async (req, res) => {
  const db = getDb();
  const bundle = await loadInvoiceBundle(db, req.workspaceId, req.params.id);
  const v = validateEWayBill(bundle);
  if (!v.ok) throw new HttpError(422, 'Cannot generate an e-way bill', { errors: v.errors });
  const payload = buildEWayBillPayload({ ...bundle, transport: req.body?.transport || {} });
  const result = await generateEWayBill(payload);
  const invoice = await repo.setInvoiceEwayBill(db, req.workspaceId, req.params.id, { ewbNo: result.ewbNo });
  writeAudit(db, { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'ewaybill.generate', entityType: 'invoice', entityId: req.params.id, ip: req.ip, meta: { ewbNo: result.ewbNo, mode: result.mode } });
  res.status(201).json({ mode: result.mode, ewbNo: result.ewbNo, validUpto: result.validUpto, invoice });
}));

router.get('/gstr1', asyncHandler(async (req, res) => {
  const db = getDb();
  let range;
  try { range = periodToRange(String(req.query.period || '')); } catch (e) { return bad(e.message); }
  const ws = await repo.getWorkspace(db, req.workspaceId);
  const invoices = await repo.listInvoicesForGstr1(db, req.workspaceId, range.fromISO, range.toISO);
  res.json({
    period: range.fp,
    range: { from: range.fromISO, to: range.toISO },
    summary: summarizeGstr1(invoices),
    gstr1: buildGstr1({ invoices, workspace: ws, period: range.fp }),
    irpConfigured: irpConfigured(),
  });
}));

router.get('/einvoice/status', asyncHandler(async (req, res) => {
  const invoices = await repo.listInvoices(getDb(), req.workspaceId);
  res.json(invoices.map((i) => ({
    id: i.id, number: i.number, issue_date: i.issue_date, total_minor: i.total_minor,
    status: i.status, irn: i.irn, ewb_no: i.ewb_no, einvoice_status: i.einvoice_status,
  })));
}));

export default router;
