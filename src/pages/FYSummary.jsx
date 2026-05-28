// ==========================================
// FreelanceOS — FY Summary Page
// ==========================================
import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR, calculateGST, getCurrentFY } from '../utils/helpers';
import {
  CalendarClock, IndianRupee, Wallet, Calculator,
  TrendingUp, FileText, Receipt, Clock,
} from 'lucide-react';

function getInvoiceTotal(inv) {
  if (inv.total) return inv.total;
  const subtotal = (inv.lineItems || []).reduce((s, li) => s + li.quantity * li.rate, 0);
  const gst = calculateGST(subtotal, inv.gstRate || 18, inv.isInterState || false);
  return gst.total;
}

export default function FYSummary() {
  const { state } = useData();
  const fy = getCurrentFY();

  // Filter invoices for current FY
  const fyInvoices = useMemo(() => {
    const start = new Date(fy.start, 3, 1); // April 1
    const end = new Date(fy.end, 2, 31); // March 31
    return state.invoices.filter(inv => {
      const d = new Date(inv.date);
      return d >= start && d <= end;
    });
  }, [state.invoices, fy]);

  const fyExpenses = useMemo(() => {
    const start = new Date(fy.start, 3, 1);
    const end = new Date(fy.end, 2, 31);
    return state.expenses.filter(exp => {
      const d = new Date(exp.date);
      return d >= start && d <= end;
    });
  }, [state.expenses, fy]);

  const stats = useMemo(() => {
    const totalRevenue = fyInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
    const paidRevenue = fyInvoices.filter(i => i.status === 'Paid').reduce((s, inv) => s + getInvoiceTotal(inv), 0);
    const pendingRevenue = totalRevenue - paidRevenue;
    const totalExpenses = fyExpenses.reduce((s, exp) => s + (exp.amount || 0), 0);
    const taxDeductible = fyExpenses.filter(e => e.taxDeductible).reduce((s, e) => s + (e.amount || 0), 0);
    const netIncome = paidRevenue - totalExpenses;

    // Monthly breakdown
    const months = {};
    fyInvoices.forEach(inv => {
      const d = new Date(inv.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { revenue: 0, invoices: 0 };
      months[key].revenue += getInvoiceTotal(inv);
      months[key].invoices += 1;
    });

    return { totalRevenue, paidRevenue, pendingRevenue, totalExpenses, taxDeductible, netIncome, invoiceCount: fyInvoices.length, months };
  }, [fyInvoices, fyExpenses]);

  const summaryCards = [
    { label: 'Total Revenue', value: formatINR(stats.totalRevenue), sub: `${stats.invoiceCount} invoices`, icon: IndianRupee, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Collected', value: formatINR(stats.paidRevenue), sub: 'Paid invoices', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Pending', value: formatINR(stats.pendingRevenue), sub: 'Awaiting payment', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Expenses', value: formatINR(stats.totalExpenses), sub: `₹${Math.round(stats.taxDeductible).toLocaleString('en-IN')} deductible`, icon: Wallet, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Net Income', value: formatINR(stats.netIncome), sub: 'Revenue - Expenses', icon: Calculator, color: stats.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400', bg: stats.netIncome >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
  ];

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-accent" />
          FY Summary
        </h1>
        <p className="text-sm text-dark-300 mt-0.5">Financial year overview — {fy.label} (Apr {fy.start} – Mar {fy.end})</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryCards.map((card, i) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-xs text-dark-400">{card.label}</p>
            <p className={`text-lg font-bold ${card.color} mt-0.5`}>{card.value}</p>
            <p className="text-xs text-dark-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly Breakdown */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-dark-600/30">
          <h3 className="text-sm font-semibold text-dark-100">Monthly Revenue Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600/20">
                <th className="table-header px-4 py-3 text-left">Month</th>
                <th className="table-header px-4 py-3 text-right">Revenue</th>
                <th className="table-header px-4 py-3 text-right">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.months).sort(([a], [b]) => a.localeCompare(b)).map(([key, data]) => {
                const [year, month] = key.split('-');
                const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                return (
                  <tr key={key} className="border-b border-dark-600/10 hover:bg-dark-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-dark-100">{monthName}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-dark-50 text-right">{formatINR(data.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-dark-300 text-right">{data.invoices}</td>
                  </tr>
                );
              })}
              {Object.keys(stats.months).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-dark-400 text-sm">No invoices in this financial year</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Categories */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-dark-600/30">
          <h3 className="text-sm font-semibold text-dark-100">Expense Categories</h3>
        </div>
        <div className="p-5">
          {(() => {
            const cats = {};
            fyExpenses.forEach(exp => {
              const cat = exp.category || 'Other';
              if (!cats[cat]) cats[cat] = 0;
              cats[cat] += exp.amount || 0;
            });
            const entries = Object.entries(cats).sort(([, a], [, b]) => b - a);
            if (entries.length === 0) return <p className="text-sm text-dark-400 text-center py-4">No expenses recorded this FY</p>;
            return (
              <div className="space-y-3">
                {entries.map(([cat, amount]) => {
                  const pct = stats.totalExpenses > 0 ? (amount / stats.totalExpenses) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-dark-200">{cat}</span>
                        <span className="text-dark-100 font-medium">{formatINR(amount)}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-dark-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent to-amber-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

