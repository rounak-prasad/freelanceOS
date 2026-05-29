/**
 * billingWebhook.js — Pure (Express-free) billing webhook logic.
 *
 * Kept separate from routes/billing.js so the signature check and the
 * event→subscription mapping can be unit-tested without pulling in Express, and
 * reused by any transport (HTTP route, queue worker, CLI replay).
 */
import crypto from 'node:crypto';
import * as repo from '../db/repos.js';

/** Constant-time HMAC-SHA256 verification of a Razorpay webhook body. */
export function verifyRazorpaySignature(rawBody, signature, secret) {
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody || Buffer.from('')).digest('hex');
  const a = Buffer.from(String(signature || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Razorpay subscription lifecycle → our internal status. */
export const SUB_STATUS_MAP = {
  'subscription.authenticated': 'trialing',
  'subscription.activated': 'active',
  'subscription.charged': 'active',
  'subscription.pending': 'past_due',
  'subscription.halted': 'halted',
  'subscription.cancelled': 'cancelled',
  'subscription.completed': 'cancelled',
};

/**
 * Apply a verified Razorpay subscription webhook to our subscription row.
 * Resolves the workspace from the subscription `notes.workspaceId` (set at
 * creation) or, failing that, by the stored provider subscription id. Always
 * logs a billing_event; only mutates the subscription for mapped events.
 */
export function applyBillingWebhook(db, body) {
  const event = body?.event;
  const entity = body?.payload?.subscription?.entity || {};
  const providerSubId = entity.id;
  let wsId = entity.notes?.workspaceId || null;
  if (!wsId && providerSubId) wsId = repo.findSubscriptionByProviderId(db, providerSubId)?.workspace_id || null;

  repo.insertBillingEvent(db, { workspaceId: wsId, provider: 'razorpay', eventType: event || 'unknown', payload: body?.payload || null });

  const status = SUB_STATUS_MAP[event];
  if (wsId && status) {
    const patch = { status };
    if (entity.notes?.plan) patch.plan = entity.notes.plan;
    if (entity.current_end) patch.current_period_end = new Date(entity.current_end * 1000).toISOString();
    return { wsId, status, applied: repo.upsertSubscription(db, wsId, patch) };
  }
  return { wsId, status: status || null, applied: null };
}

export default { verifyRazorpaySignature, applyBillingWebhook, SUB_STATUS_MAP };
