/**
 * taxRules.js — Versioned, date-stamped India tax rule engine for FreelanceOS.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Tax slabs, GST rates, TDS sections and FEMA codes change almost every Union
 * Budget. Hard-coding them inside page components (the old approach) meant a
 * yearly change became a code hunt and bugs crept in (e.g. GST charged flat 18%
 * even on zero-rated service exports; advance tax estimated as a flat 30% of
 * revenue instead of using the slab engine).
 *
 * Everything tax-related now lives here as pure, testable functions + constants.
 * Update RULES once a year, bump RULES_VERSION / LAST_VERIFIED, and every screen
 * stays correct.
 *
 * ⚠️  DISCLAIMER: This is decision-support, NOT tax advice. Figures are
 * research-grade as of LAST_VERIFIED. Always confirm with a qualified CA before
 * filing. See SETUP.md.
 */

export const RULES_VERSION = '2025-26.1';
export const LAST_VERIFIED = '2026-05-01';
export const DISCLAIMER =
  'Estimates only — verify with a qualified CA. Rules version ' + RULES_VERSION + '.';

/* ------------------------------------------------------------------ *
 * 1. INCOME TAX — New Regime, FY 2025-26 (AY 2026-27)
 * ------------------------------------------------------------------ */

export const NEW_REGIME_SLABS_FY25_26 = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.10 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.20 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.30 },
];

export const CESS_RATE = 0.04; // Health & Education Cess
export const REBATE_87A_LIMIT = 1200000; // new regime: income up to ₹12L => nil tax
export const REBATE_87A_MAX = 60000; // max rebate amount

// Surcharge tiers (new regime caps top surcharge at 25%)
export const SURCHARGE_TIERS = [
  { upTo: 5000000, rate: 0 },
  { upTo: 10000000, rate: 0.10 },
  { upTo: 20000000, rate: 0.15 },
  { upTo: Infinity, rate: 0.25 },
];

function slabTax(income, slabs) {
  let tax = 0;
  let prev = 0;
  for (const s of slabs) {
    if (income > prev) {
      const span = Math.min(income, s.upTo) - prev;
      tax += span * s.rate;
      prev = s.upTo;
    } else break;
  }
  return tax;
}

function surchargeRate(income) {
  for (const t of SURCHARGE_TIERS) if (income <= t.upTo) return t.rate;
  return 0.25;
}

/**
 * Compute income tax under the FY2025-26 new regime, including 87A rebate,
 * marginal relief at the ₹12L edge, surcharge and 4% cess.
 * @param {number} taxableIncome
 * @returns {{base:number,rebate:number,afterRebate:number,surcharge:number,cess:number,total:number,effectiveRate:number}}
 */
export function computeIncomeTax(taxableIncome, slabs = NEW_REGIME_SLABS_FY25_26) {
  const income = Math.max(0, Math.round(taxableIncome || 0));
  const base = slabTax(income, slabs);

  // 87A rebate (new regime): nil tax up to ₹12L
  let rebate = 0;
  if (income <= REBATE_87A_LIMIT) rebate = Math.min(base, REBATE_87A_MAX);
  let afterRebate = base - rebate;

  // Marginal relief just above ₹12L: extra tax cannot exceed income over the limit
  if (income > REBATE_87A_LIMIT) {
    const excessOverLimit = income - REBATE_87A_LIMIT;
    if (afterRebate > excessOverLimit) afterRebate = excessOverLimit;
  }

  const surcharge = afterRebate * surchargeRate(income);
  const cess = (afterRebate + surcharge) * CESS_RATE;
  const total = Math.round(afterRebate + surcharge + cess);

  return {
    base: Math.round(base),
    rebate: Math.round(rebate),
    afterRebate: Math.round(afterRebate),
    surcharge: Math.round(surcharge),
    cess: Math.round(cess),
    total,
    effectiveRate: income > 0 ? total / income : 0,
  };
}

