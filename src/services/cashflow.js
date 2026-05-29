/**
 * cashflow.js — Irregular-income cash-flow forecast for FreelanceOS.
 *
 * Budgeting apps assume a fixed salary. Freelancers live feast-or-famine
 * (₹22L months, ₹4L months). This projects the next N months of inflow from
 * open invoices + recurring schedules + weighted pipeline, overlays the
 * advance-tax due dates, and answers the only question that matters in a lean
 * month: "how much must I invoice, and by when, to stay above my floor?"
 *
 * Pure functions; no React.
 */

import { advanceTaxSchedule } from '../config/taxRules.js';

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d) => d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });

const PIPELINE_WEIGHTS = { lead: 0.1, contacted: 0.2, proposal: 0.4, negotiation: 0.6, won: 1, lost: 0 };

/**
 * @param {object} state app-state snapshot
 *   invoices: [{ amount/total, status, dueDate, paidDate }]
 *   recurringSchedules: [{ amount, nextDate/dayOfMonth, active }]
 *   pipeline/proposals: [{ value/amount, stage, expectedCloseDate }]
 * @param {object} opts { months=6, monthlyFloor, taxLiability, is44ADA, openingBalance, today }
 */
export function forecast(state = {}, opts = {}) {
  const today = opts.today ? new Date(opts.today) : new Date();
  const months = opts.months || 6;
  const monthlyFloor = opts.monthlyFloor || 0;
  let balance = opts.openingBalance || 0;

  // Build month buckets
  const buckets = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    buckets.push({ key: monthKey(d), label: monthLabel(d), date: d, expectedIn: 0, taxDue: 0, floor: monthlyFloor, sources: [] });
  }
  const idxOf = (d) => buckets.findIndex((b) => b.key === monthKey(d));

  // 1. Open invoices (unpaid) → expected on due date
  for (const inv of state.invoices || []) {
    const amt = inv.total || inv.amount || 0;
    const status = String(inv.status || '').toLowerCase();
    if (status === 'paid' || amt <= 0) continue;
    const due = inv.dueDate ? new Date(inv.dueDate) : today;
    const i = idxOf(due) === -1 && due < today ? 0 : idxOf(due); // overdue → this month
    if (i >= 0) { buckets[i].expectedIn += amt; buckets[i].sources.push({ type: 'invoice', amt }); }
  }

  // 2. Recurring schedules → each active month
  for (const r of state.recurringSchedules || []) {
    const active = r.isActive ?? r.active ?? true;
    if (!active) continue;
    const amt = r.amount || r.total || 0;
    const ref = r.nextDueDate || r.nextDate;
    const day = r.dayOfMonth || (ref ? new Date(ref).getDate() : 1);
    for (const b of buckets) {
      const occur = new Date(b.date.getFullYear(), b.date.getMonth(), day);
      if (occur >= today) { b.expectedIn += amt; b.sources.push({ type: 'recurring', amt }); }
    }
  }

  // 3. Pipeline / proposals → weighted by stage, on expected close month
  const pipeline = state.pipeline || state.proposals || [];
  for (const p of pipeline) {
    const stage = String(p.stage || p.status || 'lead').toLowerCase();
    const w = PIPELINE_WEIGHTS[stage] !== undefined ? PIPELINE_WEIGHTS[stage] : 0.2;
    const val = (p.value || p.amount || 0) * w;
    if (val <= 0) continue;
    const close = p.expectedCloseDate ? new Date(p.expectedCloseDate) : new Date(today.getFullYear(), today.getMonth() + 1, 15);
    const i = idxOf(close);
    if (i >= 0) { buckets[i].expectedIn += val; buckets[i].sources.push({ type: 'pipeline', amt: val, weight: w }); }
  }

  // 4. Advance-tax overlay
  if (opts.taxLiability) {
    const sched = advanceTaxSchedule(opts.taxLiability, opts.is44ADA);
    const y = today.getFullYear();
    const dueMap = opts.is44ADA
      ? [{ amt: sched[0].instalment, date: new Date(y, 2, 15) }]
      : [
          { amt: sched[0].instalment, date: new Date(y, 5, 15) },
          { amt: sched[1].instalment, date: new Date(y, 8, 15) },
          { amt: sched[2].instalment, date: new Date(y, 11, 15) },
          { amt: sched[3].instalment, date: new Date(y, 2, 15) },
        ];
    for (const d of dueMap) {
      const i = idxOf(d.date);
      if (i >= 0) buckets[i].taxDue += d.amt;
    }
  }

  // 5. Running balance + shortfall detection
  const projected = buckets.map((b) => {
    const net = b.expectedIn - b.floor - b.taxDue;
    balance += net;
    return {
      label: b.label,
      expectedIn: Math.round(b.expectedIn),
      floor: Math.round(b.floor),
      taxDue: Math.round(b.taxDue),
      net: Math.round(net),
      runningBalance: Math.round(balance),
      shortfall: balance < 0,
    };
  });

  const shortfallMonths = projected.filter((m) => m.shortfall);
  // How much extra to invoice THIS month to keep the worst month above zero
  let mustInvoice = 0;
  const worst = projected.reduce((min, m) => (m.runningBalance < min ? m.runningBalance : min), 0);
  if (worst < 0) mustInvoice = Math.abs(worst);

  return {
    months: projected,
    shortfallMonths: shortfallMonths.map((m) => m.label),
    lowestBalance: Math.round(worst),
    suggestion:
      mustInvoice > 0
        ? `Invoice and collect at least ₹${mustInvoice.toLocaleString('en-IN')} more in the next 30 days to stay solvent through ${shortfallMonths[0]?.label || 'the forecast'}.`
        : 'Projected cash flow stays positive across the forecast window. Good runway.',
    mustInvoice: Math.round(mustInvoice),
  };
}

export default { forecast };
