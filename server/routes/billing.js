/**
 * /api/billing — subscription billing + entitlements (the Billing pillar).
 *
 *   GET  /            current plan, status, usage, limits, features + catalog
 *   POST /checkout    start/switch a plan (owner/admin)
 *   POST /cancel      cancel the subscription (owner/admin)
 *   POST /webhook     Razorpay subscription webhook (PUBLIC, signature-verified)
 *
 * Real billing uses Razorpay Subscriptions and needs RAZORPAY_KEY_ID/SECRET plus
 * a Razorpay plan id per tier (RAZORPAY_PLAN_PRO / RAZORPAY_PLAN_TEAM) and
 * RAZORPAY_WEBHOOK_SECRET. Without those, /checkout runs in clearly-flagged
 * TEST MODE so the product is fully explorable locally.
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, resolveWorkspace, requireRole } from '../lib/authMiddleware.js';
import { asyncHandler, bad, HttpError } from '../lib/validate.js';
import { writeAudit } from '../lib/audit.js';
import * as repo from '../db/repos.js';
import { PLANS, PLAN_IDS, getPlan } from '../lib/plans.js';
import { entitlementsSnapshot } from '../lib/entitlements.js';
import { verifyRazorpaySignature, applyBillingWebhook } from '../lib/billingWebhook.js';

// Re-exported so existing importers (and tests) can reach them from here too.
export { verifyRazorpaySignature, applyBillingWebhook };

/* ── Razorpay helpers (mirrors routes/payments.js) ── */
const razorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
async function getClient() {
  const { default: Razorpay } = await import('razorpay');
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}
const razorpayPlanId = (planId) => process.env[`RAZORPAY_PLAN_${String(planId).toUpperCase()}`] || null;

const publicPlans = () => PLAN_IDS.map((id) => {
  const p = PLANS[id];
  return { id: p.id, name: p.name, tagline: p.tagline, priceMonthlyMinor: p.priceMonthlyMinor, limits: p.limits, features: p.features };
});

/* ── public webhook router (no auth) ── */
export const webhookRouter = Router();
webhookRouter.post('/', (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Webhook secret not configured' });
  if (!verifyRazorpaySignature(req.rawBody, req.headers['x-razorpay-signature'], secret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  applyBillingWebhook(getDb(), req.body || {});
  res.json({ received: true });
});

/* ── authenticated billing router ── */
const router = Router();
router.use(requireAuth, resolveWorkspace);

router.get('/', asyncHandler((req, res) => {
  res.json({ ...entitlementsSnapshot(getDb(), req.workspaceId), plans: publicPlans(), razorpayConfigured: razorpayConfigured() });
}));

router.post('/checkout', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const db = getDb();
  const planId = String(req.body?.plan || '').toLowerCase();
  if (!PLAN_IDS.includes(planId)) bad(`Unknown plan "${planId}". Choose one of: ${PLAN_IDS.join(', ')}`);

  // Downgrade to Free is immediate and free.
  if (planId === 'free') {
    const sub = repo.upsertSubscription(db, req.workspaceId, { plan: 'free', status: 'active', provider: null, provider_subscription_id: null });
    repo.insertBillingEvent(db, { workspaceId: req.workspaceId, provider: 'local', eventType: 'downgrade.free' });
    writeAudit(db, { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'billing.downgrade', entityType: 'subscription', ip: req.ip, meta: { plan: 'free' } });
    return res.json({ ok: true, subscription: sub });
  }

  const rzpPlan = razorpayPlanId(planId);
  if (razorpayConfigured() && rzpPlan) {
    try {
      const rzp = await getClient();
      const subscription = await rzp.subscriptions.create({
        plan_id: rzpPlan,
        total_count: 12,
        customer_notify: 1,
        notes: { workspaceId: req.workspaceId, plan: planId, source: 'FreelanceOS' },
      });
      repo.upsertSubscription(db, req.workspaceId, {
        plan: planId, status: 'trialing', provider: 'razorpay',
        provider_subscription_id: subscription.id, seats: getPlan(planId).limits.members ?? 1,
      });
      repo.insertBillingEvent(db, { workspaceId: req.workspaceId, provider: 'razorpay', eventType: 'subscription.create', payload: { id: subscription.id, plan: planId } });
      writeAudit(db, { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'billing.subscribe', entityType: 'subscription', entityId: subscription.id, ip: req.ip, meta: { plan: planId, provider: 'razorpay' } });
      return res.status(201).json({ provider: 'razorpay', subscriptionId: subscription.id, shortUrl: subscription.short_url, status: 'trialing' });
    } catch (e) {
      throw new HttpError(502, e?.error?.description || e.message || 'Razorpay subscription failed');
    }
  }

  // Test/local mode — activate immediately and flag it so the UI can label it.
  const sub = repo.upsertSubscription(db, req.workspaceId, {
    plan: planId, status: 'active', provider: null, provider_subscription_id: null,
    seats: getPlan(planId).limits.members ?? 1,
    current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
  });
  repo.insertBillingEvent(db, { workspaceId: req.workspaceId, provider: 'local', eventType: 'subscription.activate.testmode', payload: { plan: planId } });
  writeAudit(db, { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'billing.subscribe', entityType: 'subscription', ip: req.ip, meta: { plan: planId, provider: 'test' } });
  res.status(201).json({ testMode: true, subscription: sub });
}));

router.post('/cancel', requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const db = getDb();
  const cur = repo.getSubscription(db, req.workspaceId);
  if (cur.provider === 'razorpay' && cur.provider_subscription_id && razorpayConfigured()) {
    try { const rzp = await getClient(); await rzp.subscriptions.cancel(cur.provider_subscription_id); }
    catch (e) { console.warn('[billing] razorpay cancel failed (cancelling locally):', e.message); }
  }
  const sub = repo.upsertSubscription(db, req.workspaceId, { status: 'cancelled' });
  repo.insertBillingEvent(db, { workspaceId: req.workspaceId, provider: cur.provider || 'local', eventType: 'subscription.cancel' });
  writeAudit(db, { workspaceId: req.workspaceId, userId: req.auth.userId, action: 'billing.cancel', entityType: 'subscription', ip: req.ip });
  res.json({ ok: true, subscription: sub });
}));

export default router;
