// ==========================================
// FreelanceOS — Recurring Invoices Page
// ==========================================
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { formatINR, generateId, generateInvoiceNumber, calculateGST } from '../utils/helpers';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import {
  Repeat, Plus, AlertTriangle, FileText, Trash2,
  ChevronDown, Calendar, Clock, ToggleLeft, ToggleRight,
} from 'lucide-react';

function ScheduleCard({ s, badge, freqLabels, generateInvoice, toggleActive, setDeleteId }) {
  const [showPreview, setShowPreview] = useState(false);
  const next3Dates = useMemo(() => {
    if (!s.nextDueDate) return [];
    const dates = [];
    let current = new Date(s.nextDueDate);
    for (let i = 0; i < 3; i++) {
      dates.push(new Date(current));
      if (s.frequency === 'weekly') current.setDate(current.getDate() + 7);
      else if (s.frequency === 'biweekly') current.setDate(current.getDate() + 14);
      else current.setMonth(current.getMonth() + 1);
    }
    return dates;
  }, [s.nextDueDate, s.frequency]);

  return (
    <div className={`glass-card p-5 flex flex-col justify-between ${!s.isActive ? 'opacity-60' : ''}`}>
      <div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-dark-50">{s.clientName}</h3>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${s.frequency === 'monthly' ? 'bg-accent/10 text-accent' : 'bg-blue-500/10 text-blue-400'}`}>
              {freqLabels[s.frequency]}
            </span>
          </div>
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.class}`}>
            {badge.text}
          </span>
        </div>

        <p className="text-sm text-dark-200 mb-2">{s.description}</p>

        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-lg font-bold text-dark-50">{formatINR(s.amount)}</span>
          <span className="text-dark-400 text-xs flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Next: {new Date(s.nextDueDate).toLocaleDateString('en-IN')}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Collapsible Next 3 Invoices Preview */}
        {s.isActive && (
          <div className="border-t border-dark-600/30 pt-2.5">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-dark-300 hover:text-dark-100 flex items-center gap-1 transition-colors focus:outline-none"
            >
              <Clock className="w-3 h-3 text-accent" />
              <span>{showPreview ? 'Hide Projections' : 'Show Next 3 Invoices'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showPreview ? 'rotate-180' : ''}`} />
            </button>
            
            {showPreview && (
              <div className="mt-2 space-y-1.5 bg-dark-950/80 p-2.5 rounded-lg border border-dark-600/30 animate-fade-in">
                {next3Dates.map((date, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] text-dark-200">
                    <span className="text-dark-300">Invoice #{idx + 1} ({date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})</span>
                    <span className="font-mono text-dark-100">{date.toLocaleDateString('en-IN')}</span>
                    <span className="text-accent font-semibold">{formatINR(s.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {s.isActive && (
            <button
              onClick={() => generateInvoice(s)}
              className="flex-1 btn-primary text-center flex items-center justify-center gap-2 text-xs"
            >
              <FileText className="w-3.5 h-3.5" /> Generate Invoice
            </button>
          )}
          <button
            onClick={() => toggleActive(s.id)}
            className="p-2 rounded-lg text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors"
            title={s.isActive ? 'Pause' : 'Activate'}
          >
            {s.isActive ? <ToggleRight className="w-5 h-5 text-accent" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setDeleteId(s.id)}
            className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecurringInvoices() {
  const { state, dispatch, addToast } = useData();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const schedules = state.recurringSchedules || [];

  // Due/overdue count
  const alertCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return schedules.filter(s => s.isActive && new Date(s.nextDueDate) <= today).length;
  }, [schedules]);

  // Form state
  const [form, setForm] = useState({
    clientId: '',
    clientName: '',
    description: '',
    amount: '',
    gstRate: 18,
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
  });

  function handleClientChange(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    setForm(prev => ({
      ...prev,
      clientId,
      clientName: client ? client.name : '',
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientName || !form.description || !form.amount) {
      addToast('Please fill in all fields', 'error');
      return;
    }
    const schedule = {
      id: generateId(),
      clientId: form.clientId,
      clientName: form.clientName,
      description: form.description,
      amount: Number(form.amount),
      gstRate: Number(form.gstRate),
      frequency: form.frequency,
      nextDueDate: form.startDate,
      lastInvoiceDate: null,
      isActive: true,
    };
    dispatch({ type: 'ADD_RECURRING_SCHEDULE', payload: schedule });
    addToast('Recurring schedule created!');
    setShowModal(false);
    setForm({ clientId: '', clientName: '', description: '', amount: '', gstRate: 18, frequency: 'monthly', startDate: new Date().toISOString().split('T')[0] });
  }

  function toggleActive(id) {
    const s = schedules.find(sc => sc.id === id);
    if (s) {
      dispatch({ type: 'UPDATE_RECURRING_SCHEDULE', payload: { id, isActive: !s.isActive } });
      addToast(s.isActive ? 'Schedule paused' : 'Schedule activated');
    }
  }

  function generateInvoice(schedule) {
    const subtotal = schedule.amount;
    const gst = calculateGST(subtotal, schedule.gstRate, false);

    const invoice = {
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(state.settings.invoicePrefix, state.settings.lastInvoiceNumber),
      clientId: schedule.clientId,
      clientName: schedule.clientName,
      clientCompany: '',
      clientGstin: '',
      clientAddress: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + (state.settings.defaultPaymentTerms || state.settings.defaultPaymentDays || 15) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      placeOfSupply: state.settings.gstin ? state.settings.gstin.substring(0, 2) : '',
      lineItems: [{ description: schedule.description, sacCode: '998314', quantity: 1, rate: schedule.amount }],
      gstRate: schedule.gstRate,
      subtotal,
      isInterState: false,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      total: gst.total,
      status: 'Unpaid',
      paidDate: null,
      notes: state.settings.defaultTerms || '',
      supplierName: state.settings.yourName || state.settings.businessName,
      supplierGstin: state.settings.gstin,
      supplierAddress: state.settings.address,
      amountPaid: 0,
    };

    dispatch({ type: 'ADD_INVOICE', payload: invoice });

    // Calculate next due date
    const next = new Date(schedule.nextDueDate);
    if (schedule.frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (schedule.frequency === 'biweekly') next.setDate(next.getDate() + 14);
    else next.setMonth(next.getMonth() + 1);

    dispatch({
      type: 'UPDATE_RECURRING_SCHEDULE',
      payload: {
        id: schedule.id,
        lastInvoiceDate: new Date().toISOString().split('T')[0],
        nextDueDate: next.toISOString().split('T')[0],
      },
    });

    dispatch({
      type: 'ADD_ACTIVITY',
      payload: {
        id: generateId(),
        type: 'invoice',
        message: `Recurring invoice ${invoice.invoiceNumber} generated for ${schedule.clientName}`,
        timestamp: new Date().toISOString(),
        icon: 'FileText',
      },
    });

    addToast(`Invoice ${invoice.invoiceNumber} generated!`);
    navigate('/invoice-history');
  }

  function handleDelete() {
    dispatch({ type: 'DELETE_RECURRING_SCHEDULE', payload: deleteId });
    addToast('Schedule deleted');
    setDeleteId(null);
  }

  function getDueBadge(schedule) {
    if (!schedule.isActive) return { text: 'Paused', class: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(schedule.nextDueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, class: 'bg-red-500/10 text-red-400 border-red-500/20' };
    if (diff === 0) return { text: 'Due today', class: 'bg-red-500/10 text-red-400 border-red-500/20' };
    if (diff <= 3) return { text: `Due in ${diff}d`, class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { text: `Due in ${diff}d`, class: 'bg-accent/10 text-accent border-accent/20' };
  }

  const freqLabels = { weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly' };

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            <Repeat className="w-6 h-6 text-accent" />
            Recurring Invoices
          </h1>
          <p className="text-sm text-dark-300 mt-0.5">Automate billing for your retainer clients.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Schedule
        </button>
      </div>

      {/* Alert Banner */}
      {alertCount > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 animate-pulse-glow">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400 font-medium">
            {alertCount} recurring invoice{alertCount !== 1 ? 's' : ''} need attention (due or overdue)
          </p>
        </div>
      )}

      {/* Schedule Cards */}
      {schedules.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Repeat className="w-12 h-12 text-dark-400 mx-auto mb-3" />
          <p className="text-dark-300">No recurring schedules</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4">Create Your First Schedule</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map(s => {
            const badge = getDueBadge(s);
            return (
              <ScheduleCard
                key={s.id}
                s={s}
                badge={badge}
                freqLabels={freqLabels}
                generateInvoice={generateInvoice}
                toggleActive={toggleActive}
                setDeleteId={setDeleteId}
              />
            );
          })}
        </div>
      )}

      {/* New Schedule Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Recurring Schedule">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Client</label>
            <div className="relative">
              <select value={form.clientId} onChange={e => handleClientChange(e.target.value)} className="w-full appearance-none">
                <option value="">Select client...</option>
                {state.clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="input-label">Service Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Monthly Social Media Retainer" className="w-full" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Amount (₹)</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} min="0" className="w-full" required />
            </div>
            <div>
              <label className="input-label">GST Rate</label>
              <div className="relative">
                <select value={form.gstRate} onChange={e => setForm(p => ({ ...p, gstRate: Number(e.target.value) }))} className="w-full appearance-none">
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Frequency</label>
              <div className="relative">
                <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))} className="w-full appearance-none">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="input-label">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full" required />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full mt-2">Create Schedule</button>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Schedule" message="Are you sure you want to delete this recurring schedule?" />
    </div>
  );
}