/* ------------------------------------------------------------------ *
 * 2. SECTION 44ADA — Presumptive taxation for professionals
 * ------------------------------------------------------------------ */

export const SEC_44ADA_RATE = 0.5; // 50% of gross receipts deemed as income
export const SEC_44ADA_CAP_STANDARD = 5000000; // ₹50L
export const SEC_44ADA_CAP_DIGITAL = 7500000; // ₹75L if cash receipts <= 5%

/**
 * Professions ELIGIBLE for 44ADA ("specified professions" u/s 44AA(1)).
 * Note the deliberate absence of content writing, graphic design, digital
 * marketing, social media and VA work — a trap most tax content gets wrong.
 */
export const SPECIFIED_PROFESSIONS = [
  'legal',
  'medical',
  'engineering',
  'architecture',
  'accountancy',
  'technical_consultancy',
  'interior_decoration',
  'film_artist',
  'company_secretary',
  'information_technology', // software development / IT consultancy (technical)
];

export const NON_SPECIFIED_PROFESSIONS = [
  'content_writing',
  'graphic_design',
  'digital_marketing',
  'social_media',
  'virtual_assistant',
  'photography_general',
  'video_editing',
  'translation',
];

export function isEligible44ADA(professionKey, grossReceipts = 0, digitalReceiptShare = 1) {
  const cap = digitalReceiptShare >= 0.95 ? SEC_44ADA_CAP_DIGITAL : SEC_44ADA_CAP_STANDARD;
  const professionOk = SPECIFIED_PROFESSIONS.includes(professionKey);
  const turnoverOk = grossReceipts <= cap;
  return { eligible: professionOk && turnoverOk, professionOk, turnoverOk, cap };
}

/** Presumptive income under 44ADA. */
export function presumptiveIncome44ADA(grossReceipts) {
  return Math.round((grossReceipts || 0) * SEC_44ADA_RATE);
}

/* ------------------------------------------------------------------ *
 * 3. GST — including the export-of-service / LUT zero-rating fix
 * ------------------------------------------------------------------ */

export const GST_RATE_DEFAULT = 0.18;
export const GST_REGISTRATION_THRESHOLD_SERVICES = 2000000; // ₹20L (₹10L special category states)

/**
 * Correct GST treatment for a service invoice.
 *
 * THE BUG THIS FIXES: the old code applied a flat 18% to *all* revenue,
 * including export of services — which is ZERO-RATED under LUT (Sec 16 IGST
 * Act). A huge share of an Indian freelancer's income is foreign-client work,
 * so the old number was materially wrong.
 *
 * @param {object} p
 * @param {number} p.amount taxable value
 * @param {boolean} p.isExportOfService client is foreign / supply is export of service
 * @param {boolean} p.hasLUT freelancer has filed a Letter of Undertaking
 * @param {boolean} p.sameState place of supply in same state as supplier (intra-state)
 * @param {number} [p.rate] override GST rate (default 18%)
 */
export function gstOnInvoice({ amount, isExportOfService = false, hasLUT = false, sameState = true, rate = GST_RATE_DEFAULT }) {
  const taxable = Math.max(0, amount || 0);
  if (isExportOfService) {
    if (hasLUT) {
      return { taxable, cgst: 0, sgst: 0, igst: 0, total: 0, rate: 0, zeroRated: true,
        note: 'Zero-rated export of service under LUT — no GST charged (Sec 16 IGST Act).' };
    }
    const igst = Math.round(taxable * rate);
    return { taxable, cgst: 0, sgst: 0, igst, total: igst, rate, zeroRated: false,
      note: 'Export WITHOUT LUT — pay IGST and claim refund. File an LUT to zero-rate and avoid blocking working capital.' };
  }
  if (sameState) {
    const half = Math.round((taxable * rate) / 2);
    return { taxable, cgst: half, sgst: half, igst: 0, total: half * 2, rate, zeroRated: false,
      note: 'Intra-state supply — CGST + SGST.' };
  }
  const igst = Math.round(taxable * rate);
  return { taxable, cgst: 0, sgst: 0, igst, total: igst, rate, zeroRated: false,
    note: 'Inter-state supply — IGST.' };
}

