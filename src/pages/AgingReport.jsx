// ==========================================
// FreelanceOS — Aging Report Page (Escalation Upgrade)
// ==========================================
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR, formatDate, calculateGST } from '../utils/helpers';
import Modal from '../components/UI/Modal';
import {
  AlertTriangle, Clock, AlertCircle, Loader2, Copy,
  MessageCircle, IndianRupee, FileText, ToggleLeft, Scale, Check
} from 'lucide-react';

function getInvoiceTotal(inv) {
  if (inv.total) return inv.total;
  const subtotal = (inv.lineItems || []).reduce((s, li) => s + li.quantity * li.rate, 0);
  const gst = calculateGST(subtotal, inv.gstRate || 18, inv.isInterState || false);
  return gst.total;
}

function getOutstanding(inv) {
  const total = getInvoiceTotal(inv);
  const paid = inv.amountPaid || (inv.status === 'Paid' ? total : 0);
  return total - paid;
}

export default function AgingReport() {
  const { state, dispatch, addToast } = useData();
  
  // Modals & inputs state
  const [reminderModal, setReminderModal] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Partial Payment State
  const [partialPaymentModal, setPartialPaymentModal] = useState(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialDate, setPartialDate] = useState(new Date().toISOString().split('T')[0]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  // Compute all unpaid invoices with age
  const unpaidInvoices = useMemo(() => {
    return (state.invoices || [])
      .filter(inv => inv.status !== 'Paid')
      .map(inv => {
        const age = Math.floor((today - new Date(inv.date)) / (1000 * 60 * 60 * 24));
        const total = getInvoiceTotal(inv);
        const outstanding = getOutstanding(inv);
        return { ...inv, age, total, outstanding };
      })
      .filter(inv => inv.outstanding > 0)
      .sort((a, b) => b.age - a.age);
  }, [state.invoices, today]);

  // Separate regular vs disputed
  const regularInvoices = useMemo(() => unpaidInvoices.filter(inv => !inv.isDisputed), [unpaidInvoices]);
  const disputedInvoices = useMemo(() => unpaidInvoices.filter(inv => inv.isDisputed), [unpaidInvoices]);

  // Buckets for Regular invoices
  const buckets = useMemo(() => {
    const b = {
      current: { label: 'Current', range: '0-30 days', items: [], color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
      overdue: { label: 'Overdue', range: '31-60 days', items: [], color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
      late: { label: 'Late', range: '61-90 days', items: [], color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
      critical: { label: 'Critical', range: '90+ days', items: [], color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    };
    regularInvoices.forEach(inv => {
      if (inv.age <= 30) b.current.items.push(inv);
      else if (inv.age <= 60) b.overdue.items.push(inv);
      else if (inv.age <= 90) b.late.items.push(inv);
      else b.critical.items.push(inv);
    });
    return b;
  }, [regularInvoices]);

  const totalOutstanding = regularInvoices.reduce((s, inv) => s + inv.outstanding, 0);

  function getAgeBadge(age) {
    if (age <= 30) return 'bg-accent/10 text-accent border-accent/20';
    if (age <= 60) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (age <= 90) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  }

  // Escalation logic based on invoice age
  const escalationLevel = useMemo(() => {
    if (!reminderModal) return null;
    const age = reminderModal.age;
    if (age <= 30) {
      return { name: 'Friendly Reminder', tone: 'warm, assume it was an oversight', badge: 'bg-accent/10 text-accent border-accent/20' };
    } else if (age <= 60) {
      return { name: 'Firm Follow-up', tone: 'professional but assertive, mention late payment clause', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    } else if (age <= 90) {
      return { name: 'Formal Notice', tone: 'legal language, mention consequences, request call', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
    } else {
      return { name: 'Final Demand', tone: 'firm, mention dispute resolution, invoice number prominent', badge: 'bg-red-500/10 text-red-400 border-red-500/20' };
    }
  }, [reminderModal]);

  async function generateReminder() {
    if (!reminderModal || !escalationLevel) return;
    setAiLoading(true);
    setAiMessage('');
    try {
      const prompt = `Generate a payment reminder message for:
Client: ${reminderModal.clientName}
Invoice: ${reminderModal.invoiceNumber}
Invoice Date: ${formatDate(reminderModal.date)}
Amount: ₹${reminderModal.total.toFixed(0)}
Outstanding: ₹${reminderModal.outstanding.toFixed(0)}
Days Overdue: ${reminderModal.age}

Escalation Level: ${escalationLevel.name} (Tone: ${escalationLevel.tone})

Write in a polite but highly persistent Indian business tone matching the escalation level. Include the invoice details. Keep under 140 words. No markdown, return only the ready message.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || '').join('') || 'Failed to generate reminder.';
      setAiMessage(text);
    } catch (err) {
      // Fallback
      const fallback = `Dear ${reminderModal.clientName}, this is a ${escalationLevel.name.toLowerCase()} regarding Invoice ${reminderModal.invoiceNumber} for ${formatINR(reminderModal.outstanding)}, which is currently ${reminderModal.age} days overdue. We kindly request you to process this amount at your earliest convenience. Thank you.`;
      setAiMessage(fallback);
      addToast('AI generation failed. Loaded fallback.', 'warning');
    } finally {
      setAiLoading(false);
    }
  }

  function toggleDisputed(inv) {
    const nextVal = !inv.isDisputed;
    dispatch({
      type: 'UPDATE_INVOICE',
      payload: { id: inv.id, isDisputed: nextVal }
    });
    addToast(nextVal ? 'Invoice marked as Disputed' : 'Dispute status removed');
  }

  function handleRecordPartialPayment(e) {
    e.preventDefault();
    if (!partialAmount || Number(partialAmount) <= 0) {
      addToast('Please input a valid amount', 'error');
      return;
    }
    const amt = Number(partialAmount);
    const inv = partialPaymentModal;
    const currentPaid = inv.amountPaid || 0;
    const nextPaid = currentPaid + amt;
    const total = inv.total;

    const updatedInvoice = {
      id: inv.id,
      amountPaid: nextPaid,
      status: nextPaid >= total ? 'Paid' : 'Sent',
      paidDate: nextPaid >= total ? partialDate : null,
      notes: `${inv.notes || ''}\nPartial payment of ${formatINR(amt)} recorded on ${partialDate}.`.trim()
    };

    dispatch({ type: 'UPDATE_INVOICE', payload: updatedInvoice });
    
    // Add activity log
    dispatch({
      type: 'ADD_ACTIVITY',
      payload: {
        id: generateId(),
        type: 'payment',
        message: `Recorded payment of ${formatINR(amt)} for Invoice ${inv.invoiceNumber}`,
        timestamp: new Date().toISOString(),
        icon: 'IndianRupee',
      }
    });

    addToast(nextPaid >= total ? 'Invoice fully settled!' : 'Partial payment recorded!');
    setPartialPaymentModal(null);
    setPartialAmount('');
  }

  function copyMessage() {
    navigator.clipboard.writeText(aiMessage);
    addToast('Message copied to clipboard!');
  }

  function openWhatsApp() {
    const encoded = encodeURIComponent(aiMessage);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  }

  const summaryCards = [
    { label: 'Regular Outstanding', value: formatINR(totalOutstanding), count: regularInvoices.length, color: 'text-accent', bg: 'bg-accent/10', icon: IndianRupee },
    { label: 'Current (0-30d)', value: formatINR(buckets.current.items.reduce((s, i) => s + i.outstanding, 0)), count: buckets.current.items.length, color: 'text-accent', bg: 'bg-accent/10', icon: Clock },
    { label: 'Overdue (31-60d)', value: formatINR(buckets.overdue.items.reduce((s, i) => s + i.outstanding, 0)), count: buckets.overdue.items.length, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertCircle },
    { label: 'Late (61-90d)', value: formatINR(buckets.late.items.reduce((s, i) => s + i.outstanding, 0)), count: buckets.late.items.length, color: 'text-orange-400', bg: 'bg-orange-500/10', icon: AlertTriangle },
    { label: 'Critical (90+d)', value: formatINR(buckets.critical.items.reduce((s, i) => s + i.outstanding, 0)), count: buckets.critical.items.length, color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
  ];

  const thClass = 'table-header px-4 py-2.5 text-left';

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-accent" />
          Aging Report
        </h1>
        <p className="text-sm text-dark-300 mt-0.5">Outstanding invoices grouped by age — track collections and escalate reminders.</p>
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
            <p className={`text-lg font-bold ${i === 0 ? 'text-accent' : 'text-dark-50'} mt-0.5`}>{card.value}</p>
            <p className="text-xs text-dark-400 mt-1">{card.count} invoice{card.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Bucket Tables */}
      {Object.entries(buckets).map(([key, bucket]) => (
        bucket.items.length > 0 && (
          <div key={key} className="glass-card overflow-hidden">
            <div className="px-5 py-3 border-b border-dark-600/30 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${bucket.color === 'text-accent' ? 'bg-accent' : bucket.color === 'text-amber-400' ? 'bg-amber-400' : bucket.color === 'text-orange-400' ? 'bg-orange-400' : 'bg-red-400'}`} />
              <h3 className="text-sm font-semibold text-dark-100">{bucket.label}</h3>
              <span className="text-xs text-dark-400">({bucket.range})</span>
              <span className="text-xs text-dark-400 ml-auto">{bucket.items.length} invoice{bucket.items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-x-auto font-sans">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-600/20 bg-dark-900/20">
                    <th className={thClass}>Invoice #</th>
                    <th className={thClass}>Client</th>
                    <th className={thClass}>Date</th>
                    <th className={`${thClass} text-right`}>Total</th>
                    <th className={`${thClass} text-right`}>Outstanding</th>
                    <th className={`${thClass} text-center`}>Age</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.items.map(inv => (
                    <tr key={inv.id} className="border-b border-dark-600/10 hover:bg-dark-700/30 transition-colors text-sm">
                      <td className="px-4 py-2.5 font-medium text-dark-50">{inv.invoiceNumber}</td>
                      <td className="px-4 py-2.5 text-dark-200">{inv.clientName}</td>
                      <td className="px-4 py-2.5 text-dark-300">{formatDate(inv.date)}</td>
                      <td className="px-4 py-2.5 text-dark-100 text-right">{formatINR(inv.total)}</td>
                      <td className="px-4 py-2.5 font-semibold text-red-400 text-right">{formatINR(inv.outstanding)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${getAgeBadge(inv.age)}`}>
                          {inv.age}d
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setReminderModal(inv); setAiMessage(''); }}
                            className="px-2.5 py-1 bg-accent/10 text-accent hover:bg-accent/20 rounded text-xs font-medium transition-colors"
                          >
                            Remind
                          </button>
                          
                          <button
                            onClick={() => setPartialPaymentModal(inv)}
                            className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded text-xs font-medium transition-colors"
                          >
                            Pay
                          </button>

                          <button
                            onClick={() => toggleDisputed(inv)}
                            className="p-1 text-dark-400 hover:text-orange-400 rounded transition-colors"
                            title="Mark as Disputed"
                          >
                            <Scale className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ))}

      {/* Disputes Section */}
      {disputedInvoices.length > 0 && (
        <div className="glass-card overflow-hidden border-orange-500/30">
          <div className="px-5 py-3 border-b border-dark-600/30 bg-orange-500/5 flex items-center gap-2">
            <Scale className="w-5 h-5 text-orange-400" />
            <h3 className="text-sm font-semibold text-orange-400">Disputed Invoices</h3>
            <span className="text-xs text-dark-400">(Excluded from aging totals)</span>
            <span className="text-xs text-dark-400 ml-auto">{disputedInvoices.length} dispute{disputedInvoices.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto font-sans">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600/20 bg-dark-900/20">
                  <th className={thClass}>Invoice #</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>Date</th>
                  <th className={`${thClass} text-right`}>Outstanding</th>
                  <th className={`${thClass} text-center`}>Age</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {disputedInvoices.map(inv => (
                  <tr key={inv.id} className="border-b border-dark-600/10 hover:bg-dark-700/30 transition-colors text-sm">
                    <td className="px-4 py-2.5 font-medium text-dark-50">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-dark-200">{inv.clientName}</td>
                    <td className="px-4 py-2.5 text-dark-300">{formatDate(inv.date)}</td>
                    <td className="px-4 py-2.5 font-semibold text-orange-400 text-right">{formatINR(inv.outstanding)}</td>
                    <td className="px-4 py-2.5 text-center text-dark-300">{inv.age}d</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => toggleDisputed(inv)}
                        className="px-2.5 py-1 bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 rounded text-xs font-medium transition-colors"
                      >
                        Resolve Dispute
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {regularInvoices.length === 0 && disputedInvoices.length === 0 && (
        <div className="glass-card p-12 text-center">
          <FileText className="w-12 h-12 text-dark-400 mx-auto mb-3" />
          <p className="text-dark-300">No outstanding invoices — all clear! 🎉</p>
        </div>
      )}

      {/* Escalation-Aware Reminder Modal */}
      <Modal isOpen={!!reminderModal} onClose={() => setReminderModal(null)} title="Payment Escalation Reminder" maxWidth="max-w-lg">
        {reminderModal && escalationLevel && (
          <div className="space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-dark-600/30 pb-3">
              <div className="flex items-center gap-2 text-dark-100">
                <FileText className="w-5 h-5 text-accent" />
                <span className="font-semibold">{reminderModal.invoiceNumber}</span>
                <span className="text-dark-400">•</span>
                <span className="text-dark-200">{reminderModal.clientName}</span>
              </div>
              <span className={`badge border text-[10px] font-bold px-2.5 py-0.5 rounded-full ${escalationLevel.badge}`}>
                {escalationLevel.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-dark-700/60 p-3 rounded-lg border border-dark-600/20">
                <p className="text-[10px] text-dark-400 uppercase font-semibold">Outstanding</p>
                <p className="text-lg font-bold text-red-400 mt-1">{formatINR(reminderModal.outstanding)}</p>
              </div>
              <div className="bg-dark-700/60 p-3 rounded-lg border border-dark-600/20">
                <p className="text-[10px] text-dark-400 uppercase font-semibold">Days Overdue</p>
                <p className="text-lg font-bold text-dark-50 mt-1">{reminderModal.age} Days</p>
              </div>
            </div>

            {!aiMessage && !aiLoading && (
              <button onClick={generateReminder} className="btn-primary w-full bg-gradient-to-r from-accent to-amber-500 flex items-center justify-center gap-2 py-2.5">
                <Sparkles className="w-4 h-4" /> Generate {escalationLevel.name} Pitch
              </button>
            )}

            {aiLoading && (
              <div className="flex items-center justify-center gap-2 py-6 bg-dark-700/30 rounded-lg border border-dark-600/20">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
                <span className="text-sm text-dark-300">Drafting persistent escalation copy...</span>
              </div>
            )}

            {aiMessage && !aiLoading && (
              <div className="space-y-3.5">
                <textarea
                  value={aiMessage}
                  onChange={e => setAiMessage(e.target.value)}
                  className="w-full min-h-[140px] bg-dark-900 border border-dark-600 rounded-lg p-3 text-xs leading-relaxed text-dark-100"
                  rows={6}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={copyMessage} className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2 text-xs">
                    <Copy className="w-4 h-4" /> Copy Message
                  </button>
                  <button onClick={openWhatsApp} className="btn-primary flex-1 bg-gradient-to-r from-emerald-600 to-green-500 shadow-green-500/10 border-none flex items-center justify-center gap-2 py-2 text-xs text-white font-semibold">
                    <MessageCircle className="w-4 h-4" /> Open WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Record Partial Payment Modal */}
      <Modal isOpen={!!partialPaymentModal} onClose={() => setPartialPaymentModal(null)} title="Record Partial Payment">
        {partialPaymentModal && (
          <form onSubmit={handleRecordPartialPayment} className="space-y-4 font-sans text-xs">
            <div className="flex items-center gap-2 text-dark-100 border-b border-dark-600/30 pb-2">
              <FileText className="w-5 h-5 text-accent" />
              <span className="font-semibold">INV-{partialPaymentModal.invoiceNumber.split('-').pop()}</span>
              <span className="text-dark-400">•</span>
              <span className="text-dark-200">{partialPaymentModal.clientName}</span>
            </div>
            
            <div className="bg-dark-700/60 p-3.5 rounded-lg border border-dark-600/20 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold">Outstanding Balance</span>
                <p className="text-lg font-bold text-red-400 mt-1">{formatINR(partialPaymentModal.outstanding)}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold">Total Invoiced</span>
                <p className="text-sm font-bold text-dark-200 mt-1">{formatINR(partialPaymentModal.total)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Amount Received (₹) *</label>
                <input
                  type="number"
                  value={partialAmount}
                  onChange={e => setPartialAmount(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full bg-dark-900 border-dark-600"
                  max={partialPaymentModal.outstanding}
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="input-label">Payment Date</label>
                <input
                  type="date"
                  value={partialDate}
                  onChange={e => setPartialDate(e.target.value)}
                  className="w-full bg-dark-900 border-dark-600"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-2 py-2 flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" /> Save Payment Entry
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
