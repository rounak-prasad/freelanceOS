// ==========================================
// FreelanceOS — GST Invoice Preview & High-End PDF Export ($1M Upgrade)
// ==========================================
import React, { useState } from 'react';
import { Download, Loader2, Printer, ArrowLeft, Landmark, CreditCard, Sparkles, ShieldCheck } from 'lucide-react';
import {
  formatINR, formatDate, numberToWordsINR, calculateGST,
  STATE_CODES, SAC_CODES,
} from '../../utils/helpers';
import { useData } from '../../context/DataContext';

export default function InvoicePreview({ invoice, onBack }) {
  const [exporting, setExporting] = useState(false);
  const { state } = useData();
  const { settings } = state;

  if (!invoice) return null;

  // ---- derived ----
  const subtotal = invoice.subtotal ?? invoice.lineItems.reduce((s, li) => s + li.quantity * li.rate, 0);
  const gstRate = invoice.gstRate ?? 18;
  const isInterState = invoice.isInterState ?? false;
  const tax = calculateGST(subtotal, gstRate, isInterState);
  const grandTotal = invoice.total ?? tax.total;
  const placeOfSupplyName = STATE_CODES[invoice.placeOfSupply] || invoice.placeOfSupply || '';

  const sacLookup = {};
  SAC_CODES.forEach(s => { sacLookup[s.code] = s.desc; });

  // Payment details
  const hasPaymentDetails = settings.bankName || settings.accountNumber || settings.ifsc || settings.upiId;

  // ---- PDF download ----
  const handleDownload = async () => {
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      const element = document.getElementById('invoice-preview');
      const canvas = await html2canvas(element, { 
        scale: 2, 
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const thClass = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50';
  const tdClass = 'px-4 py-3.5 text-sm border-b border-gray-100';

  return (
    <div className="space-y-6 pb-10">
      {/* ---- Action Bar (dark themed) ---- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#1A1A1A] p-4 rounded-xl border border-[#2A2A2A]">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#A3A3A3] hover:text-[#FAFAFA] text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Back to Invoices
          </button>
        )}
        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-[#262626] border border-[#2A2A2A] text-[#FAFAFA] rounded-lg hover:bg-[#333333] transition-colors text-xs font-semibold"
          >
            <Printer size={14} /> Print Invoice
          </button>
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-500 text-white rounded-lg hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-200 text-xs font-semibold disabled:opacity-60"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Generating PDF…' : 'Export Premium PDF'}
          </button>
        </div>
      </div>

      {/* ---- Premium Invoice Preview (WHITE background for print-readiness) ---- */}
      <div className="flex justify-center">
        <div
          id="invoice-preview"
          className="w-full max-w-[210mm] bg-white text-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200"
          style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
        >
          {/* Top Decorative Gradient Accent Bar */}
          <div className="h-3 bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-400" />

          <div className="p-10 space-y-8">
            
            {/* ---- 1. INVOICE META & BRAND BLOCK ---- */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-gray-100 pb-8">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-orange-50 border border-orange-100 text-xs font-bold uppercase tracking-wider text-orange-600">
                  <ShieldCheck size={13} /> TAX INVOICE
                </div>
                <h1 className="text-3xl font-black tracking-tight text-gray-900">
                  {invoice.supplierName || 'INVOICE'}
                </h1>
                {invoice.supplierGstin && (
                  <p className="text-xs text-gray-500 font-semibold tracking-wide">
                    GSTIN: <span className="text-gray-900 font-bold">{invoice.supplierGstin}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-2 bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs md:text-right min-w-[240px]">
                <div className="text-gray-400 font-semibold uppercase tracking-wider">Invoice No.</div>
                <div className="font-bold text-gray-900 text-sm md:text-right">{invoice.invoiceNumber}</div>

                <div className="text-gray-400 font-semibold uppercase tracking-wider">Date</div>
                <div className="font-medium text-gray-800 md:text-right">{formatDate(invoice.date)}</div>

                <div className="text-gray-400 font-semibold uppercase tracking-wider">Due Date</div>
                <div className="font-bold text-red-600 md:text-right">{formatDate(invoice.dueDate)}</div>

                {placeOfSupplyName && (
                  <>
                    <div className="text-gray-400 font-semibold uppercase tracking-wider">Supply State</div>
                    <div className="font-medium text-gray-800 md:text-right">{invoice.placeOfSupply} — {placeOfSupplyName}</div>
                  </>
                )}
              </div>
            </div>

            {/* ---- 2. SUPPLIER & RECIPIENT GRID ---- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
              {/* Left Column: From (Supplier) */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Supplier / From</h3>
                <p className="text-sm font-bold text-gray-900">{invoice.supplierName || '—'}</p>
                {invoice.supplierAddress && (
                  <p className="text-xs text-gray-500 leading-relaxed max-w-xs">{invoice.supplierAddress}</p>
                )}
              </div>

              {/* Right Column: Bill To (Recipient) */}
              <div className="space-y-2 md:border-l md:border-gray-200 md:pl-6">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bill To / Recipient</h3>
                <p className="text-sm font-bold text-gray-900">{invoice.clientName}</p>
                {invoice.clientCompany && (
                  <p className="text-xs font-semibold text-gray-700">{invoice.clientCompany}</p>
                )}
                {invoice.clientGstin && (
                  <p className="text-xs text-gray-600">
                    <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px]">GSTIN:</span>{' '}
                    <span className="font-mono text-gray-900 font-semibold">{invoice.clientGstin}</span>
                  </p>
                )}
                {invoice.clientAddress && (
                  <p className="text-xs text-gray-500 leading-relaxed max-w-xs">{invoice.clientAddress}</p>
                )}
              </div>
            </div>

            {/* ---- 3. LINE ITEMS TABLE WITH SAC CODES ---- */}
            <div className="overflow-hidden border border-gray-200 rounded-xl">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thClass} style={{ width: '50px' }}>#</th>
                    <th className={thClass}>Services / Description</th>
                    <th className={thClass} style={{ width: '100px' }}>SAC Code</th>
                    <th className={thClass + ' text-center'} style={{ width: '80px' }}>Qty</th>
                    <th className={thClass + ' text-right'} style={{ width: '120px' }}>Rate (₹)</th>
                    <th className={thClass + ' text-right'} style={{ width: '140px' }}>Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-gray-50/50' : 'bg-gray-50 hover:bg-gray-100/30'}>
                      <td className={tdClass + ' font-mono text-xs text-gray-400 font-semibold'}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className={tdClass}>
                        <p className="font-bold text-gray-900 text-xs sm:text-sm">{item.description}</p>
                        {sacLookup[item.sacCode] && (
                          <span className="text-[10px] text-gray-400 font-medium">{sacLookup[item.sacCode]}</span>
                        )}
                      </td>
                      <td className={tdClass + ' font-mono text-xs font-bold text-gray-500'}>
                        {item.sacCode}
                      </td>
                      <td className={tdClass + ' text-center text-gray-700 font-medium'}>
                        {item.quantity}
                      </td>
                      <td className={tdClass + ' text-right text-gray-700 font-medium'}>
                        {formatINR(item.rate)}
                      </td>
                      <td className={tdClass + ' text-right font-extrabold text-gray-900'}>
                        {formatINR(item.quantity * item.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---- 4. TAX SUMMARY & GRAND TOTAL ---- */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 pt-4">
              <div className="w-full md:flex-1 space-y-4">
                {/* Amount in Words */}
                <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4">
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block mb-1">
                    Amount in Words (INR)
                  </span>
                  <p className="text-xs font-bold text-gray-800 italic leading-relaxed">
                    {numberToWordsINR(grandTotal)}
                  </p>
                </div>
              </div>

              <div className="w-full md:w-80 bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3.5 shadow-sm">
                <div className="flex justify-between items-center text-xs text-gray-500 font-bold uppercase tracking-wider">
                  <span>Subtotal</span>
                  <span className="text-gray-900 font-extrabold">{formatINR(subtotal)}</span>
                </div>

                <div className="h-px bg-gray-200" />

                {isInterState ? (
                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span className="font-semibold">IGST @ {gstRate}%</span>
                    <span className="font-extrabold text-gray-900">{formatINR(tax.igst)}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span className="font-semibold">CGST @ {gstRate / 2}%</span>
                      <span className="font-extrabold text-gray-900">{formatINR(tax.cgst)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span className="font-semibold">SGST @ {gstRate / 2}%</span>
                      <span className="font-extrabold text-gray-900">{formatINR(tax.sgst)}</span>
                    </div>
                  </div>
                )}

                <div className="h-0.5 bg-gray-300" />

                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-900">Grand Total</span>
                  <span className="text-lg font-black text-orange-600">{formatINR(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* ---- 5. DUAL PAYMENT BOX SECTION ---- */}
            {hasPaymentDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border border-gray-200 rounded-xl overflow-hidden">
                {/* Bank Details Panel */}
                <div className="p-5 space-y-4 bg-gray-50">
                  <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                    <Landmark size={15} className="text-orange-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Bank Transfer Details</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    {settings.bankName && (
                      <>
                        <div className="text-gray-400 font-semibold">Bank Name</div>
                        <div className="font-bold text-gray-900">{settings.bankName}</div>
                      </>
                    )}
                    {(settings.accountHolderName || settings.yourName) && (
                      <>
                        <div className="text-gray-400 font-semibold">Account Holder</div>
                        <div className="font-bold text-gray-900">{settings.accountHolderName || settings.yourName}</div>
                      </>
                    )}
                    {settings.accountNumber && (
                      <>
                        <div className="text-gray-400 font-semibold">Account No.</div>
                        <div className="font-mono font-bold text-gray-900">{settings.accountNumber}</div>
                      </>
                    )}
                    {settings.ifsc && (
                      <>
                        <div className="text-gray-400 font-semibold">IFSC Code</div>
                        <div className="font-mono font-bold text-orange-600">{settings.ifsc}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Instant UPI Payment Panel */}
                <div className="p-5 space-y-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                      <CreditCard size={15} className="text-teal-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Instant Payment</h4>
                    </div>
                    
                    {settings.upiId ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-400 font-medium">Scan QR or Transfer directly to UPI ID:</p>
                        <div className="bg-teal-50 border border-teal-100 rounded-lg py-2 px-3 inline-block font-mono font-bold text-xs text-teal-700">
                          {settings.upiId}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-4 italic">No UPI ID registered under settings.</p>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-[9px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50 border border-gray-100 py-1.5 px-3 rounded-lg self-start">
                    <Sparkles size={11} className="text-amber-500 animate-pulse" /> Verified Secure Supplier
                  </div>
                </div>
              </div>
            )}

            {/* ---- 6. TERMS & JURISDICTION ---- */}
            {invoice.notes && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Terms & Conditions</h3>
                <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-xl border border-gray-100 font-medium">
                  {invoice.notes}
                </p>
              </div>
            )}

            {/* ---- 7. HIGH-END SIGNATURE BLOCK FOOTER ---- */}
            <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 font-medium">
                  1. This is a digital tax invoice generated dynamically via FreelancerOS India.
                </p>
                <p className="text-[10px] text-gray-400 font-medium">
                  2. All services are subject to presumptive tax codes under Section 44ADA of the IT Act.
                </p>
              </div>
              <div className="text-right space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  For {invoice.supplierName || 'Authorized Business'}
                </p>
                <div className="space-y-1.5 pt-4">
                  <div className="h-px w-48 bg-gray-300 ml-auto border-dashed border-t" />
                  <p className="text-xs font-bold text-gray-900 tracking-wider">
                    Authorised Signatory
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
