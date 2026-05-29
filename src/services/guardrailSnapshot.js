/**
 * guardrailSnapshot.js — Derive the compliance-engine input from app state.
 * Shared by the Compliance Guardrails page and the Dashboard alert banner so
 * the two never drift. Tolerant of missing/legacy fields.
 */
import { computeIncomeTax, presumptiveIncome44ADA, isEligible44ADA } from '../config/taxRules.js';

/** Current Indian financial year (Apr–Mar) start year for a given date. */
export function fyStartYear(d = new Date()) {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

function invoiceDate(inv) {
  const v = inv.date || inv.issueDate || inv.invoiceDate || inv.createdAt;
  return v ? new Date(v) : null;
}
function invoiceAmount(inv) {
  return Number(inv.total ?? inv.amount ?? inv.grandTotal ?? 0) || 0;
}

/** Gross receipts (turnover) for the current FY from invoices. */
export function currentFYTurnover(invoices = [], today = new Date()) {
  const start = new Date(fyStartYear(today), 3, 1); // 1 Apr
  const end = new Date(fyStartYear(today) + 1, 2, 31, 23, 59, 59); // 31 Mar
  return (invoices || []).reduce((sum, inv) => {
    const d = invoiceDate(inv);
    const status = String(inv.status || '').toLowerCase();
    if (status === 'draft' || status === 'cancelled') return sum;
    if (d && (d < start || d > end)) return sum;
    return sum + invoiceAmount(inv);
  }, 0);
}

/**
 * Build the guardrail snapshot.
 * @param {object} state app state from useData()
 * @param {object} [overrides] optional UI overrides (profession, toggles)
 */
export function buildSnapshot(state = {}, overrides = {}) {
  const today = new Date();
  const settings = state.settings || {};
  const invoices = state.invoices || [];
  const expenses = state.expenses || [];

  const grossReceipts = overrides.grossReceipts ?? currentFYTurnover(invoices, today);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const professionKey = overrides.professionKey ?? settings.profession ?? 'information_technology';
  const using44ADA = overrides.using44ADA ?? settings.using44ADA ?? true;
  const gstRegistered = overrides.gstRegistered ?? settings.gstRegistered ?? false;

  const elig = isEligible44ADA(professionKey, grossReceipts, 1).eligible;
  const taxableIncome = using44ADA && elig
    ? presumptiveIncome44ADA(grossReceipts)
    : Math.max(0, grossReceipts - totalExpenses);
  const taxLiability = computeIncomeTax(taxableIncome).total;

  // Advance tax / TDS already paid (proxy): sum of recorded TDS entries
  const paidSoFar = (state.tdsEntries || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return {
    professionKey,
    using44ADA,
    gstRegistered,
    grossReceipts,
    annualTurnover: grossReceipts,
    digitalReceiptShare: 1,
    foreignAccounts: state.foreignAccounts || [],
    expenses,
    taxLiability,
    paidSoFar,
    today,
    // extras for display
    _taxableIncome: taxableIncome,
    _totalExpenses: totalExpenses,
    _eligible44ADA: elig,
  };
}

export default { buildSnapshot, currentFYTurnover, fyStartYear };
