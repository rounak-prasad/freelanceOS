/**
 * complianceEngine.js — Proactive India compliance guardrails for FreelanceOS.
 *
 * This is the cheapest, highest-trust feature in the product: it reads the
 * user's own data and warns them BEFORE they make an expensive mistake. No
 * competitor (Indian or global) does this. Every rule maps to a documented,
 * real-world trap from the research.
 *
 * Each rule returns alerts shaped as:
 *   { id, severity: 'critical'|'high'|'medium'|'info', title, message, action, theme }
 * Pure functions — fully unit-testable, no React, no side effects.
 */

import {
  isEligible44ADA,
  NON_SPECIFIED_PROFESSIONS,
  GST_REGISTRATION_THRESHOLD_SERVICES,
  advanceTaxSchedule,
} from '../config/taxRules.js';

// Foreign SaaS vendors that trigger GST Reverse Charge Mechanism (RCM) on import
// of service — registration required REGARDLESS of turnover.
export const FOREIGN_SAAS_VENDORS = [
  'adobe', 'figma', 'canva', 'slack', 'notion', 'zoom', 'github', 'openai',
  'anthropic', 'google workspace', 'g suite', 'aws', 'amazon web services',
  'microsoft 365', 'office 365', 'dropbox', 'linkedin', 'semrush', 'ahrefs',
  'mailchimp', 'hubspot', 'atlassian', 'jetbrains', 'vercel', 'netlify',
];

// Foreign payment platforms that create a "foreign asset" => Schedule FA => ITR-3
export const FOREIGN_ACCOUNT_PLATFORMS = ['paypal', 'wise', 'payoneer', 'stripe', 'mercury'];

const lc = (s) => String(s || '').toLowerCase();

/** Rule 1 — 44ADA eligibility & the "I was told I could use it" trap. */
export function check44ADA({ professionKey, grossReceipts = 0, digitalReceiptShare = 1, using44ADA = false } = {}) {
  const out = [];
  const r = isEligible44ADA(professionKey, grossReceipts, digitalReceiptShare);
  if (using44ADA && !r.professionOk && NON_SPECIFIED_PROFESSIONS.includes(professionKey)) {
    out.push({
      id: 'sec44ada-ineligible',
      severity: 'critical',
      title: 'You may NOT be eligible for Section 44ADA',
      message:
        'Your profession is not on the list of "specified professions" u/s 44AA(1). Content writers, graphic designers, digital marketers, social-media managers and VAs cannot use 44ADA — even though most tax content says otherwise. Filing under 44ADA could trigger a notice.',
      action: 'Review with a CA — you likely need ITR-3/ITR-4 with normal computation.',
      theme: 'tax',
    });
  }
  if (using44ADA && r.professionOk && !r.turnoverOk) {
    out.push({
      id: 'sec44ada-turnover',
      severity: 'high',
      title: '44ADA turnover cap exceeded',
      message: `Gross receipts of ₹${(grossReceipts).toLocaleString('en-IN')} exceed the 44ADA limit of ₹${r.cap.toLocaleString('en-IN')}. Presumptive taxation no longer applies.`,
      action: 'Switch to normal computation with books of accounts.',
      theme: 'tax',
    });
  }
  return out;
}

/** Rule 2 — Schedule FA trap: a foreign account forces ITR-3, killing 44ADA simplicity. */
export function checkScheduleFA({ foreignAccounts = [], using44ADA = false } = {}) {
  const out = [];
  const active = (foreignAccounts || []).filter((a) => a && (a.active === undefined || a.active));
  if (active.length > 0) {
    out.push({
      id: 'schedule-fa',
      severity: using44ADA ? 'critical' : 'high',
      title: 'Foreign account → Schedule FA disclosure required',
      message:
        `You hold ${active.length} foreign account(s) (${active.map((a) => a.platform || a.name).join(', ')}). These are foreign assets and MUST be disclosed in Schedule FA, which only exists in ITR-3 — ` +
        (using44ADA
          ? 'this voids the simplicity of the 44ADA / ITR-4 path you have selected.'
          : 'requiring full books of accounts.'),
      action: 'Plan for ITR-3 and disclose every foreign account; non-disclosure carries heavy penalties under the Black Money Act.',
      theme: 'crossborder',
    });
  }
  return out;
}

