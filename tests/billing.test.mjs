// Billing + entitlements: default Free plan, limit math, lapsed-plan fallback,
// webhook signature verification, and webhook → subscription state.
// Run: node tests/billing.test.mjs
process.env.JWT_SECRET = 'test-secret-please-change';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';

import crypto from 'node:crypto';
import { createMemoryDb, _setDbForTests } from '../server/db/index.js';
import * as repo from '../server/db/repos.js';
import { hashPassword } from '../server/lib/auth.js';
import { getPlan, effectivePlanId, withinLimit } from '../server/lib/plans.js';
import { entitlementsSnapshot, computeUsage } from '../server/lib/entitlements.js';
import { verifyRazorpaySignature, applyBillingWebhook } from '../server/lib/billingWebhook.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

const db = createMemoryDb();
_setDbForTests(db);

function makeWorkspace(name) {
  const now = new Date().toISOString();
  const user = { id: crypto.randomUUID(), email: `${name}@x.in`, password_hash: hashPassword('password123'), name, created_at: now, updated_at: now };
  const ws = { id: crypto.randomUUID(), name: `${name} WS`, owner_user_id: user.id };
  db.tx((tx) => {
    repo.insertUser(tx, user);
    repo.insertWorkspace(tx, ws);
    repo.insertMembership(tx, { id: crypto.randomUUID(), workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now });
  });
  return { user, ws };
}

console.log('— Default plan is Free —');
const A = makeWorkspace('alpha');
let snap = entitlementsSnapshot(db, A.ws.id);
ok('no row defaults to free/active', snap.effectivePlan === 'free' && snap.subscription.status === 'active');
ok('free limits', snap.limits.clients === 5 && snap.limits.invoicesPerMonth === 10 && snap.limits.members === 1);
ok('free has AI locked, cross-border on', snap.features.aiAssistant === false && snap.features.crossBorder === true);

console.log('— Limit math —');
for (let i = 0; i < 5; i++) repo.createClient(db, A.ws.id, { name: `Client ${i}` });
const usage = computeUsage(db, A.ws.id);
ok('5 clients counted', usage.clients === 5);
ok('free client cap reached at 5', withinLimit(usage.clients, getPlan('free').limits.clients) === false);
ok('member seat cap: owner alone fills free (1)', withinLimit(usage.members + usage.pendingInvites, getPlan('free').limits.members) === false);

console.log('— Upgrade unlocks capacity —');
repo.upsertSubscription(db, A.ws.id, { plan: 'pro', status: 'active' });
snap = entitlementsSnapshot(db, A.ws.id);
ok('pro effective + AI unlocked', snap.effectivePlan === 'pro' && snap.features.aiAssistant === true);
ok('pro clients unlimited', withinLimit(9999, getPlan('pro').limits.clients) === true);

console.log('— Lapsed subscription falls back to Free entitlements —');
ok('halted pro → free entitlements', effectivePlanId({ plan: 'pro', status: 'halted' }) === 'free');
ok('cancelled team → free entitlements', effectivePlanId({ plan: 'team', status: 'cancelled' }) === 'free');
ok('past_due keeps entitlements (grace)', effectivePlanId({ plan: 'pro', status: 'past_due' }) === 'pro');

console.log('— Webhook signature verification —');
const body = { event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_123', notes: { workspaceId: A.ws.id, plan: 'team' }, current_end: Math.floor(Date.now() / 1000) + 2592000 } } } };
const raw = Buffer.from(JSON.stringify(body));
const sig = crypto.createHmac('sha256', 'whsec_test').update(raw).digest('hex');
ok('valid signature accepted', verifyRazorpaySignature(raw, sig, 'whsec_test') === true);
ok('tampered signature rejected', verifyRazorpaySignature(raw, sig.slice(0, -2) + 'ff', 'whsec_test') === false);
ok('wrong secret rejected', verifyRazorpaySignature(raw, sig, 'nope') === false);
ok('missing secret rejected', verifyRazorpaySignature(raw, sig, '') === false);

console.log('— Webhook drives subscription state —');
const r1 = applyBillingWebhook(db, body);
ok('activated → active + plan from notes', r1.applied && r1.applied.status === 'active' && r1.applied.plan === 'team');
ok('current_period_end set from current_end', !!r1.applied.current_period_end);

repo.upsertSubscription(db, A.ws.id, { provider: 'razorpay', provider_subscription_id: 'sub_777' });
const byId = applyBillingWebhook(db, { event: 'subscription.charged', payload: { subscription: { entity: { id: 'sub_777' } } } });
ok('resolves workspace by provider id when notes absent', byId.wsId === A.ws.id && byId.applied.status === 'active');

const cancelled = applyBillingWebhook(db, { event: 'subscription.cancelled', payload: { subscription: { entity: { id: 'sub_777', notes: { workspaceId: A.ws.id } } } } });
ok('cancelled event → cancelled status', cancelled.applied.status === 'cancelled');
ok('unknown event is logged but applies no status', applyBillingWebhook(db, { event: 'subscription.weird', payload: { subscription: { entity: { id: 'sub_777' } } } }).applied === null);
ok('billing_events are recorded', db.get('SELECT COUNT(*) AS n FROM billing_events WHERE workspace_id = ?', [A.ws.id]).n >= 3);

console.log('— Tenant isolation of subscriptions —');
const B = makeWorkspace('beta');
ok('other workspace still free', entitlementsSnapshot(db, B.ws.id).effectivePlan === 'free');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
