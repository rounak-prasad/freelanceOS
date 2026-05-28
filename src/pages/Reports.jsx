// ==========================================
// FreelanceOS — Reports & Analytics Page
// ==========================================
import React, { useMemo } from 'react';
import {
  TrendingUp, PieChart as PieChartIcon, BarChart3,
  Clock, IndianRupee, Users,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';
import { useData } from '../context/DataContext';
import { formatINR, formatHours } from '../utils/helpers';

// ---- Palette ----
const PIE_COLORS = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EF4444', '#06B6D4'];
const EXPENSE_COLORS = {
  Software: '#3B82F6',
  Office: '#A855F7',
  Travel: '#F59E0B',
  Internet: '#06B6D4',
  Hardware: '#22C55E',
  Marketing: '#EF4444',
  Other: '#737373',
};

// ---- Helpers ----
function invoiceTotal(inv) {
  return (inv.lineItems || []).reduce((s, li) => s + li.quantity * li.rate, 0);
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

// ---- Custom Tooltips ----
function AreaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 shadow-2xl">
      <p className="text-xs text-dark-400 mb-1">{label}</p>
      <p className="text-base font-semibold text-dark-50">
        {formatINR(payload[0].value)}
      </p>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 shadow-2xl">
      <p className="text-xs text-dark-400 mb-1">{payload[0].name}</p>
      <p className="text-base font-semibold text-dark-50">
        {formatINR(payload[0].value)}
      </p>
    </div>
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 shadow-2xl">
      <p className="text-xs text-dark-400 mb-1">{label}</p>
      <p className="text-base font-semibold text-dark-50">
        {formatINR(payload[0].value)}
      </p>
    </div>
  );
}

