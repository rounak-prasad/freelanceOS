/**
 * plans.js — Subscription plan catalog + entitlement rules.
 *
 * Pricing is in INTEGER MINOR UNITS (paise), matching the money model used
 * everywhere else. A `null` limit means UNLIMITED. This is the single source of
 * truth for what each plan costs and unlocks — edit here, and the billing page,
 * the entitlement middleware and the tests all stay consistent.
 */
export const PLANS = {
  free: {
    id: 'free', name: 'Free', priceMonthlyMinor: 0,
    tagline: 'Get your freelance business running',
    limits: { clients: 5, invoicesPerMonth: 10, members: 1 },
    features: { aiAssistant: false, crossBorder: true, eInvoicing: false, prioritySupport: false, removeBranding: false },
  },
  pro: {
    id: 'pro', name: 'Pro', priceMonthlyMinor: 49900, // ₹499 / month
    tagline: 'For full-time independent professionals',
    limits: { clients: null, invoicesPerMonth: null, members: 1 },
    features: { aiAssistant: true, crossBorder: true, eInvoicing: true, prioritySupport: false, removeBranding: true },
  },
  team: {
    id: 'team', name: 'Team', priceMonthlyMinor: 149900, // ₹1,499 / month
    tagline: 'For studios and small agencies',
    limits: { clients: null, invoicesPerMonth: null, members: 10 },
    features: { aiAssistant: true, crossBorder: true, eInvoicing: true, prioritySupport: true, removeBranding: true },
  },
};

export const PLAN_IDS = Object.keys(PLANS);
export const getPlan = (id) => PLANS[id] || PLANS.free;
export const isUnlimited = (limit) => limit === null || limit === undefined;
export const withinLimit = (used, limit) => isUnlimited(limit) || used < limit;

/**
 * Which plan's entitlements actually apply, given a subscription's status.
 * active/trialing/past_due keep entitlements (past_due = short grace period);
 * halted/cancelled fall back to Free so a lapsed payer is never locked out of
 * their own data, only of paid capacity.
 */
export function effectivePlanId(subscription) {
  if (!subscription) return 'free';
  const entitled = ['active', 'trialing', 'past_due'];
  return entitled.includes(subscription.status) ? (subscription.plan || 'free') : 'free';
}

export default { PLANS, PLAN_IDS, getPlan, isUnlimited, withinLimit, effectivePlanId };
