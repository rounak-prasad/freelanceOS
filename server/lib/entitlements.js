/**
 * entitlements.js — Turn a workspace's subscription into enforceable limits.
 *
 *   entitlementsSnapshot(db, wsId) → { subscription, effectivePlan, limits, features, usage }
 *   enforceLimit('clients'|'invoicesPerMonth'|'members')  → 402 when at cap
 *   requireFeature('aiAssistant'|'eInvoicing'|…)          → 402 when locked
 *
 * Usage is computed from the live tables, so limits can never drift from
 * reality. Async (Phase 1b): all repo reads are awaited, so this runs unchanged
 * on SQLite and Postgres. Middleware runs AFTER resolveWorkspace (needs
 * req.workspaceId).
 */
import { getDb } from '../db/index.js';
import * as repo from '../db/repos.js';
import { HttpError } from './validate.js';
import { getPlan, withinLimit, effectivePlanId } from './plans.js';

/** UTC start-of-month — the window for the monthly invoice limit. */
const startOfMonthISO = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();

export async function planForWorkspace(db, wsId) {
  const sub = await repo.getSubscription(db, wsId);
  return { sub, plan: getPlan(effectivePlanId(sub)) };
}

export async function computeUsage(db, wsId) {
  return {
    clients: await repo.countClients(db, wsId),
    invoicesThisMonth: await repo.countInvoicesSince(db, wsId, startOfMonthISO()),
    members: await repo.countMembers(db, wsId),
    pendingInvites: await repo.countPendingInvitations(db, wsId),
  };
}

export async function entitlementsSnapshot(db, wsId) {
  const { sub, plan } = await planForWorkspace(db, wsId);
  return {
    subscription: {
      plan: sub.plan, status: sub.status, provider: sub.provider,
      currentPeriodEnd: sub.current_period_end, seats: sub.seats,
    },
    effectivePlan: plan.id,
    limits: plan.limits,
    features: plan.features,
    usage: await computeUsage(db, wsId),
  };
}

/** Map a limit key → the number currently "used" (invites count toward seats). */
function usedFor(resource, usage) {
  switch (resource) {
    case 'clients': return usage.clients;
    case 'invoicesPerMonth': return usage.invoicesThisMonth;
    case 'members': return usage.members + usage.pendingInvites;
    default: return 0;
  }
}

export function enforceLimit(resource) {
  return async (req, _res, next) => {
    try {
      const db = getDb();
      const { plan } = await planForWorkspace(db, req.workspaceId);
      const limit = plan.limits[resource];
      const used = usedFor(resource, await computeUsage(db, req.workspaceId));
      if (!withinLimit(used, limit)) {
        throw new HttpError(
          402,
          `You've reached your ${plan.name} plan limit for ${resource} (${limit}). Upgrade to add more.`,
          { code: 'plan_limit', resource, limit, used, plan: plan.id }
        );
      }
      next();
    } catch (e) { next(e); }
  };
}

export function requireFeature(feature) {
  return async (req, _res, next) => {
    try {
      const { plan } = await planForWorkspace(getDb(), req.workspaceId);
      if (!plan.features[feature]) {
        throw new HttpError(402, `The "${feature}" feature isn't included in your ${plan.name} plan.`,
          { code: 'feature_locked', feature, plan: plan.id });
      }
      next();
    } catch (e) { next(e); }
  };
}

export default { planForWorkspace, computeUsage, entitlementsSnapshot, enforceLimit, requireFeature };
