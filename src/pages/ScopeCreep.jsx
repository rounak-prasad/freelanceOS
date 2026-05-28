// ==========================================
// FreelanceOS — Scope Guard (Change Request Tracker)
// ==========================================
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR, generateId, generateInvoiceNumber, calculateGST } from '../utils/helpers';
import Modal from '../components/UI/Modal';
import {
  ShieldAlert, Plus, Check, X, FileText, Sparkles,
  MessageCircle, Copy, ChevronDown, Trash2, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ScopeCreep() {
  const { state, dispatch, addToast } = useData();
  const [logCRModal, setLogCRModal] = useState(false);
  const [draftCR, setDraftCR] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    projectId: '',
    title: '',
    description: '',
    estimatedHours: '',
    estimatedAmount: '',
    notes: '',
  });

  const changeRequests = state.changeRequests || [];
  const milestoneProjects = state.milestoneProjects || [];

  // Summary Metrics
  const pendingCount = useMemo(() => changeRequests.filter(cr => cr.status === 'Pending').length, [changeRequests]);
  const pendingAmount = useMemo(() => changeRequests.filter(cr => cr.status === 'Pending').reduce((s, cr) => s + cr.estimatedAmount, 0), [changeRequests]);

  const approvedUnbilledCount = useMemo(() => changeRequests.filter(cr => cr.status === 'Approved').length, [changeRequests]);
  const approvedUnbilledAmount = useMemo(() => changeRequests.filter(cr => cr.status === 'Approved').reduce((s, cr) => s + cr.estimatedAmount, 0), [changeRequests]);

  const billedAmount = useMemo(() => changeRequests.filter(cr => cr.status === 'Billed').reduce((s, cr) => s + cr.estimatedAmount, 0), [changeRequests]);

  // Handle Log Change Request
  function handleProjectChange(projectId) {
    const proj = milestoneProjects.find(p => p.id === projectId);
    setForm(prev => ({
      ...prev,
      projectId,
    }));
  }

  function handleLogCR(e) {
    e.preventDefault();
    if (!form.projectId || !form.title || !form.estimatedAmount) {
      addToast('Please fill in all required fields', 'error');
      return;
    }
    const project = milestoneProjects.find(p => p.id === form.projectId);
    const cr = {
      id: generateId(),
      projectId: form.projectId,
      projectName: project.name,
      clientName: project.clientName,
      clientId: project.clientId,
      title: form.title,
      description: form.description,
      requestedBy: 'client',
      estimatedHours: Number(form.estimatedHours) || 0,
      estimatedAmount: Number(form.estimatedAmount),
      status: 'Pending',
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      billedInvoiceId: null,
      clientApprovalMethod: null,
      notes: form.notes,
    };
    dispatch({ type: 'ADD_CHANGE_REQUEST', payload: cr });
    addToast('Change Request logged!');
    setLogCRModal(false);
    setForm({ projectId: '', title: '', description: '', estimatedHours: '', estimatedAmount: '', notes: '' });
  }

  function approveCR(id) {
    dispatch({
      type: 'UPDATE_CHANGE_REQUEST',
      payload: { id, status: 'Approved', approvedAt: new Date().toISOString(), clientApprovalMethod: 'WhatsApp' }
    });
    addToast('Change Request approved!');
  }

  function rejectCR(id) {
    dispatch({
      type: 'UPDATE_CHANGE_REQUEST',
      payload: { id, status: 'Rejected' }
    });
    addToast('Change Request marked as Rejected');
  }

  function deleteCR(id) {
    dispatch({ type: 'DELETE_CHANGE_REQUEST', payload: id });
    addToast('Change Request deleted');
  }

  function billCR(cr) {
    const project = milestoneProjects.find(p => p.id === cr.projectId);
    if (!project) return;

    const subtotal = cr.estimatedAmount;
    const gst = calculateGST(subtotal, 18, false);
    const invoice = {
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(state.settings.invoicePrefix, state.settings.lastInvoiceNumber),
      clientId: cr.clientId,
      clientName: cr.clientName,
      clientCompany: '',
      clientGstin: '',
      clientAddress: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      placeOfSupply: state.settings.gstin ? state.settings.gstin.substring(0, 2) : '',
      lineItems: [{ description: `Scope Change: ${cr.title} — ${cr.description}`, sacCode: '998314', quantity: 1, rate: cr.estimatedAmount }],
      gstRate: 18,
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
    dispatch({
      type: 'UPDATE_CHANGE_REQUEST',
      payload: { id: cr.id, status: 'Billed', billedInvoiceId: invoice.id }
    });
    dispatch({
      type: 'ADD_ACTIVITY',
      payload: {
        id: generateId(),
        type: 'invoice',
        message: `Invoice ${invoice.invoiceNumber} generated for change request "${cr.title}"`,
        timestamp: new Date().toISOString(),
        icon: 'FileText',
      }
    });
    addToast(`Invoice ${invoice.invoiceNumber} generated for scope change!`);
  }

  // AI draft call using Claude API
  async function generateAIDraft(cr) {
    setDraftCR(cr);
    setDraftText('');
    setDraftLoading(true);

    const systemPrompt = "You are a professional freelance business consultant helping Indian freelancers protect their scope boundaries.";
    const prompt = `Write a professional WhatsApp/email message asking the client to formally approve a scope change:
Client: ${cr.clientName}
Project: ${cr.projectName}
Change requested: ${cr.title} - ${cr.description}
Additional cost: ₹${cr.estimatedAmount}
Estimated time: ${cr.estimatedHours} hours

The message should: (1) recap the original scope boundary, (2) describe what was requested beyond it, (3) state the additional cost clearly, (4) ask for written confirmation. Tone: professional but not aggressive. Indian business context. Under 120 words. No introduction, no markdown, return only the ready message.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      const text = data.content?.map(b => b.text || '').join('') || '';
      setDraftText(text);
    } catch (err) {
      // Fallback in case of API issues
      const fallback = `Hi ${cr.clientName}, regarding the ${cr.projectName} project, the request for "${cr.title}" lies outside of our original Statement of Work (SOW). I am happy to deliver this! It will require around ${cr.estimatedHours} additional hours at an added cost of ${formatINR(cr.estimatedAmount)}. Please reply to this message to confirm your approval so I can log it and begin work. Thanks! — ${state.settings.yourName || 'Your Name'}`;
      setDraftText(fallback);
      addToast('AI Draft failed. Loaded professional fallback.', 'warning');
    } finally {
      setDraftLoading(false);
    }
  }

  // Scope Creep Chart Data (past 6 months)
  const chartData = useMemo(() => {
    // Generate last 6 months
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: d.toLocaleDateString('en-IN', { month: 'short' }),
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        amount: 0,
      });
    }
    
    changeRequests.forEach(cr => {
      const d = new Date(cr.requestedAt);
      const m = d.getMonth();
      const y = d.getFullYear();
      const match = months.find(mo => mo.monthIndex === m && mo.year === y);
      if (match && cr.status !== 'Rejected') {
        match.amount += cr.estimatedAmount;
      }
    });

    return months;
  }, [changeRequests]);

  const thClass = 'table-header px-4 py-3 text-left';

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-accent animate-pulse" />
            Scope Guard
          </h1>
          <p className="text-sm text-dark-300 mt-0.5">Log, approve, and bill every change request. Stop giving free work.</p>
        </div>
        <button onClick={() => setLogCRModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Log Change Request
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider">Pending Approval</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-bold text-dark-100">{formatINR(pendingAmount)}</p>
            <p className="text-xs text-dark-400">({pendingCount} request{pendingCount !== 1 ? 's' : ''})</p>
          </div>
          <p className="text-[11px] text-dark-400 mt-1">Awaiting client validation</p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Approved & Unbilled</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-bold text-amber-400">{formatINR(approvedUnbilledAmount)}</p>
            <p className="text-xs text-dark-400">({approvedUnbilledCount} request{approvedUnbilledCount !== 1 ? 's' : ''})</p>
          </div>
          <p className="text-[11px] text-amber-500/80 mt-1 font-medium">⚠️ Money left on the table. Bill these now!</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Billed History</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{formatINR(billedAmount)}</p>
          <p className="text-[11px] text-dark-400 mt-1">Successfully claimed extra revenues</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-600/30">
          <h3 className="text-sm font-semibold text-dark-100">All Change Requests</h3>
        </div>
        {changeRequests.length === 0 ? (
          <div className="p-12 text-center text-dark-400 text-sm">
            No change requests logged. Protect your hours by logging the next extra request!
          </div>
        ) : (
          <div className="overflow-x-auto font-sans">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600/20 bg-dark-900/40">
                  <th className={thClass}>Project / Client</th>
                  <th className={thClass}>Title & Description</th>
                  <th className={thClass}>Date</th>
                  <th className={thClass + ' text-right'}>Amount</th>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass + ' text-right'}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600/10">
                {changeRequests.map(cr => (
                  <tr key={cr.id} className="hover:bg-dark-700/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-dark-100">{cr.projectName}</p>
                      <p className="text-xs text-dark-300">{cr.clientName}</p>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="text-sm font-semibold text-dark-50">{cr.title}</p>
                      <p className="text-xs text-dark-300 line-clamp-2 mt-0.5">{cr.description}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-dark-300 whitespace-nowrap">
                      {new Date(cr.requestedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-dark-50 text-sm">
                      {formatINR(cr.estimatedAmount)}
                      {cr.estimatedHours > 0 && <span className="block text-[10px] text-dark-400 font-normal">({cr.estimatedHours}h)</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-dark-300">
                      {cr.clientApprovalMethod || '-'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`badge border ${
                        cr.status === 'Billed' ? 'bg-green-500/10 text-emerald-400 border-green-500/20' :
                        cr.status === 'Approved' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        cr.status === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {cr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {cr.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => generateAIDraft(cr)}
                              className="p-1.5 bg-accent/10 text-accent hover:bg-accent/20 rounded transition-colors"
                              title="Draft Approval Message"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => approveCR(cr.id)}
                              className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                              title="Mark Approved"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => rejectCR(cr.id)}
                              className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                              title="Mark Rejected"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {cr.status === 'Approved' && (
                          <button
                            onClick={() => billCR(cr)}
                            className="px-2.5 py-1 bg-accent/15 text-accent hover:bg-accent/25 rounded transition-all text-xs font-semibold flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" /> Bill It
                          </button>
                        )}
                        {cr.status === 'Billed' && cr.billedInvoiceId && (
                          <span className="text-[10px] text-dark-300 font-medium italic">
                            Billed on INV-{cr.billedInvoiceId.split('-').pop() || cr.billedInvoiceId}
                          </span>
                        )}
                        <button
                          onClick={() => deleteCR(cr.id)}
                          className="p-1.5 text-dark-400 hover:text-red-400 rounded transition-colors"
                          title="Delete Request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scope Creep Leakage Chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-dark-100 mb-4">Historical Scope Leakage Trend (Approved/Pending Extra Scope)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#525252" fontSize={11} tickLine={false} />
              <YAxis stroke="#525252" fontSize={11} tickFormatter={(v) => `₹${v/1000}k`} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', borderRadius: '8px' }}
                labelStyle={{ color: '#FAFAFA', fontWeight: 'bold' }}
                itemStyle={{ color: '#F97316' }}
                formatter={(v) => [formatINR(v), 'Extra Scope Cost']}
              />
              <Bar dataKey="amount" fill="url(#scopeColorGrad)" radius={[4, 4, 0, 0]} barSize={32} />
              <defs>
                <linearGradient id="scopeColorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#EA580C" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Log CR Modal */}
      <Modal isOpen={logCRModal} onClose={() => setLogCRModal(false)} title="Log Extra Scope Change">
        <form onSubmit={handleLogCR} className="space-y-4">
          <div>
            <label className="input-label">Project *</label>
            <div className="relative">
              <select value={form.projectId} onChange={e => handleProjectChange(e.target.value)} className="w-full appearance-none" required>
                <option value="">Select project...</option>
                {milestoneProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.clientName})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="input-label">Change Title / Name *</label>
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Extra revision round, third party API integrations"
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="input-label">Description of Extra Scope</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Client requested added feature details..."
              className="w-full min-h-[85px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Estimated Cost (₹) *</label>
              <input
                type="number"
                value={form.estimatedAmount}
                onChange={e => setForm(p => ({ ...p, estimatedAmount: e.target.value }))}
                min="0"
                className="w-full"
                required
              />
            </div>
            <div>
              <label className="input-label">Estimated Hours</label>
              <input
                type="number"
                value={form.estimatedHours}
                onChange={e => setForm(p => ({ ...p, estimatedHours: e.target.value }))}
                min="0"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Internal Context / Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Approved verbally on call, Slack thread, etc."
              className="w-full min-h-[60px]"
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-2">Log Change Request</button>
        </form>
      </Modal>

      {/* AI Draft Modal */}
      <Modal isOpen={!!draftCR} onClose={() => setDraftCR(null)} title="AI Scope Approval Pitch">
        <div className="space-y-4">
          <p className="text-xs text-dark-300 leading-relaxed">
            Send this highly customized request to the client. Keep a solid written record to prevent scope-creep bleeding.
          </p>
          
          {draftLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 bg-dark-700 rounded-lg border border-dark-600/30">
              <Clock className="w-8 h-8 text-accent animate-spin" />
              <p className="text-xs text-dark-300">Drafting professional pitch...</p>
            </div>
          ) : (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="w-full min-h-[160px] bg-dark-900 border border-dark-600 rounded-lg p-3 text-xs leading-relaxed text-dark-50 focus:outline-none"
            />
          )}

          {!draftLoading && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(draftText);
                  addToast('Copied approval draft!');
                }}
                className="btn-secondary flex items-center gap-2 text-xs py-2"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Pitch
              </button>
              
              <button
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(draftText)}`, '_blank');
                }}
                className="btn-primary bg-gradient-to-r from-emerald-600 to-green-500 shadow-green-500/10 flex items-center gap-2 text-xs py-2 border-none"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Open WhatsApp
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
