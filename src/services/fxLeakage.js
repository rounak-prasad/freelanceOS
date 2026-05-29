/**
 * fxLeakage.js — Cross-border payment leakage calculator for FreelanceOS.
 *
 * An Indian freelancer billing foreign clients loses ₹5,000+ per $1,000 to the
 * worst rails vs the best, through charges that "never appear on any invoice":
 * FX markup, platform fees, and per-FIRA/FIRC charges. This module quantifies
 * that for a given amount and ranks providers, using the fee models gathered in
 * the market research (verified to ~May 2026 — confirm live pricing).
 *
 * Pure functions; no React.
 */

export const PROVIDERS = [
  {
    id: 'skydo', name: 'Skydo', kind: 'PA-CB fintech',
    fxMarkupPct: 0, firaFee: 0, firaIncluded: true,
    fee: (usd, inr) => (usd <= 2000 ? 19 : usd <= 10000 ? 29 : usd * 0.003) * inr, feeKind: 'flat/slab',
    note: 'RBI PA-CB authorised. 0% FX markup, free instant FIRA. Best for mid/large invoices.',
  },
  {
    id: 'razorpay', name: 'Razorpay Export', kind: 'PA-CB',
    fxMarkupPct: 0, firaFee: 0, firaIncluded: true,
    fee: (usd, inr) => usd * inr * 0.01, feeKind: '1% + GST',
    note: '0% FX markup + 1% fee, eFIRC within 24h, also does domestic UPI.',
  },
  {
    id: 'wise', name: 'Wise Business', kind: 'Multi-currency',
    fxMarkupPct: 0.0, firaFee: 2.5, firaIncluded: false,
    fee: (usd, inr) => usd * inr * 0.0175, feeKind: '~1.75% conv',
    note: 'Mid-market rate, ~1.6–1.9% conversion, FIRA $2.50 each.',
  },
  {
    id: 'payoneer', name: 'Payoneer', kind: 'Marketplace',
    fxMarkupPct: 0.02, firaFee: 0, firaIncluded: true,
    fee: (usd, inr) => usd * inr * 0.01, feeKind: '~1% + 2% FX',
    note: 'Deep marketplace integrations; withdrawal FX spread ~2%, annual fee under $2k/yr volume.',
  },
  {
    id: 'paypal', name: 'PayPal', kind: 'Legacy',
    fxMarkupPct: 0.035, firaFee: 0, firaIncluded: true,
    fee: (usd, inr) => usd * inr * 0.044, feeKind: '4.4% + 3–4% FX',
    note: 'Highest leakage. ~4.4% fee plus a 3–4% currency markup.',
  },
  {
    id: 'bank_swift', name: 'Bank / SWIFT', kind: 'Traditional',
    fxMarkupPct: 0.02, firaFee: 3.5, firaIncluded: false,
    fee: (usd, inr) => usd * inr * 0.005 + 12 * inr, feeKind: 'spread + SWIFT',
    note: 'Bank gives ₹1–2 below mid-market; FIRC ₹200–500 + GST, 3–5 days.',
  },
];

/**
 * Net INR a freelancer actually receives for a USD invoice via one provider.
 * @param {number} usd invoice amount in USD
 * @param {number} usdInr mid-market USD→INR rate
 * @param {object} provider one of PROVIDERS
 */
export function computeNet(usd, usdInr, provider) {
  const gross = usd * usdInr;
  const fxLoss = gross * (provider.fxMarkupPct || 0);
  const platformFee = Math.max(0, provider.fee(usd, usdInr));
  const firaCost = provider.firaIncluded ? 0 : (provider.firaFee || 0) * usdInr;
  const totalCost = fxLoss + platformFee + firaCost;
  const net = gross - totalCost;
  return {
    providerId: provider.id,
    providerName: provider.name,
    gross: Math.round(gross),
    fxLoss: Math.round(fxLoss),
    platformFee: Math.round(platformFee),
    firaCost: Math.round(firaCost),
    totalCost: Math.round(totalCost),
    net: Math.round(net),
    effectivePct: gross > 0 ? totalCost / gross : 0,
    firaIncluded: provider.firaIncluded,
    note: provider.note,
  };
}

/** Compare all providers for an amount; returns sorted (best net first) + gap. */
export function compareAll(usd, usdInr, providers = PROVIDERS) {
  const rows = providers.map((p) => computeNet(usd, usdInr, p)).sort((a, b) => b.net - a.net);
  const best = rows[0];
  const worst = rows[rows.length - 1];
  return {
    rows,
    best,
    worst,
    gap: best && worst ? best.net - worst.net : 0,
    gapPer1000: usd > 0 && best && worst ? Math.round(((best.net - worst.net) / usd) * 1000) : 0,
  };
}

/** Map a remittance purpose to its RBI purpose code (common freelancer codes). */
export const PURPOSE_CODES = [
  { code: 'P0802', label: 'Software consultancy / implementation' },
  { code: 'P0807', label: 'Other software / IT services' },
  { code: 'P0902', label: 'Business & management consultancy' },
  { code: 'P1006', label: 'Advertising, market research' },
  { code: 'P0805', label: 'Telecommunication / IT-enabled services (BPO/KPO)' },
  { code: 'P1004', label: 'Design / creative services' },
];

export default { PROVIDERS, computeNet, compareAll, PURPOSE_CODES };