// ---- Metric Card ----
function MetricCard({ icon: Icon, label, value, sub, color = 'orange' }) {
  const colorMap = {
    orange: 'from-orange-500 to-amber-500',
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    purple: 'from-purple-500 to-pink-500',
  };
  const bg = colorMap[color] || colorMap.orange;

  return (
    <div className="glass-card p-5 flex items-start gap-4 group hover:border-accent/30 transition-all duration-300 hover:-translate-y-0.5">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-dark-400 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-xl font-bold text-dark-50 mt-1 truncate">{value}</p>
        {sub && <p className="text-xs text-dark-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ---- Custom Pie Legend ----
function CustomPieLegend({ payload }) {
  if (!payload?.length) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-1.5 text-xs text-dark-300">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

// ==========================================
// Main Component
// ==========================================
export default function Reports() {
  const { state } = useData();

  // ---- Key Metrics ----
  const metrics = useMemo(() => {
    const paidInvoices = state.invoices.filter(i => i.status === 'Paid');
    const totalRevenue = paidInvoices.reduce((s, i) => s + invoiceTotal(i), 0);
    const avgInvoiceValue = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

    // Average payment time
    const paymentTimes = paidInvoices
      .filter(i => i.paidDate && i.date)
      .map(i => daysBetween(i.date, i.paidDate));
    const avgPaymentTime = paymentTimes.length > 0
      ? Math.round(paymentTimes.reduce((s, d) => s + d, 0) / paymentTimes.length)
      : 0;

    // Billable hours
    const totalSeconds = (state.timeEntries || []).reduce((s, t) => s + (t.seconds || 0), 0);
    const totalHours = totalSeconds / 3600;

    // Effective hourly rate
    const effectiveRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    return { totalRevenue, avgInvoiceValue, avgPaymentTime, totalHours, effectiveRate, paidInvoices };
  }, [state.invoices, state.timeEntries]);

  // ---- Revenue Trend (from state.earnings) ----
  const revenueTrend = useMemo(() => state.earnings || [], [state.earnings]);

  // ---- Client Revenue Breakdown ----
  const clientRevenue = useMemo(() => {
    const map = {};
    metrics.paidInvoices.forEach(inv => {
      const name = inv.clientName || 'Unknown';
      map[name] = (map[name] || 0) + invoiceTotal(inv);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [metrics.paidInvoices]);

  // ---- Client Profitability ----
  const clientProfitability = useMemo(() => {
    const revenueMap = {};
    metrics.paidInvoices.forEach(inv => {
      const name = inv.clientName || 'Unknown';
      revenueMap[name] = (revenueMap[name] || 0) + invoiceTotal(inv);
    });

    const hoursMap = {};
    (state.timeEntries || []).forEach(t => {
      const name = t.clientName || 'Unknown';
      hoursMap[name] = (hoursMap[name] || 0) + (t.seconds || 0) / 3600;
    });

    const expenseMap = {};
    (state.expenses || []).forEach(e => {
      if (e.clientName) {
        expenseMap[e.clientName] = (expenseMap[e.clientName] || 0) + (e.amount || 0);
      }
    });

    const allClients = new Set([...Object.keys(revenueMap), ...Object.keys(hoursMap)]);
    const rows = Array.from(allClients).map(name => {
      const revenue = revenueMap[name] || 0;
      const hours = hoursMap[name] || 0;
      const expenses = expenseMap[name] || 0;
      const effectiveRate = hours > 0 ? revenue / hours : 0;
      return { name, revenue, hours, expenses, effectiveRate };
    });

    return rows.sort((a, b) => b.effectiveRate - a.effectiveRate);
  }, [metrics.paidInvoices, state.timeEntries, state.expenses]);

  // Best / worst effective rate
  const bestClient = clientProfitability.length > 0 ? clientProfitability[0].name : null;
  const worstClient = clientProfitability.length > 1 ? clientProfitability[clientProfitability.length - 1].name : null;

  // ---- Invoice Aging ----
  const invoiceAging = useMemo(() => {
    const now = new Date();
    const unpaid = state.invoices.filter(i => i.status !== 'Paid' && i.status !== 'Draft');
    const buckets = [
      { label: 'Current (0–30 days)', min: 0, max: 30, color: 'green', items: [] },
      { label: '30–60 days', min: 30, max: 60, color: 'amber', items: [] },
      { label: '60–90 days', min: 60, max: 90, color: 'orange', items: [] },
      { label: '90+ days', min: 90, max: Infinity, color: 'red', items: [] },
    ];

    unpaid.forEach(inv => {
      const age = Math.max(0, daysBetween(inv.date, now));
      const bucket = buckets.find(b => age >= b.min && age < b.max);
      if (bucket) bucket.items.push(inv);
    });

    return buckets.map(b => ({
      ...b,
      count: b.items.length,
      total: b.items.reduce((s, i) => s + invoiceTotal(i), 0),
    }));
  }, [state.invoices]);

  // ---- Expense Category Breakdown ----
  const expenseByCategory = useMemo(() => {
    const map = {};
    (state.expenses || []).forEach(e => {
      const cat = e.category || 'Other';
      map[cat] = (map[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [state.expenses]);

  // ---- Aging color classes ----
  const agingColorMap = {
    green: {
      bar: 'bg-green-500',
      badge: 'bg-green-500/10 text-green-400 border-green-500/20',
      text: 'text-green-400',
    },
    amber: {
      bar: 'bg-amber-500',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      text: 'text-amber-400',
    },
    orange: {
      bar: 'bg-orange-500',
      badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      text: 'text-orange-400',
    },
    red: {
      bar: 'bg-red-500',
      badge: 'bg-red-500/10 text-red-400 border-red-500/20',
      text: 'text-red-400',
    },
  };

  // Y-axis formatter
  const yAxisFmt = (v) =>
    v >= 100000
      ? `₹${(v / 100000).toFixed(1)}L`
      : v >= 1000
        ? `₹${(v / 1000).toFixed(0)}K`
        : `₹${v}`;

  return (
    <div className="page-enter space-y-6">
      {/* ═══════ Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            Reports & Analytics
            <BarChart3 className="w-6 h-6 text-accent opacity-70" />
          </h1>
          <p className="text-dark-400 mt-1">
            Financial year overview —{' '}
            <span className="text-dark-200">
              {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
          </p>
        </div>
        <p className="text-xs text-dark-500">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* ═══════ Key Metrics Row ═══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={IndianRupee}
          label="Avg Invoice Value"
          value={formatINR(metrics.avgInvoiceValue)}
          sub={`${metrics.paidInvoices.length} paid invoices`}
          color="orange"
        />
        <MetricCard
          icon={Clock}
          label="Avg Payment Time"
          value={`${metrics.avgPaymentTime} days`}
          sub="Invoice to payment"
          color="blue"
        />
        <MetricCard
          icon={TrendingUp}
          label="Total Billable Hours"
          value={formatHours(metrics.totalHours)}
          sub={`${(state.timeEntries || []).length} time entries`}
          color="green"
        />
        <MetricCard
          icon={Users}
          label="Effective Hourly Rate"
          value={formatINR(metrics.effectiveRate)}
          sub="Revenue ÷ hours"
          color="purple"
        />
      </div>

      {/* ═══════ Revenue Trend — Area Chart ═══════ */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold text-dark-100">Revenue Trend</h2>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#737373', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#737373', fontSize: 12 }}
                tickFormatter={yAxisFmt}
              />
              <Tooltip content={<AreaTooltip />} cursor={{ stroke: '#F97316', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#F97316"
                strokeWidth={2.5}
                fill="url(#areaGrad)"
                dot={{ fill: '#F97316', stroke: '#0F0F0F', strokeWidth: 2, r: 4 }}
                activeDot={{ fill: '#F97316', stroke: '#F59E0B', strokeWidth: 2, r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══════ Two-column: Client Revenue Pie + Expense Bar ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ---- Client Revenue Breakdown ---- */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-accent" />
            <h2 className="text-sm font-semibold text-dark-100">Client Revenue Breakdown</h2>
          </div>

          {clientRevenue.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={clientRevenue}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {clientRevenue.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend content={<CustomPieLegend />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-72 text-dark-500 text-sm">
              No paid invoices yet
            </div>
          )}
        </div>

        {/* ---- Expense Category Breakdown ---- */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h2 className="text-sm font-semibold text-dark-100">Expenses by Category</h2>
          </div>

          {expenseByCategory.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={expenseByCategory}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#737373', fontSize: 12 }}
                    tickFormatter={yAxisFmt}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#A3A3A3', fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(249,115,22,0.08)' }} />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {expenseByCategory.map((entry, i) => (
                      <Cell key={i} fill={EXPENSE_COLORS[entry.category] || EXPENSE_COLORS.Other} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-72 text-dark-500 text-sm">
              No expenses recorded
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Client Profitability Table ═══════ */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold text-dark-100">Client Profitability</h2>
        </div>

        {clientProfitability.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase tracking-wider">Client</th>
                  <th className="text-right py-3 px-4 text-dark-400 font-medium text-xs uppercase tracking-wider">Revenue</th>
                  <th className="text-right py-3 px-4 text-dark-400 font-medium text-xs uppercase tracking-wider">Hours</th>
                  <th className="text-right py-3 px-4 text-dark-400 font-medium text-xs uppercase tracking-wider">Eff. Rate/hr</th>
                  <th className="text-right py-3 px-4 text-dark-400 font-medium text-xs uppercase tracking-wider">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {clientProfitability.map((row) => {
                  const isBest = row.name === bestClient && clientProfitability.length > 1;
                  const isWorst = row.name === worstClient && clientProfitability.length > 1;

                  return (
                    <tr
                      key={row.name}
                      className={`border-b border-[#2A2A2A]/50 hover:bg-white/[0.03] transition-colors ${
                        isBest ? 'bg-green-500/[0.04]' : isWorst ? 'bg-red-500/[0.04]' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-dark-100 font-medium">{row.name}</span>
                          {isBest && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                              BEST
                            </span>
                          )}
                          {isWorst && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                              LOWEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-dark-200 font-medium">{formatINR(row.revenue)}</td>
                      <td className="py-3 px-4 text-right text-dark-300">{formatHours(row.hours)}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${
                        isBest ? 'text-green-400' : isWorst ? 'text-red-400' : 'text-dark-200'
                      }`}>
                        {row.effectiveRate > 0 ? formatINR(row.effectiveRate) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-dark-400">{row.expenses > 0 ? formatINR(row.expenses) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-dark-500 text-center py-8">
            No client data available yet. Start tracking time and creating invoices.
          </p>
        )}
      </div>

      {/* ═══════ Invoice Aging ═══════ */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold text-dark-100">Invoice Aging</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {invoiceAging.map((bucket) => {
            const colors = agingColorMap[bucket.color];
            const maxTotal = Math.max(...invoiceAging.map(b => b.total), 1);
            const barWidth = bucket.total > 0 ? Math.max((bucket.total / maxTotal) * 100, 8) : 0;

            return (
              <div
                key={bucket.label}
                className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A]/60 p-4 hover:border-[#3A3A3A] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors.badge}`}>
                    {bucket.label}
                  </span>
                </div>

                <p className={`text-2xl font-bold mt-3 ${colors.text}`}>
                  {formatINR(bucket.total)}
                </p>
                <p className="text-xs text-dark-500 mt-1">
                  {bucket.count} invoice{bucket.count !== 1 ? 's' : ''}
                </p>

                {/* Mini progress bar */}
                <div className="mt-3 w-full h-1.5 rounded-full bg-[#262626] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colors.bar} transition-all duration-700`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
