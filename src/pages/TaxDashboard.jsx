import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { formatINR, getCurrentFY } from '../utils/helpers';
import StatCard from '../components/UI/StatCard';
// Centralised, versioned tax engine (fixes flat-18% GST on exports & flat-30% advance tax)
import { computeIncomeTax, gstOnInvoice } from '../config/taxRules';
import { Calculator, Calendar, IndianRupee, FileText, AlertTriangle, Clock, TrendingUp, Shield, Plus, Trash2, MessageCircle, Globe, ShieldCheck } from 'lucide-react';

const TAX_SLABS = [
  { min: 0, max: 400000, rate: 0 },
  { min: 400000, max: 800000, rate: 5 },
  { min: 800000, max: 1200000, rate: 10 },
  { min: 1200000, max: 1600000, rate: 15 },
  { min: 1600000, max: 2000000, rate: 20 },
  { min: 2000000, max: 2400000, rate: 25 },
  { min: 2400000, max: Infinity, rate: 30 },
];

// Adapter over the shared engine so existing JSX (.tax / .cess / .total) keeps working,
// while gaining 87A rebate, surcharge and marginal relief.
function calcTax(income) {
  const r = computeIncomeTax(income);
  return { tax: r.afterRebate + r.surcharge, cess: r.cess, total: r.total };
}

function getQuarter(dateStr) {
  const d = new Date(dateStr);
  const m = d.getMonth();
  if (m >= 3 && m <= 5) return 'Q1';
  if (m >= 6 && m <= 8) return 'Q2';
  if (m >= 9 && m <= 11) return 'Q3';
  return 'Q4';
}

