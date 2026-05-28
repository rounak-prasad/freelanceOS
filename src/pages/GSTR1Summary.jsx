// ==========================================
// FreelanceOS — GSTR-1 Summary Page
// ==========================================
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR, formatDate, calculateGST, getCurrentFY } from '../utils/helpers';
import { BarChart3, Download, ChevronDown, FileText } from 'lucide-react';

function getQuarters() {
  const fy = getCurrentFY();
  return [
    { label: `Q1 (Apr-Jun ${fy.start})`, months: [3, 4, 5], year: fy.start },
    { label: `Q2 (Jul-Sep ${fy.start})`, months: [6, 7, 8], year: fy.start },
    { label: `Q3 (Oct-Dec ${fy.start})`, months: [9, 10, 11], year: fy.start },
    { label: `Q4 (Jan-Mar ${fy.end})`, months: [0, 1, 2], year: fy.end },
  ];
}

export default function GSTR1Summary() {
  const { state, addToast } = useData();
  const [selectedQuarter, setSelectedQuarter] = useState(0);
  const quarters = getQuarters();
  const fy = getCurrentFY();

  const quarterInvoices = useMemo(() => {
    const q = quarters[selectedQuarter];
    return state.invoices.filter(inv => {
      const d = new Date(inv.date);
      const m = d.getMonth();
      const y = d.getFullYear();
      if (selectedQuarter === 3) {
        return q.months.includes(m) && y === q.year;
      }
      return q.months.includes(m) && y === q.year;
    });
  }, [state.invoices, selectedQuarter]);

  const b2b = useMemo(() => quarterInvoices.filter(inv => inv.clientGstin && inv.clientGstin.length === 15), [quarterInvoices]);
  const b2c = useMemo(() => quarterInvoices.filter(inv => !inv.clientGstin || inv.clientGstin.length < 15), [quarterInvoices]);

  function getInvoiceGSTData(inv) {
    const subtotal = (inv.lineItems || []).reduce((s, li) => s + li.quantity * li.rate, 0);
    const gstRate = inv.gstRate || 18;
    const isInterState = inv.isInterState || false;
    const gst = calculateGST(subtotal, gstRate, isInterState);
    return { subtotal, gstRate, ...gst, invoiceValue: gst.total };
  }

  // GST Rate-wise summary
  const rateWiseSummary = useMemo(() => {
    const rates = {};
    quarterInvoices.forEach(inv => {
      const data = getInvoiceGSTData(inv);
      const rate = data.gstRate;
      if (!rates[rate]) rates[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      rates[rate].taxable += data.subtotal;
      rates[rate].cgst += data.cgst;
      rates[rate].sgst += data.sgst;
      rates[rate].igst += data.igst;
      rates[rate].total += data.igst + data.cgst + data.sgst;
    });
    return rates;
  }, [quarterInvoices]);

  function exportCSV() {
    const rows = [
      // B2B header
      ['GSTIN of Supplier', 'Trade/Legal name', 'GSTIN of Recipient', 'Receiver Name',
       'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply',
       'Reverse Charge', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value',
       'IGST Amount', 'CGST Amount', 'SGST/UTGST Amount'],
      // B2B data rows
      ...b2b.map(inv => {
        const subtotal = (inv.lineItems||[]).reduce((s,li) => s + li.quantity*li.rate, 0);
        const gst = calculateGST(subtotal, inv.gstRate||18, inv.isInterState||false);
        return [
          state.settings.gstin || '',
          state.settings.businessName || '',
          inv.clientGstin || '',
          inv.clientName || '',
          inv.invoiceNumber,
          formatDate(inv.date),
          gst.total.toFixed(2),
          inv.placeOfSupply || '',
          'N',
          'Regular',
          '',
          (inv.gstRate||18) + '%',
          subtotal.toFixed(2),
          gst.igst.toFixed(2),
          gst.cgst.toFixed(2),
          gst.sgst.toFixed(2),
        ];
      }),
    ];
    
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_Q${selectedQuarter+1}_FY${fy.start}-${fy.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('GSTR-1 CSV exported for CA filing!');
  }

  // GST Liability Calculation
  const quarterExpenses = useMemo(() => {
    const q = quarters[selectedQuarter];
    return (state.expenses || []).filter(exp => {
      const d = new Date(exp.date);
      const m = d.getMonth();
      const y = d.getFullYear();
      return q.months.includes(m) && y === q.year;
    });
  }, [state.expenses, selectedQuarter, quarters]);

  const totalInputGST = useMemo(() => {
    return quarterExpenses.reduce((sum, exp) => sum + (Number(exp.gstPaid) || 0), 0);
  }, [quarterExpenses]);

  const totalOutputGST = useMemo(() => {
    return quarterInvoices.reduce((sum, inv) => {
      const data = getInvoiceGSTData(inv);
      return sum + (data.cgst + data.sgst + data.igst);
    }, 0);
  }, [quarterInvoices]);

  const netGSTPayable = totalOutputGST - totalInputGST;

  const dueDate = useMemo(() => {
    const dates = ['July 20', 'October 20', 'January 20', 'April 20'];
    const currentYear = quarters[selectedQuarter].year;
    return `${dates[selectedQuarter]}, ${currentYear}`;
  }, [selectedQuarter, quarters]);

  const thClass = 'table-header px-3 py-2.5 text-left';

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-accent" />
            GSTR-1 Summary
          </h1>
          <p className="text-sm text-dark-300 mt-0.5">Auto-sorted invoices for GST filing — export for your CA.</p>
        </div>
        <button onClick={exportCSV} className="btn-primary flex items-center gap-2" disabled={b2b.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Quarter Selector */}
      <div className="glass-card p-4">
        <label className="block text-sm font-medium text-dark-200 mb-2">Select Quarter ({fy.label})</label>
        <div className="relative max-w-xs">
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(Number(e.target.value))} className="w-full appearance-none">
            {quarters.map((q, i) => (
              <option key={i} value={i}>{q.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
        </div>
      </div>

      {/* B2B Section */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-dark-600/30">
          <h3 className="text-sm font-semibold text-dark-100">B2B Invoices</h3>
          <p className="text-xs text-dark-400">Invoices where client has a GSTIN • {b2b.length} invoice{b2b.length !== 1 ? 's' : ''}</p>
        </div>
        {b2b.length === 0 ? (
          <div className="p-8 text-center text-dark-400 text-sm">No B2B invoices in this quarter</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600/20">
                  <th className={thClass}>Invoice #</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>GSTIN</th>
                  <th className={thClass}>POS</th>
                  <th className={thClass + ' text-right'}>Value</th>
                  <th className={thClass + ' text-right'}>Taxable</th>
                  <th className={thClass + ' text-right'}>CGST</th>
                  <th className={thClass + ' text-right'}>SGST</th>
                  <th className={thClass + ' text-right'}>IGST</th>
                  <th className={thClass + ' text-right'}>Total GST</th>
                </tr>
              </thead>
              <tbody>
                {b2b.map(inv => {
                  const data = getInvoiceGSTData(inv);
                  return (
                    <tr key={inv.id} className="border-b border-dark-600/10 hover:bg-dark-700/30 text-sm">
                      <td className="px-3 py-2.5 font-medium text-dark-50">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2.5 text-dark-300">{formatDate(inv.date)}</td>
                      <td className="px-3 py-2.5 text-dark-200">{inv.clientName}</td>
                      <td className="px-3 py-2.5 text-dark-300 text-xs font-mono">{inv.clientGstin}</td>
                      <td className="px-3 py-2.5 text-dark-300">{inv.placeOfSupply || '-'}</td>
                      <td className="px-3 py-2.5 text-right text-dark-100">{formatINR(data.invoiceValue)}</td>
                      <td className="px-3 py-2.5 text-right text-dark-200">{formatINR(data.subtotal)}</td>
                      <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.cgst)}</td>
                      <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.sgst)}</td>
                      <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.igst)}</td>
                      <td className="px-3 py-2.5 text-right text-accent font-medium">{formatINR(data.cgst + data.sgst + data.igst)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* B2C Section */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-dark-600/30">
          <h3 className="text-sm font-semibold text-dark-100">B2C Invoices</h3>
          <p className="text-xs text-dark-400">Invoices where client has no GSTIN • {b2c.length} invoice{b2c.length !== 1 ? 's' : ''}</p>
        </div>
        {b2c.length === 0 ? (
          <div className="p-8 text-center text-dark-400 text-sm">No B2C invoices in this quarter</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600/20">
                  <th className={thClass}>Invoice #</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>State</th>
                  <th className={thClass + ' text-right'}>Value</th>
                  <th className={thClass + ' text-center'}>Rate</th>
                  <th className={thClass + ' text-right'}>CGST</th>
                  <th className={thClass + ' text-right'}>SGST</th>
                  <th className={thClass + ' text-right'}>IGST</th>
                </tr>
              </thead>
              <tbody>
                {b2c.map(inv => {
                  const data = getInvoiceGSTData(inv);
                  return (
                    <tr key={inv.id} className="border-b border-dark-600/10 hover:bg-dark-700/30 text-sm">
                      <td className="px-3 py-2.5 font-medium text-dark-50">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2.5 text-dark-300">{formatDate(inv.date)}</td>
                      <td className="px-3 py-2.5 text-dark-200">{inv.clientName}</td>
                      <td className="px-3 py-2.5 text-dark-300">{inv.placeOfSupply || '-'}</td>
                      <td className="px-3 py-2.5 text-right text-dark-100">{formatINR(data.invoiceValue)}</td>
                      <td className="px-3 py-2.5 text-center text-dark-300">{data.gstRate}%</td>
                      <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.cgst)}</td>
                      <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.sgst)}</td>
                      <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.igst)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rate-wise Summary */}
      {Object.keys(rateWiseSummary).length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-dark-600/30">
            <h3 className="text-sm font-semibold text-dark-100">GST Rate-wise Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600/20">
                  <th className={thClass}>Rate</th>
                  <th className={thClass + ' text-right'}>Taxable Value</th>
                  <th className={thClass + ' text-right'}>CGST</th>
                  <th className={thClass + ' text-right'}>SGST</th>
                  <th className={thClass + ' text-right'}>IGST</th>
                  <th className={thClass + ' text-right'}>Total GST</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(rateWiseSummary).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, data]) => (
                  <tr key={rate} className="border-b border-dark-600/10 text-sm">
                    <td className="px-3 py-2.5 font-medium text-dark-50">{rate}%</td>
                    <td className="px-3 py-2.5 text-right text-dark-200">{formatINR(data.taxable)}</td>
                    <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.cgst)}</td>
                    <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.sgst)}</td>
                    <td className="px-3 py-2.5 text-right text-dark-300">{formatINR(data.igst)}</td>
                    <td className="px-3 py-2.5 text-right text-accent font-semibold">{formatINR(data.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GST Liability Calculator */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-dark-50 tracking-tight">GST Liability Calculator</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider">Total Output GST (Collected)</p>
            <p className="text-2xl font-bold text-accent mt-2">{formatINR(totalOutputGST)}</p>
            <p className="text-[11px] text-dark-400 mt-1">From all client invoices in this quarter</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider">Total Input GST (Expenses)</p>
            <p className="text-2xl font-bold text-emerald-400 mt-2">{formatINR(totalInputGST)}</p>
            <p className="text-[11px] text-dark-400 mt-1">From tax-deductible expenses in this quarter</p>
          </div>
          <div className="glass-card p-5 border-l-4 border-l-accent">
            <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider">Net GST Payable / Credit</p>
            <p className={`text-2xl font-bold mt-2 ${netGSTPayable >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {formatINR(netGSTPayable)}
            </p>
            <p className="text-[11px] text-dark-400 mt-1">
              {netGSTPayable >= 0 ? `Due payment on or before ${dueDate}` : 'Input credit available'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
