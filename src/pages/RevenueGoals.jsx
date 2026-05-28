// ==========================================
// FreelanceOS — Revenue Goals Page
// ==========================================
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR, calculateGST, getCurrentFY } from '../utils/helpers';
import {
  Target, Save, TrendingUp, Calendar, IndianRupee,
} from 'lucide-react';

function getInvoiceTotal(inv) {
  if (inv.total) return inv.total;
  const subtotal = (inv.lineItems || []).reduce((s, li) => s + li.quantity * li.rate, 0);
  const gst = calculateGST(subtotal, inv.gstRate || 18, inv.isInterState || false);
  return gst.total;
}

export default function RevenueGoals() {
  const { state, dispatch, addToast } = useData();
  const fy = getCurrentFY();
  const goals = state.revenueGoals || state.settings.revenueGoals || { monthly: 150000, quarterly: 450000, annual: 1800000 };

  const [monthly, setMonthly] = useState(goals.monthly);
  const [quarterly, setQuarterly] = useState(goals.quarterly);
  const [annual, setAnnual] = useState(goals.annual);

  function handleMonthlyChange(val) {
    const v = Number(val) || 0;
    setMonthly(v);
    setQuarterly(v * 3);
    setAnnual(v * 12);
  }

  function saveGoals() {
    dispatch({ type: 'UPDATE_REVENUE_GOALS', payload: { monthly, quarterly, annual } });
    addToast('Revenue goals saved!');
  }

  // Calculate actual revenue
  const revenue = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // This month
    const thisMonthRevenue = state.invoices
      .filter(inv => {
        const d = new Date(inv.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((s, inv) => s + getInvoiceTotal(inv), 0);

    // Indian FY quarter
    // Apr-Jun = Q1, Jul-Sep = Q2, Oct-Dec = Q3, Jan-Mar = Q4
    let qStart, qEnd, qLabel;
    if (currentMonth >= 3 && currentMonth <= 5) {
      qStart = new Date(currentYear, 3, 1); qEnd = new Date(currentYear, 5, 30);
      qLabel = `Q1 Apr–Jun ${currentYear}`;
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      qStart = new Date(currentYear, 6, 1); qEnd = new Date(currentYear, 8, 30);
      qLabel = `Q2 Jul–Sep ${currentYear}`;
    } else if (currentMonth >= 9 && currentMonth <= 11) {
      qStart = new Date(currentYear, 9, 1); qEnd = new Date(currentYear, 11, 31);
      qLabel = `Q3 Oct–Dec ${currentYear}`;
    } else {
      qStart = new Date(currentYear, 0, 1); qEnd = new Date(currentYear, 2, 31);
      qLabel = `Q4 Jan–Mar ${currentYear}`;
    }

    const quarterRevenue = state.invoices
      .filter(inv => {
        const d = new Date(inv.date);
        return d >= qStart && d <= qEnd;
      })
      .reduce((s, inv) => s + getInvoiceTotal(inv), 0);

    // FY revenue
    const fyStart = new Date(fy.start, 3, 1);
    const fyEnd = new Date(fy.end, 2, 31);
    const fyRevenue = state.invoices
      .filter(inv => {
        const d = new Date(inv.date);
        return d >= fyStart && d <= fyEnd;
      })
      .reduce((s, inv) => s + getInvoiceTotal(inv), 0);

    const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return { thisMonthRevenue, quarterRevenue, fyRevenue, monthName, qLabel };
  }, [state.invoices, fy]);

  function ProgressCard({ title, subtitle, earned, target, icon: Icon }) {
    const pct = target > 0 ? Math.round((earned / target) * 100) : 0;
    const exceeded = earned > target;
    const diff = Math.abs(earned - target);

    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-dark-100">{title}</h3>
            <p className="text-xs text-dark-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-end justify-between mb-2">
          <p className="text-2xl font-bold text-dark-50">{formatINR(earned)}</p>
          <span className={`text-sm font-bold ${exceeded ? 'text-emerald-400' : 'text-accent'}`}>{pct}%</span>
        </div>

        <div className="w-full h-3 rounded-full bg-dark-700 overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-700 ${exceeded ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-accent to-amber-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        <p className="text-xs">
          {exceeded ? (
            <span className="text-emerald-400">Exceeded by {formatINR(diff)} 🎉</span>
          ) : (
            <span className="text-red-400">{formatINR(diff)} remaining</span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <Target className="w-6 h-6 text-accent" />
          Revenue Goals
        </h1>
        <p className="text-sm text-dark-300 mt-0.5">Set monthly, quarterly, and annual revenue targets and track your progress.</p>
      </div>

      {/* Set Targets */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-dark-100 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" /> Set Targets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="input-label">Monthly Target (₹)</label>
            <input type="number" value={monthly} onChange={e => handleMonthlyChange(e.target.value)} min="0" className="w-full" />
          </div>
          <div>
            <label className="input-label">Quarterly Target (₹)</label>
            <input type="number" value={quarterly} onChange={e => setQuarterly(Number(e.target.value))} min="0" className="w-full" />
            <p className="text-xs text-dark-400 mt-1">Auto: Monthly × 3</p>
          </div>
          <div>
            <label className="input-label">Annual Target (₹)</label>
            <input type="number" value={annual} onChange={e => setAnnual(Number(e.target.value))} min="0" className="w-full" />
            <p className="text-xs text-dark-400 mt-1">Auto: Monthly × 12</p>
          </div>
        </div>
        <button onClick={saveGoals} className="btn-primary flex items-center gap-2 mt-4">
          <Save className="w-4 h-4" /> Save Goals
        </button>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProgressCard
          title={revenue.monthName}
          subtitle="This Month"
          earned={revenue.thisMonthRevenue}
          target={monthly}
          icon={Calendar}
        />
        <ProgressCard
          title={revenue.qLabel}
          subtitle="This Quarter"
          earned={revenue.quarterRevenue}
          target={quarterly}
          icon={TrendingUp}
        />
        <ProgressCard
          title={fy.label}
          subtitle="This Financial Year"
          earned={revenue.fyRevenue}
          target={annual}
          icon={IndianRupee}
        />
      </div>

      {/* Note */}
      <p className="text-xs text-dark-400 text-center">
        Revenue computed from all invoices by invoice date · {fy.label}
      </p>
    </div>
  );
}
