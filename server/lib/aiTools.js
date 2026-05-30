/**
 * aiTools.js — Tools the AI agent can call, each scoped to ONE workspace so the
 * assistant can only ever read the caller's own tenant data. Tool executors are
 * plain async functions over the repo layer + the versioned tax engine; they
 * return JSON-serialisable results that get fed back to the model.
 */
import * as repo from '../db/repos.js';
import { isEligible44ADA, GST_REGISTRATION_THRESHOLD_SERVICES, presumptiveIncome44ADA } from '../../src/config/taxRules.js';
import { paise } from './gstFormat.js';
import { computeInvoice } from './invoiceService.js';

/** Anthropic tool schema (also self-documents the agent's capabilities). */
export const TOOLS = [
  { name: 'get_financial_summary', description: 'Revenue (paid), outstanding, overdue, this-month revenue, and client/invoice counts for the workspace.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_overdue_invoices', description: 'Invoices past their due date and not yet paid.', input_schema: { type: 'object', properties: { limit: { type: 'number', description: 'max rows (default 20)' } } } },
  { name: 'find_client', description: 'Find clients by partial name or company.', input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'gst_preview', description: 'Compute GST (CGST/SGST/IGST, zero-rating) for given line items.', input_schema: { type: 'object', properties: { items: { type: 'array' }, isExport: { type: 'boolean' }, hasLUT: { type: 'boolean' }, sameState: { type: 'boolean' } }, required: ['items'] } },
  { name: 'compliance_flags', description: 'India compliance checks for this workspace: 44ADA eligibility and the GST registration threshold, from real receipts.', input_schema: { type: 'object', properties: {} } },
];

export async function runTool(db, wsId, name, input = {}) {
  switch (name) {
    case 'get_financial_summary': return financialSummary(db, wsId);
    case 'list_overdue_invoices': return overdueInvoices(db, wsId, input.limit);
    case 'find_client': return findClient(db, wsId, input.name);
    case 'gst_preview': return gstPreview(input);
    case 'compliance_flags': return complianceFlags(db, wsId);
    default: return { error: `Unknown tool: ${name}` };
  }
}

async function financialSummary(db, wsId) {
  const invoices = await repo.listInvoices(db, wsId);
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  let paidMinor = 0, outstandingMinor = 0, overdueMinor = 0, monthMinor = 0;
  for (const i of invoices) {
    if (i.status === 'paid') paidMinor += i.total_minor;
    else if (i.status !== 'cancelled') {
      outstandingMinor += i.total_minor;
      if (i.due_date && i.due_date < today) overdueMinor += i.total_minor;
    }
    if ((i.issue_date || '').slice(0, 7) === monthPrefix) monthMinor += i.total_minor;
  }
  return {
    currency: 'INR',
    clients: await repo.countClients(db, wsId),
    invoices: invoices.length,
    revenuePaid: paise(paidMinor),
    outstanding: paise(outstandingMinor),
    overdue: paise(overdueMinor),
    thisMonthRevenue: paise(monthMinor),
  };
}

async function overdueInvoices(db, wsId, limit = 20) {
  const invoices = await repo.listInvoices(db, wsId);
  const today = new Date().toISOString().slice(0, 10);
  return invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.due_date && i.due_date < today)
    .slice(0, Math.max(1, Number(limit) || 20))
    .map((i) => ({ number: i.number, due_date: i.due_date, amount: paise(i.total_minor), status: i.status }));
}

async function findClient(db, wsId, name) {
  const q = String(name || '').toLowerCase();
  const all = await repo.listClients(db, wsId);
  return all
    .filter((c) => (c.name || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q))
    .slice(0, 10)
    .map((c) => ({ id: c.id, name: c.name, company: c.company, gstin: c.gstin, state_code: c.state_code, isExport: !!c.is_export }));
}

function gstPreview({ items = [], isExport = false, hasLUT = false, sameState = true }) {
  const lines = (items || []).map((it) => ({
    description: it.description,
    quantity: Number(it.quantity) || 1,
    unitPriceMinor: Math.round(Number(it.amount ?? it.unitPrice ?? 0) * 100),
  }));
  const c = computeInvoice({ items: lines, isExport, hasLUT, sameState });
  return { subtotal: paise(c.subtotalMinor), cgst: paise(c.cgstMinor), sgst: paise(c.sgstMinor), igst: paise(c.igstMinor), total: paise(c.totalMinor), zeroRated: c.zeroRated, note: c.gstNote };
}

async function complianceFlags(db, wsId) {
  const ws = await repo.getWorkspace(db, wsId);
  const invoices = await repo.listInvoices(db, wsId);
  const grossMinor = invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.subtotal_minor, 0);
  const gross = paise(grossMinor);
  const sec44 = isEligible44ADA(ws.profession_key || '', gross, 1);
  return {
    grossReceipts: gross,
    profession: ws.profession_key || null,
    gstRegistered: !!ws.gst_registered,
    gstRegistrationThreshold: GST_REGISTRATION_THRESHOLD_SERVICES,
    gstThresholdCrossed: gross > GST_REGISTRATION_THRESHOLD_SERVICES,
    sec44ADA: sec44,
    presumptiveIncomeIfEligible: sec44.eligible ? presumptiveIncome44ADA(gross) : null,
  };
}

export default { TOOLS, runTool };