/** Rule 3 — RCM on foreign SaaS: registration required regardless of turnover. */
export function checkRCMForeignSaaS({ expenses = [] } = {}) {
  const hits = [];
  for (const e of expenses || []) {
    const hay = lc(e.vendor) + ' ' + lc(e.description) + ' ' + lc(e.category) + ' ' + lc(e.name);
    const match = FOREIGN_SAAS_VENDORS.find((v) => hay.includes(v));
    if (match) hits.push({ vendor: match, amount: e.amount || 0 });
  }
  if (!hits.length) return [];
  const vendors = [...new Set(hits.map((h) => h.vendor))];
  return [{
    id: 'rcm-foreign-saas',
    severity: 'high',
    title: 'Foreign SaaS detected — GST Reverse Charge (RCM) applies',
    message:
      `You expense foreign software (${vendors.slice(0, 6).join(', ')}${vendors.length > 6 ? '…' : ''}). Import of service triggers RCM — you must register for GST and pay 18% under reverse charge REGARDLESS of your turnover, even if it is well below ₹20L.`,
    action: 'Register for GST (if not already) and report these under RCM in GSTR-3B.',
    theme: 'gst',
  }];
}

/** Rule 4 — GST registration threshold proximity. */
export function checkGSTThreshold({ annualTurnover = 0, gstRegistered = false } = {}) {
  const out = [];
  const t = GST_REGISTRATION_THRESHOLD_SERVICES;
  if (!gstRegistered && annualTurnover >= t) {
    out.push({
      id: 'gst-threshold-crossed',
      severity: 'critical',
      title: 'GST registration is now mandatory',
      message: `Turnover of ₹${annualTurnover.toLocaleString('en-IN')} has crossed the ₹${t.toLocaleString('en-IN')} services threshold. Operating without registration now accrues penalties.`,
      action: 'Register for GST immediately.',
      theme: 'gst',
    });
  } else if (!gstRegistered && annualTurnover >= t * 0.8) {
    out.push({
      id: 'gst-threshold-near',
      severity: 'medium',
      title: 'Approaching the GST registration threshold',
      message: `Turnover of ₹${annualTurnover.toLocaleString('en-IN')} is within 20% of the ₹${t.toLocaleString('en-IN')} threshold. Plan registration before you cross it mid-year.`,
      action: 'Prepare GST registration documents.',
      theme: 'gst',
    });
  }
  return out;
}

/** Rule 5 — Upcoming advance-tax instalment reminder. */
export function checkAdvanceTax({ taxLiability = 0, is44ADA = false, paidSoFar = 0, today = new Date() } = {}) {
  if (!taxLiability || taxLiability < 10000) return []; // advance tax applies only if liability >= ₹10,000
  const sched = advanceTaxSchedule(taxLiability, is44ADA);
  const y = today.getFullYear();
  const dueDates = is44ADA
    ? [{ ...sched[0], date: new Date(y, 2, 15) }]
    : [
        { ...sched[0], date: new Date(y, 5, 15) },
        { ...sched[1], date: new Date(y, 8, 15) },
        { ...sched[2], date: new Date(y, 11, 15) },
        { ...sched[3], date: new Date(y + (today.getMonth() > 2 ? 1 : 0), 2, 15) },
      ];
  const next = dueDates.find((d) => d.cumulativeAmount > paidSoFar && d.date >= today);
  if (!next) return [];
  const days = Math.ceil((next.date - today) / 86400000);
  if (days > 45) return [];
  return [{
    id: 'advance-tax-due',
    severity: days <= 10 ? 'high' : 'medium',
    title: `Advance tax due in ${days} day(s)`,
    message: `${next.label}: cumulative ₹${next.cumulativeAmount.toLocaleString('en-IN')} of estimated liability. Missing instalments accrues interest under Sections 234B & 234C.`,
    action: 'Pay the advance-tax instalment on the income-tax portal.',
    theme: 'tax',
  }];
}

/**
 * Run all guardrails over an app-state snapshot and a tax profile.
 * @returns {Array} alerts sorted by severity.
 */
export function runGuardrails(snapshot = {}) {
  const {
    professionKey, grossReceipts, digitalReceiptShare, using44ADA,
    foreignAccounts, expenses, annualTurnover, gstRegistered,
    taxLiability, paidSoFar, today,
  } = snapshot;

  // A user may *select* 44ADA but not actually qualify — the advance-tax
  // schedule must follow their VALID status (ineligible => 4 instalments).
  const validly44ADA = !!using44ADA && isEligible44ADA(professionKey, grossReceipts, digitalReceiptShare).eligible;

  const alerts = [
    ...check44ADA({ professionKey, grossReceipts, digitalReceiptShare, using44ADA }),
    ...checkScheduleFA({ foreignAccounts, using44ADA }),
    ...checkRCMForeignSaaS({ expenses }),
    ...checkGSTThreshold({ annualTurnover, gstRegistered }),
    ...checkAdvanceTax({ taxLiability, is44ADA: validly44ADA, paidSoFar, today }),
  ];

  const order = { critical: 0, high: 1, medium: 2, info: 3 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export default { runGuardrails, check44ADA, checkScheduleFA, checkRCMForeignSaaS, checkGSTThreshold, checkAdvanceTax };