export default function TaxDashboard() {
  const { state, dispatch, addToast } = useData();
  const fy = getCurrentFY();

  const settings = state.settings || {};
  const hasLUT = settings.hasLUT ?? false;

  // Detect export-of-service invoices (zero-rated under LUT). An invoice counts
  // as an export if it's explicitly flagged, billed in a non-INR currency, or
  // the client is outside India.
  const isExportInvoice = (inv) => {
    if (inv.isExport || inv.exportOfService || inv.export) return true;
    if (inv.currency && inv.currency !== 'INR') return true;
    const client = (state.clients || []).find(c => c.name === inv.clientName || c.id === inv.clientId);
    return !!(client && client.country && String(client.country).toLowerCase() !== 'india');
  };
  const gstForInvoice = (inv, subtotal) =>
    gstOnInvoice({ amount: subtotal, isExportOfService: isExportInvoice(inv), hasLUT, sameState: true });

  const tdsEntries = state.tdsEntries || [];
  const [showTdsForm, setShowTdsForm] = useState(false);
  const [tdsForm, setTdsForm] = useState({ client: '', section: '194J', rate: 10, amount: '', status: 'Received' });

  function addTds(e) {
    e.preventDefault();
    if (!tdsForm.client || !tdsForm.amount) return;
    dispatch({
      type: 'ADD_TDS_ENTRY',
      payload: { ...tdsForm, id: Date.now(), amount: Number(tdsForm.amount), date: new Date().toISOString().split('T')[0] },
    });
    setTdsForm({ client: '', section: '194J', rate: 10, amount: '', status: 'Received' });
    setShowTdsForm(false);
    addToast('TDS entry added');
  }

  // Calculations
  const stats = useMemo(() => {
    const paidInvoices = state.invoices.filter(i => i.status === 'Paid');
    let totalRevenue = 0;
    let totalGST = 0;
    let exportRevenue = 0;
    paidInvoices.forEach(inv => {
      const subtotal = (inv.lineItems || []).reduce((s, item) => s + item.quantity * item.rate, 0);
      totalRevenue += subtotal;
      const g = gstForInvoice(inv, subtotal);
      totalGST += g.total;          // exports under LUT contribute 0 (correct)
      if (g.zeroRated) exportRevenue += subtotal;
    });
    const totalExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
    const netIncome = totalRevenue - totalExpenses;
    return { totalRevenue, totalGST, totalExpenses, netIncome, exportRevenue };
  }, [state.invoices, state.expenses, state.clients, hasLUT]);

  const quarterlyData = useMemo(() => {
    const quarters = { Q1: { revenue: 0, gst: 0, expenses: 0 }, Q2: { revenue: 0, gst: 0, expenses: 0 }, Q3: { revenue: 0, gst: 0, expenses: 0 }, Q4: { revenue: 0, gst: 0, expenses: 0 } };
    state.invoices.filter(i => i.status === 'Paid').forEach(inv => {
      const q = getQuarter(inv.paidDate || inv.date);
      const subtotal = (inv.lineItems || []).reduce((s, item) => s + item.quantity * item.rate, 0);
      quarters[q].revenue += subtotal;
      quarters[q].gst += gstForInvoice(inv, subtotal).total;
    });
    state.expenses.forEach(exp => {
      const q = getQuarter(exp.date);
      quarters[q].expenses += exp.amount;
    });
    return quarters;
  }, [state.invoices, state.expenses, state.clients, hasLUT]);

  const taxCalc = useMemo(() => {
    const annualIncome = stats.netIncome;
    const normal = calcTax(annualIncome);
    const presumptive = calcTax(stats.totalRevenue * 0.5);
    const installments = [
      { due: 'Jun 15', pct: 15, amount: normal.total * 0.15 },
      { due: 'Sep 15', pct: 45, amount: normal.total * 0.45 },
      { due: 'Dec 15', pct: 75, amount: normal.total * 0.75 },
      { due: 'Mar 15', pct: 100, amount: normal.total },
    ];
    return { normal, presumptive, installments, annualIncome, presumptiveIncome: stats.totalRevenue * 0.5 };
  }, [stats]);

  // Tax dates
  const taxDates = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const dates = [
      { label: 'GSTR-1 Filing', date: new Date(year, now.getMonth() < 3 ? 0 : now.getMonth() < 6 ? 3 : now.getMonth() < 9 ? 6 : 9, 13), desc: 'Quarterly outward supplies' },
      { label: 'GSTR-3B Filing', date: new Date(year, now.getMonth() < 3 ? 0 : now.getMonth() < 6 ? 3 : now.getMonth() < 9 ? 6 : 9, 22), desc: 'Summary return' },
      { label: 'Advance Tax Q1', date: new Date(year, 5, 15), desc: '15% of estimated tax' },
      { label: 'Advance Tax Q2', date: new Date(year, 8, 15), desc: '45% of estimated tax' },
      { label: 'Advance Tax Q3', date: new Date(year, 11, 15), desc: '75% of estimated tax' },
      { label: 'Advance Tax Q4', date: new Date(year + 1, 2, 15), desc: '100% of estimated tax' },
      { label: 'ITR Filing', date: new Date(year, 6, 31), desc: 'Income tax return deadline' },
      { label: 'LUT Renewal', date: new Date(year, 2, 31), desc: 'Letter of Undertaking for exporters' },
    ].filter(d => d.date >= now).sort((a, b) => a.date - b.date).slice(0, 6);

    return dates.map(d => {
      const diff = Math.ceil((d.date - now) / (1000 * 60 * 60 * 24));
      return { ...d, daysRemaining: diff, urgency: diff <= 7 ? 'red' : diff <= 30 ? 'amber' : 'green' };
    });
  }, []);

  // ---------- Advance Tax Countdown Widget calculations ----------
  const advanceTaxInfo = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    // Installment dates for the current FY
    const installments = [
      { label: "1st Installment", dateStr: `${fy.start}-06-15`, pct: 15, qLabel: "Q1" },
      { label: "2nd Installment", dateStr: `${fy.start}-09-15`, pct: 45, qLabel: "Q2" },
      { label: "3rd Installment", dateStr: `${fy.start}-12-15`, pct: 75, qLabel: "Q3" },
      { label: "4th Installment", dateStr: `${fy.end}-03-15`, pct: 100, qLabel: "Q4" },
    ];

    // Find the next upcoming installment date
    let upcoming = installments.find(inst => new Date(inst.dateStr) >= today);
    if (!upcoming) {
      upcoming = installments[3]; // default/fallback to last installment
    }

    const totalFYIncome = stats.totalRevenue;

    // alreadyPaid calculation
    const tdsTotal = tdsEntries.reduce((s, e) => s + e.amount, 0);
    const taxExpenses = state.expenses
      .filter(e => e.category === 'Tax' || e.category === 'Advance Tax' || e.description.toLowerCase().includes('advance tax'))
      .reduce((s, e) => s + e.amount, 0);

    const alreadyPaid = tdsTotal + taxExpenses;

    // FIX: liability must come from the slab engine on NET taxable income,
    // not a flat 30% of revenue (the old bug overstated tax massively).
    const liability = computeIncomeTax(stats.netIncome).total;
    const installmentDue = liability * (upcoming.pct / 100);
    const dueAmount = Math.max(0, Math.round(installmentDue - alreadyPaid));

    const diffTime = new Date(upcoming.dateStr) - today;
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // WhatsApp Link message
    const waMessage = `Hi, my advance tax calculation for ${upcoming.qLabel}: Total FY income so far ${formatINR(totalFYIncome)}, estimated liability ${formatINR(dueAmount)}. Please confirm the installment amount.`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

    return {
      ...upcoming,
      totalFYIncome,
      liability,
      alreadyPaid,
      dueAmount,
      daysRemaining,
      waUrl
    };
  }, [stats.totalRevenue, stats.netIncome, tdsEntries, state.expenses, fy]);

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <Calculator className="w-6 h-6 text-accent" /> Tax Dashboard
        </h1>
        <p className="text-sm text-dark-300 mt-0.5">{fy.label} • Financial overview & compliance tracker</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="badge bg-accent/10 text-accent flex items-center gap-1">
            <Globe className="w-3 h-3" /> Exports {hasLUT ? 'zero-rated under LUT' : '— file LUT to zero-rate (IGST applies now)'}
          </span>
          <Link to="/guardrails" className="badge bg-dark-700 text-dark-200 hover:text-accent flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Open Compliance Guard
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={IndianRupee} label="Total Revenue" value={formatINR(stats.totalRevenue)} color="green" />
        <StatCard icon={Calculator} label="GST Collected" value={formatINR(stats.totalGST)} color="amber" subValue={stats.exportRevenue ? `${formatINR(stats.exportRevenue)} exports zero-rated` : undefined} />
        <StatCard icon={TrendingUp} label="Total Expenses" value={formatINR(stats.totalExpenses)} color="red" />
        <StatCard icon={Shield} label="Net Taxable Income" value={formatINR(stats.netIncome)} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quarterly GST Summary */}
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="section-title mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" /> Quarterly GST Summary
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600/50">
                  <th className="table-header text-left py-3 px-4">Quarter</th>
                  <th className="table-header text-left py-3 px-4">Period</th>
                  <th className="table-header text-right py-3 px-4">Revenue</th>
                  <th className="table-header text-right py-3 px-4">GST Collected</th>
                  <th className="table-header text-right py-3 px-4">Expenses</th>
                  <th className="table-header text-right py-3 px-4">Net GST Liability</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'Q1', period: 'Apr–Jun' },
                  { key: 'Q2', period: 'Jul–Sep' },
                  { key: 'Q3', period: 'Oct–Dec' },
                  { key: 'Q4', period: 'Jan–Mar' },
                ].map(q => {
                  const data = quarterlyData[q.key];
                  const liability = data.gst - (data.expenses * 0.18);
                  return (
                    <tr key={q.key} className="border-b border-dark-600/30 hover:bg-dark-700/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-dark-50">{q.key}</td>
                      <td className="py-3 px-4 text-dark-300">{q.period}</td>
                      <td className="py-3 px-4 text-right text-dark-50">{formatINR(data.revenue)}</td>
                      <td className="py-3 px-4 text-right text-amber-400">{formatINR(data.gst)}</td>
                      <td className="py-3 px-4 text-right text-dark-300">{formatINR(data.expenses)}</td>
                      <td className={`py-3 px-4 text-right font-medium ${liability > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatINR(Math.max(0, liability))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dark-500">
                  <td colSpan={2} className="py-3 px-4 font-semibold text-dark-50">Total</td>
                  <td className="py-3 px-4 text-right font-semibold text-dark-50">{formatINR(stats.totalRevenue)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-amber-400">{formatINR(stats.totalGST)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-dark-300">{formatINR(stats.totalExpenses)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-red-400">{formatINR(Math.max(0, stats.totalGST - stats.totalExpenses * 0.18))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* TDS Tracker */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" /> TDS Tracker
            </h2>
            <button onClick={() => setShowTdsForm(!showTdsForm)} className="btn-ghost text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Entry
            </button>
          </div>

          {/* TDS Info */}
          <div className="mb-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs space-y-1">
            <p className="text-blue-400 font-medium">TDS Rates for Freelancers:</p>
            <p className="text-dark-300">• Sec 194J: 10% (professional) / 2% (technical) — Threshold: ₹50,000/yr</p>
            <p className="text-dark-300">• Sec 194C: 1% (contract work) — Threshold: ₹30,000 single / ₹1L total</p>
            <p className="text-dark-300">• No PAN provided → TDS jumps to 20%</p>
          </div>

          {showTdsForm && (
            <form onSubmit={addTds} className="mb-4 p-3 rounded-lg bg-dark-700/50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label text-xs">Client</label>
                  <select value={tdsForm.client} onChange={e => setTdsForm(f => ({ ...f, client: e.target.value }))} required>
                    <option value="">Select</option>
                    {state.clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label text-xs">Section</label>
                  <select value={tdsForm.section} onChange={e => setTdsForm(f => ({ ...f, section: e.target.value, rate: e.target.value === '194C' ? 1 : 10 }))}>
                    <option value="194J">194J (Professional/Technical)</option>
                    <option value="194C">194C (Contract)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label text-xs">TDS Rate (%)</label>
                  <input type="number" value={tdsForm.rate} onChange={e => setTdsForm(f => ({ ...f, rate: Number(e.target.value) }))} min={0} max={30} />
                </div>
                <div>
                  <label className="input-label text-xs">Amount (₹)</label>
                  <input type="number" value={tdsForm.amount} onChange={e => setTdsForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-xs">Add</button>
                <button type="button" onClick={() => setShowTdsForm(false)} className="btn-ghost text-xs">Cancel</button>
              </div>
            </form>
          )}

          {tdsEntries.length === 0 ? (
            <p className="text-sm text-dark-400 text-center py-4">No TDS entries recorded yet</p>
          ) : (
            <div className="space-y-2">
              {tdsEntries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-700/30">
                  <div>
                    <p className="text-sm text-dark-50 font-medium">{entry.client}</p>
                    <p className="text-xs text-dark-300">Sec {entry.section} @ {entry.rate}%</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-green-400">{formatINR(entry.amount)}</span>
                    <button onClick={() => dispatch({ type: 'DELETE_TDS_ENTRY', payload: entry.id })} className="text-dark-400 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-dark-600/50 flex justify-between text-sm">
                <span className="text-dark-300">Total TDS</span>
                <span className="font-semibold text-green-400">{formatINR(tdsEntries.reduce((s, e) => s + e.amount, 0))}</span>
              </div>
            </div>
          )}
        </div>

        {/* Advance Tax Section with Countdown + Calculator stacked */}
        <div className="flex flex-col gap-6">
          {/* Advance Tax Countdown Widget */}
          <div className="glass-card p-5 flex flex-col justify-between hover:border-accent/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-dark-200 uppercase tracking-wider">Advance Tax Alert</span>
              <Calendar className="w-4 h-4 text-accent" />
            </div>

            <div className="py-2">
              <p className="text-xl font-black text-dark-50">
                {formatINR(advanceTaxInfo.dueAmount)} due in {advanceTaxInfo.daysRemaining} days
              </p>
              <p className="text-xs text-dark-300 mt-1">
                {advanceTaxInfo.label} — {new Date(advanceTaxInfo.dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>

            <div className="border-t border-dark-600/30 pt-3 flex items-center justify-between gap-2">
              <div className="text-xs text-dark-400">
                FY Income: <span className="text-dark-200 font-semibold">{formatINR(advanceTaxInfo.totalFYIncome)}</span>
              </div>
              <a
                href={advanceTaxInfo.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/20 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Share with CA
              </a>
            </div>
          </div>

          {/* Advance Tax Calculator */}
          <div className="glass-card p-5">
            <h2 className="section-title mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-accent" /> Advance Tax Estimator
            </h2>

            <div className="space-y-4">
              {/* Normal vs Presumptive */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-dark-700/50">
                  <p className="text-xs text-dark-300 mb-1">Normal Taxation</p>
                  <p className="text-xs text-dark-400">Income: {formatINR(taxCalc.annualIncome)}</p>
                  <p className="text-lg font-bold text-dark-50">{formatINR(taxCalc.normal.total)}</p>
                  <p className="text-xs text-dark-400">Tax: {formatINR(taxCalc.normal.tax)} + Cess: {formatINR(taxCalc.normal.cess)}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <p className="text-xs text-green-400 mb-1">Sec 44ADA (Presumptive)</p>
                  <p className="text-xs text-dark-400">50% of ₹{(stats.totalRevenue / 100000).toFixed(1)}L</p>
                  <p className="text-lg font-bold text-green-400">{formatINR(taxCalc.presumptive.total)}</p>
                  <p className="text-xs text-dark-300">
                    {taxCalc.presumptive.total < taxCalc.normal.total ? '✅ Saves ' + formatINR(taxCalc.normal.total - taxCalc.presumptive.total) : 'Normal taxation is better'}
                  </p>
                </div>
              </div>

              {/* Tax Slabs Breakdown */}
              <div>
                <p className="text-xs font-medium text-dark-300 mb-2">New Tax Regime {fy.label} Slabs</p>
                <div className="space-y-1">
                  {TAX_SLABS.map((slab, i) => {
                    const applicable = taxCalc.annualIncome > slab.min;
                    return (
                      <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${applicable ? 'bg-accent/5' : ''}`}>
                        <span className={applicable ? 'text-dark-50' : 'text-dark-400'}>
                          {slab.max === Infinity ? `Above ${formatINR(slab.min)}` : `${formatINR(slab.min)} – ${formatINR(slab.max)}`}
                        </span>
                        <span className={`font-medium ${applicable ? 'text-accent' : 'text-dark-400'}`}>{slab.rate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quarterly Installments */}
              <div>
                <p className="text-xs font-medium text-dark-300 mb-2">Quarterly Installments</p>
                <div className="grid grid-cols-2 gap-2">
                  {taxCalc.installments.map(inst => (
                    <div key={inst.due} className="p-2 rounded-lg bg-dark-700/30 text-center">
                      <p className="text-xs text-dark-300">{inst.due} ({inst.pct}%)</p>
                      <p className="text-sm font-semibold text-dark-50">{formatINR(inst.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Tax Dates */}
      <div className="glass-card p-5">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent" /> Upcoming Tax Deadlines
        </h2>
        {taxDates.length === 0 ? (
          <p className="text-sm text-dark-400 text-center py-4">No upcoming deadlines</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {taxDates.map((td, i) => {
              const colorMap = { red: 'border-red-500/30 bg-red-500/5', amber: 'border-amber-500/30 bg-amber-500/5', green: 'border-green-500/30 bg-green-500/5' };
              const textMap = { red: 'text-red-400', amber: 'text-amber-400', green: 'text-green-400' };
              return (
                <div key={i} className={`p-4 rounded-xl border ${colorMap[td.urgency]} transition-all hover:scale-[1.02]`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-dark-50">{td.label}</p>
                      <p className="text-xs text-dark-300 mt-0.5">{td.desc}</p>
                    </div>
                    <div className={`text-right ${textMap[td.urgency]}`}>
                      <p className="text-lg font-bold">{td.daysRemaining}</p>
                      <p className="text-xs">days</p>
                    </div>
                  </div>
                  <p className="text-xs text-dark-400 mt-2">{td.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
