import React, { useMemo, useState } from 'react';
import {
  LineChart as LineIcon, TrendingDown, AlertTriangle, Wallet, CalendarClock, Lightbulb,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import StatCard from '../components/UI/StatCard';
import { forecast } from '../services/cashflow';
import { buildSnapshot } from '../services/guardrailSnapshot';

const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

export default function CashFlow() {
  const { state, dispatch, addToast } = useData();
  const settings = state.settings || {};
  const snap = useMemo(() => buildSnapshot(state), [state]);

  const [opening, setOpening] = useState(0);
  const [floor, setFloor] = useState(settings.monthlyFloor ?? 50000);
  const [months, setMonths] = useState(6);

  const fc = useMemo(
    () => forecast(state, {
      months: Number(months),
      monthlyFloor: Number(floor) || 0,
      openingBalance: Number(opening) || 0,
      taxLiability: snap.taxLiability,
      is44ADA: snap.using44ADA && snap._eligible44ADA,
    }),
    [state, months, floor, opening, snap]
  );

  const maxAbs = Math.max(1, ...fc.months.map((m) => Math.abs(m.runningBalance)));

  const saveFloor = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { monthlyFloor: Number(floor) || 0 } });
    addToast('Monthly floor saved');
  };

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <LineIcon className="w-6 h-6 text-accent" /> Cash-Flow Forecast
        </h1>
        <p className="text-sm text-dark-300 mt-1">
          Built for feast-or-famine income. Projects inflow from open invoices, recurring retainers and weighted pipeline, overlays advance-tax due dates, and tells you exactly how much to invoice to stay solvent.
        </p>
      </div>

      {/* Controls */}
      <div className="glass-card p-5 grid sm:grid-cols-4 gap-4">
        <div>
          <label className="input-label">Opening balance</label>
          <input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Monthly survival floor</label>
          <div className="flex gap-2">
            <input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} />
            <button onClick={saveFloor} className="btn-secondary whitespace-nowrap">Save</button>
          </div>
        </div>
        <div>
          <label className="input-label">Horizon</label>
          <select value={months} onChange={(e) => setMonths(e.target.value)}>
            <option value={4}>4 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>
        <div className="flex items-end">
          <p className="text-xs text-dark-400">Advance-tax liability used: <b className="text-dark-100">{inr(snap.taxLiability)}</b> {snap.using44ADA && snap._eligible44ADA ? '(44ADA, 15 Mar)' : '(4 instalments)'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} color={fc.lowestBalance < 0 ? 'red' : 'green'} label="Lowest projected balance" value={inr(fc.lowestBalance)} />
        <StatCard icon={TrendingDown} color={fc.mustInvoice > 0 ? 'amber' : 'green'} label="Must invoice (30 days)" value={inr(fc.mustInvoice)} />
        <StatCard icon={AlertTriangle} color={fc.shortfallMonths.length ? 'red' : 'green'} label="Shortfall months" value={fc.shortfallMonths.length} subValue={fc.shortfallMonths.join(', ') || 'None'} />
        <StatCard icon={CalendarClock} color="accent" label="Horizon" value={`${months} mo`} />
      </div>

      {/* Suggestion */}
      <div className={`glass-card p-4 flex items-start gap-3 ${fc.mustInvoice > 0 ? 'border-amber-500/30' : 'border-accent/20'}`}>
        <Lightbulb className={`w-5 h-5 flex-shrink-0 mt-0.5 ${fc.mustInvoice > 0 ? 'text-amber-400' : 'text-accent'}`} />
        <p className="text-sm text-dark-100">{fc.suggestion}</p>
      </div>

      {/* Running balance bars */}
      <div className="glass-card p-5">
        <h3 className="section-title mb-4">Projected running balance</h3>
        <div className="space-y-3">
          {fc.months.map((m) => {
            const pct = (Math.abs(m.runningBalance) / maxAbs) * 100;
            const neg = m.runningBalance < 0;
            return (
              <div key={m.label} className="flex items-center gap-3">
                <span className="w-14 text-xs text-dark-300 flex-shrink-0">{m.label}</span>
                <div className="flex-1 h-7 bg-dark-700/40 rounded-md relative overflow-hidden">
                  <div
                    className={`h-full rounded-md ${neg ? 'bg-red-500/40' : 'bg-accent/40'}`}
                    style={{ width: `${Math.max(3, pct)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-dark-50">
                    {inr(m.runningBalance)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed table */}
      <div className="glass-card p-5 overflow-x-auto custom-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header border-b border-dark-600">
              <th className="text-left py-2">Month</th>
              <th className="text-right py-2">Expected in</th>
              <th className="text-right py-2">Floor</th>
              <th className="text-right py-2">Advance tax</th>
              <th className="text-right py-2">Net</th>
              <th className="text-right py-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {fc.months.map((m) => (
              <tr key={m.label} className="border-b border-dark-700/50">
                <td className="py-2 text-dark-100">{m.label}</td>
                <td className="py-2 text-right text-dark-200">{inr(m.expectedIn)}</td>
                <td className="py-2 text-right text-dark-400">-{inr(m.floor)}</td>
                <td className="py-2 text-right text-dark-400">{m.taxDue ? '-' + inr(m.taxDue) : '—'}</td>
                <td className={`py-2 text-right ${m.net < 0 ? 'text-red-400' : 'text-dark-100'}`}>{inr(m.net)}</td>
                <td className={`py-2 text-right font-semibold ${m.runningBalance < 0 ? 'text-red-400' : 'text-accent'}`}>{inr(m.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-dark-400 mt-3">Pipeline is weighted by stage (proposal 40%, negotiation 60%). Tune your monthly floor to reflect real living + business costs.</p>
      </div>
    </div>
  );
}
