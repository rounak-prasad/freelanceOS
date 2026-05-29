// ==========================================
// FreelanceOS — Billing & Plan (cloud/auth mode)
// Talks to /api/billing: current plan, live usage vs. limits, upgrade/cancel.
// ==========================================
import React, { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost } from '../services/apiClient';
import { CreditCard, Check, Loader2, AlertCircle, BadgeCheck, Sparkles } from 'lucide-react';

const rupees = (minor) => `₹${(Number(minor || 0) / 100).toLocaleString('en-IN')}`;
const cap = (v) => (v === null || v === undefined ? 'Unlimited' : v);
const titleCase = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

const FEATURE_LABELS = {
  aiAssistant: 'AI assistant',
  crossBorder: 'Cross-border & FIRA',
  eInvoicing: 'GST e-invoicing',
  prioritySupport: 'Priority support',
  removeBranding: 'Remove FreelanceOS branding',
};

function UsageBar({ label, used, limit }) {
  const unlimited = limit === null || limit === undefined;
  const pct = unlimited ? 12 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const near = !unlimited && pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-dark-200">{label}</span>
        <span className={near ? 'text-red-400 font-medium' : 'text-dark-300'}>{used}{unlimited ? '' : ` / ${limit}`}</span>
      </div>
      <div className="h-2 rounded-full bg-dark-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${near ? 'bg-red-400' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Billing() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setError(null);
    apiGet('/billing').then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function choosePlan(planId) {
    setBusy(planId); setError(null); setNotice('');
    try {
      const res = await apiPost('/billing/checkout', { plan: planId });
      if (res?.shortUrl) {
        window.open(res.shortUrl, '_blank', 'noopener,noreferrer');
        setNotice('Complete the secure Razorpay checkout in the new tab, then refresh.');
      } else if (res?.testMode) {
        setNotice(`Activated "${titleCase(planId)}" in test mode (no Razorpay keys configured).`);
      } else {
        setNotice('Plan updated.');
      }
      load();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  async function cancelPlan() {
    setBusy('cancel'); setError(null); setNotice('');
    try { await apiPost('/billing/cancel', {}); setNotice('Your subscription has been cancelled.'); load(); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  if (!data && error) {
    return (
      <div className="max-w-md mx-auto mt-20 glass-card p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-dark-200 text-sm">{error}</p>
        <p className="text-dark-400 text-xs">Billing is available when the app runs against the API server (cloud mode).</p>
        <button onClick={load} className="btn-secondary">Retry</button>
      </div>
    );
  }
  if (!data) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;
  }

  const { subscription, effectivePlan, limits, usage, plans = [] } = data;
  const isLapsed = ['halted', 'cancelled'].includes(subscription.status);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 flex items-center gap-2"><CreditCard className="w-6 h-6 text-accent" /> Billing & Plan</h1>
        <p className="text-dark-300 text-sm mt-1">Manage your subscription, usage and seats.</p>
      </div>

      {notice && <div className="glass-card p-3 text-sm text-accent border-accent/20 flex items-center gap-2"><BadgeCheck className="w-4 h-4" /> {notice}</div>}
      {error && <div className="glass-card p-3 text-sm text-red-400 border-red-500/20 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {/* Current plan + usage */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="badge bg-accent/15 text-accent text-sm px-3 py-1">{titleCase(effectivePlan)} plan</span>
            <span className={`badge ${isLapsed ? 'bg-red-500/15 text-red-400' : 'bg-dark-700 text-dark-200'}`}>{titleCase(subscription.status)}</span>
            {subscription.provider && <span className="text-xs text-dark-400">via {subscription.provider}</span>}
          </div>
          {effectivePlan !== 'free' && !isLapsed && (
            <button onClick={cancelPlan} disabled={busy === 'cancel'} className="btn-danger">
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
            </button>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          <UsageBar label="Clients" used={usage.clients} limit={limits.clients} />
          <UsageBar label="Invoices this month" used={usage.invoicesThisMonth} limit={limits.invoicesPerMonth} />
          <UsageBar label="Team seats" used={usage.members + usage.pendingInvites} limit={limits.members} />
        </div>
      </div>

      {/* Plan catalog */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const current = p.id === effectivePlan;
          return (
            <div key={p.id} className={`glass-card p-5 flex flex-col ${current ? 'border-accent/40 ring-1 ring-accent/20' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="section-title">{p.name}</h3>
                {p.id !== 'free' && <Sparkles className="w-4 h-4 text-accent" />}
              </div>
              <p className="text-dark-400 text-xs mt-1 min-h-[2rem]">{p.tagline}</p>
              <div className="mt-3 mb-4">
                <span className="text-3xl font-bold text-dark-50">{p.priceMonthlyMinor ? rupees(p.priceMonthlyMinor) : '₹0'}</span>
                <span className="text-dark-400 text-sm">/mo</span>
              </div>
              <ul className="space-y-2 text-sm text-dark-200 flex-1">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> {cap(p.limits.clients)} clients</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> {cap(p.limits.invoicesPerMonth)} invoices/mo</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> {cap(p.limits.members)} team seat{p.limits.members === 1 ? '' : 's'}</li>
                {Object.entries(p.features).filter(([, on]) => on).map(([k]) => (
                  <li key={k} className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> {FEATURE_LABELS[k] || k}</li>
                ))}
              </ul>
              <button
                onClick={() => choosePlan(p.id)}
                disabled={current || busy === p.id}
                className={`mt-5 ${current ? 'btn-secondary opacity-60 cursor-default' : 'btn-primary'}`}
              >
                {current ? 'Current plan' : busy === p.id ? 'Working…' : p.id === 'free' ? 'Downgrade' : `Upgrade to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-dark-400">
        Payments are processed securely by Razorpay. Prices in INR, billed monthly. You can cancel anytime —
        your data stays accessible on the Free plan.
      </p>
    </div>
  );
}