/* ------------------------------------------------------------------ *
 * 4. TDS — Sections 194J / 194C
 * ------------------------------------------------------------------ */

export const TDS_SECTIONS = {
  '194J': { rate: 0.10, label: 'Professional / technical services', threshold: 30000 },
  '194C': { rate: 0.01, label: 'Contract work (individual/HUF)', threshold: 30000, annualThreshold: 100000 },
  '194C_company': { rate: 0.02, label: 'Contract work (company)', threshold: 30000 },
};
export const TDS_NO_PAN_RATE = 0.20; // Sec 206AA — no PAN

export function tdsOn(amount, section = '194J', hasPAN = true) {
  const def = TDS_SECTIONS[section] || TDS_SECTIONS['194J'];
  const rate = hasPAN ? def.rate : TDS_NO_PAN_RATE;
  return { rate, amount: Math.round((amount || 0) * rate), section, label: def.label };
}

/* ------------------------------------------------------------------ *
 * 5. ADVANCE TAX schedule (fixes the flat-30% bug — caller passes the
 *    slab-engine liability, not 30% of revenue)
 * ------------------------------------------------------------------ */

export const ADVANCE_TAX_INSTALMENTS = [
  { label: 'On or before 15 Jun', month: 5, day: 15, cum: 0.15 },
  { label: 'On or before 15 Sep', month: 8, day: 15, cum: 0.45 },
  { label: 'On or before 15 Dec', month: 11, day: 15, cum: 0.75 },
  { label: 'On or before 15 Mar', month: 2, day: 15, cum: 1.0 },
];

/**
 * Build the advance-tax instalment schedule from a *properly computed* tax
 * liability. 44ADA filers pay 100% in a single instalment by 15 March.
 * @param {number} totalLiability slab-engine tax (use computeIncomeTax().total)
 * @param {boolean} is44ADA
 */
export function advanceTaxSchedule(totalLiability, is44ADA = false) {
  const liab = Math.max(0, Math.round(totalLiability || 0));
  if (is44ADA) {
    return [{ label: 'On or before 15 Mar', cum: 1.0, cumulativeAmount: liab, instalment: liab }];
  }
  let prevCum = 0;
  return ADVANCE_TAX_INSTALMENTS.map((i) => {
    const cumulativeAmount = Math.round(liab * i.cum);
    const instalment = cumulativeAmount - Math.round(liab * prevCum);
    prevCum = i.cum;
    return { label: i.label, cum: i.cum, cumulativeAmount, instalment };
  });
}

/* ------------------------------------------------------------------ *
 * 6. Compliance calendar (static deadlines used across the app)
 * ------------------------------------------------------------------ */

export const COMPLIANCE_CALENDAR = [
  { id: 'gstr1', label: 'GSTR-1 (monthly)', due: '11th of next month' },
  { id: 'gstr3b', label: 'GSTR-3B (monthly)', due: '20th of next month' },
  { id: 'lut', label: 'LUT renewal (exporters)', due: 'Before 31 Mar / start of FY' },
  { id: 'itr', label: 'ITR filing', due: '31 Jul (non-audit)' },
];

export default {
  RULES_VERSION, LAST_VERIFIED, DISCLAIMER,
  computeIncomeTax, presumptiveIncome44ADA, isEligible44ADA,
  gstOnInvoice, tdsOn, advanceTaxSchedule,
  SPECIFIED_PROFESSIONS, NON_SPECIFIED_PROFESSIONS,
  GST_REGISTRATION_THRESHOLD_SERVICES, COMPLIANCE_CALENDAR,
};
