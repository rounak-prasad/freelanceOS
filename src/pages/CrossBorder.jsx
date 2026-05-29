import React, { useMemo, useState } from 'react';
import {
  Globe, Calculator, Plus, Trash2, FileCheck, AlertTriangle,
  TrendingDown, BadgeIndianRupee, Banknote, ShieldAlert, Clock,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import StatCard from '../components/UI/StatCard';
import { compareAll, computeNet, PROVIDERS, PURPOSE_CODES } from '../services/fxLeakage';
import { FOREIGN_ACCOUNT_PLATFORMS } from '../services/complianceEngine';
import APP_CONFIG from '../config/appConfig';

const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export default function CrossBorder() {
  const { state, dispatch, addToast } = useData();
  const foreignAccounts = state.foreignAccounts || [];
  const remittances = state.remittances || [];

  /* ---- FX leakage calculator ---- */
  const [usd, setUsd] = useState(2000);
  const [rate, setRate] = useState(APP_CONFIG.defaultUsdInr || 86);
  const comparison = useMemo(() => compareAll(Number(usd) || 0, Number(rate) || 0), [usd, rate]);

  /* ---- Remittance + FIRA tracker ---- */
  const totalReceived = remittances.reduce((s, r) => s + (Number(r.netInr) || 0), 0);
  const pendingFira = remittances.filter((r) => r.firaStatus !== 'received').length;

  const [rem, setRem] = useState({ clientName: '', amountUSD: '', provider: 'skydo', purposeCode: 'P0802' });
  const addRemittance = () => {
    const amt = Number(rem.amountUSD) || 0;
    if (!rem.clientName || amt <= 0) return addToast('Enter client and USD amount', 'error');
    const provider = PROVIDERS.find((p) => p.id === rem.provider) || PROVIDERS[0];
    const net = computeNet(amt, Number(rate) || 0, provider);
    dispatch({
      type: 'ADD_REMITTANCE',
      payload: {
        id: uid(),
        date: new Date().toISOString(),
        clientName: rem.clientName,
        amountUSD: amt,
        usdInr: Number(rate) || 0,
        provider: rem.provider,
        purposeCode: rem.purposeCode,
        netInr: net.net,
        feeInr: net.totalCost,
        firaStatus: 'pending',
        firaRef: '',
      },
    });
    setRem({ clientName: '', amountUSD: '', provider: rem.provider, purposeCode: rem.purposeCode });
    addToast('Remittance logged');
  };

  const addAccount = (platform) => {
    if (!platform) return;
    dispatch({ type: 'ADD_FOREIGN_ACCOUNT', payload: { id: uid(), platform, active: true } });
    addToast('Foreign account added — Schedule FA check updated');
  };

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6 text-accent" /> Cross-Border &amp; FIRA
        </h1>
        <p className="text-sm text-dark-300 mt-1">
          Stop the silent leak on foreign-client payments. Compare rails, log inward remittances with RBI purpose codes, and track FIRA/FIRC — the export-of-service proof you need for zero-rated GST.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Banknote} color="accent" label="Total received (INR)" value={inr(totalReceived)} />
        <StatCard icon={Clock} color={pendingFira ? 'amber' : 'green'} label="FIRA pending" value={pendingFira} subValue={`${remittances.length} remittances`} />
        <StatCard icon={TrendingDown} color="green" label="Best-vs-worst gap" value={inr(comparison.gap)} subValue={`per $1,000: ${inr(comparison.gapPer1000)}`} />
        <StatCard icon={ShieldAlert} color={foreignAccounts.length ? 'amber' : 'blue'} label="Foreign accounts" value={foreignAccounts.length} subValue={foreignAccounts.length ? 'Schedule FA applies' : 'None'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* FX leakage calculator */}
        <div className="glass-card p-5">
          <h3 className="section-title mb-4 flex items-center gap-2"><Calculator className="w-4 h-4 text-accent" /> What you actually receive</h3>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="input-label">Invoice (USD)</label>
              <input type="number" value={usd} onChange={(e) => setUsd(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="input-label">USD → INR (mid-market)</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header border-b border-dark-600">
                  <th className="text-left py-2">Provider</th>
                  <th className="text-right py-2">Cost</th>
                  <th className="text-right py-2">You get</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((r, i) => (
                  <tr key={r.providerId} className={`border-b border-dark-700/50 ${i === 0 ? 'bg-accent/5' : ''}`}>
                    <td className="py-2">
                      <span className="text-dark-50 font-medium">{r.providerName}</span>
                      {i === 0 && <span className="badge bg-accent/10 text-accent ml-2">Best</span>}
                      {!r.firaIncluded && <span className="badge bg-amber-500/10 text-amber-400 ml-2">FIRA extra</span>}
                    </td>
                    <td className="text-right text-dark-300">{inr(r.totalCost)}<span className="text-dark-500 text-xs"> ({(r.effectivePct * 100).toFixed(1)}%)</span></td>
                    <td className="text-right font-semibold text-dark-50">{inr(r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-dark-400 mt-3">
            Choosing <b className="text-accent">{comparison.best?.providerName}</b> over <b className="text-red-400">{comparison.worst?.providerName}</b> saves <b className="text-dark-100">{inr(comparison.gap)}</b> on this ${usd} invoice. Rates indicative — confirm live pricing.
          </p>
        </div>

        {/* Foreign accounts */}
        <div className="glass-card p-5">
          <h3 className="section-title mb-1 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-accent" /> Foreign accounts</h3>
          <p className="text-xs text-dark-400 mb-4">Holding any of these is a foreign asset — it forces Schedule FA disclosure (ITR-3). We surface that on Compliance Guard.</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {FOREIGN_ACCOUNT_PLATFORMS.map((p) => (
              <button key={p} onClick={() => addAccount(p)} className="btn-secondary capitalize flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> {p}
              </button>
            ))}
          </div>
          {foreignAccounts.length === 0 ? (
            <p className="text-sm text-dark-400">No foreign accounts recorded.</p>
          ) : (
            <ul className="space-y-2">
              {foreignAccounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between bg-dark-700/40 rounded-lg px-3 py-2">
                  <span className="text-sm text-dark-100 capitalize">{a.platform}</span>
                  <button onClick={() => dispatch({ type: 'DELETE_FOREIGN_ACCOUNT', payload: a.id })} className="text-dark-400 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {foreignAccounts.length > 0 && (
            <div className="mt-4 flex items-start gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Schedule FA disclosure required. Plan for ITR-3 and disclose every account — non-disclosure carries Black Money Act penalties.
            </div>
          )}
        </div>
      </div>

      {/* Remittance + FIRA tracker */}
      <div className="glass-card p-5">
        <h3 className="section-title mb-4 flex items-center gap-2"><FileCheck className="w-4 h-4 text-accent" /> Inward remittance &amp; FIRA tracker</h3>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <input placeholder="Client" value={rem.clientName} onChange={(e) => setRem({ ...rem, clientName: e.target.value })} />
          <input type="number" placeholder="Amount (USD)" value={rem.amountUSD} onChange={(e) => setRem({ ...rem, amountUSD: e.target.value })} />
          <select value={rem.provider} onChange={(e) => setRem({ ...rem, provider: e.target.value })}>
            {comparison.rows.map((r) => <option key={r.providerId} value={r.providerId}>{r.providerName}</option>)}
          </select>
          <select value={rem.purposeCode} onChange={(e) => setRem({ ...rem, purposeCode: e.target.value })}>
            {PURPOSE_CODES.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.label}</option>)}
          </select>
          <button onClick={addRemittance} className="btn-primary flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Log</button>
        </div>

        {remittances.length === 0 ? (
          <p className="text-sm text-dark-400">No remittances logged yet. Add one above to start tracking FIRA.</p>
        ) : (
          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header border-b border-dark-600">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Client</th>
                  <th className="text-right py-2">USD</th>
                  <th className="text-left py-2 pl-3">Purpose</th>
                  <th className="text-center py-2">FIRA</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {remittances.map((r) => (
                  <tr key={r.id} className="border-b border-dark-700/50">
                    <td className="py-2 text-dark-300">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                    <td className="py-2 text-dark-100">{r.clientName}</td>
                    <td className="py-2 text-right text-dark-100">${Number(r.amountUSD).toLocaleString()}</td>
                    <td className="py-2 pl-3 text-dark-400">{r.purposeCode}</td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => dispatch({ type: 'UPDATE_REMITTANCE', payload: { id: r.id, firaStatus: r.firaStatus === 'received' ? 'pending' : 'received' } })}
                        className={`badge ${r.firaStatus === 'received' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}
                      >
                        {r.firaStatus === 'received' ? 'Received' : 'Pending'}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => dispatch({ type: 'DELETE_REMITTANCE', payload: r.id })} className="text-dark-400 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-dark-400 mt-3">
          FIRA/FIRC proves export of services for 0% GST under LUT. Skydo &amp; Razorpay issue it free/instantly; banks charge ₹200–500 and take days. Keep every FIRA against its remittance for GST and ITR.
        </p>
      </div>
    </div>
  );
}
