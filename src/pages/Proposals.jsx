// ==========================================
// FreelanceOS — Proposals Page
// ==========================================
import React, { useState, useMemo } from 'react';
import {
  Plus, Search, FileText, Trash2, Eye, Send, CheckCircle2,
  XCircle, Clock, IndianRupee, ArrowLeft, X, Filter,
  LayoutGrid, List, SortAsc, SortDesc,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { generateId, formatINR, formatDate, getRelativeTime } from '../utils/helpers';
import StatusBadge from '../components/UI/StatusBadge';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import ProposalPreview from '../components/Proposals/ProposalPreview';

// ---- Empty deliverable row helper ----
const emptyDeliverable = () => '';

// ---- Default form state ----
const defaultForm = {
  projectTitle: '',
  clientName: '',
  yourName: '',
  scope: '',
  deliverables: [''],
  timeline: 30,
  paymentTerms: '50% Advance',
  milestones: [],
  projectValue: '',
  validity: 15,
  termsAndConditions: '',
};

// ---- Payment term options ----
const paymentOptions = ['50% Advance', '100% Upfront', 'Milestone Based', 'Custom'];

export default function Proposals() {
  const { state, dispatch, addToast } = useData();
  const { proposals, clients, settings } = state;

  // ---- View state ----
  const [view, setView] = useState('list');            // 'list' | 'create' | 'preview'
  const [previewProposal, setPreviewProposal] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // ---- List controls ----
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'table'
  const [sortBy, setSortBy] = useState('newest');

  // ---- Form state ----
  const [form, setForm] = useState({ ...defaultForm, yourName: settings.yourName || '' });
  const [formErrors, setFormErrors] = useState({});

  // ---- Delete dialog ----
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });

  // =========================================
  // Filtering + Sorting
  // =========================================
  const filteredProposals = useMemo(() => {
    let list = [...proposals];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.projectTitle.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q)
      );
    }

    // Status
    if (statusFilter !== 'All') {
      list = list.filter((p) => p.status === statusFilter);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'value-high') return (b.projectValue || 0) - (a.projectValue || 0);
      if (sortBy === 'value-low') return (a.projectValue || 0) - (b.projectValue || 0);
      return 0;
    });

    return list;
  }, [proposals, search, statusFilter, sortBy]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = proposals.length;
    const accepted = proposals.filter((p) => p.status === 'Accepted').length;
    const totalValue = proposals.reduce((s, p) => s + (p.projectValue || 0), 0);
    const acceptedValue = proposals
      .filter((p) => p.status === 'Accepted')
      .reduce((s, p) => s + (p.projectValue || 0), 0);
    return { total, accepted, totalValue, acceptedValue };
  }, [proposals]);

  // =========================================
  // Form Helpers
  // =========================================
  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const updateDeliverable = (index, value) => {
    setForm((prev) => {
      const next = [...prev.deliverables];
      next[index] = value;
      return { ...prev, deliverables: next };
    });
  };

  const addDeliverable = () => {
    if (form.deliverables.length >= 5) {
      addToast('Maximum 5 deliverables allowed', 'error');
      return;
    }
    setForm((prev) => ({ ...prev, deliverables: [...prev.deliverables, ''] }));
  };

  const removeDeliverable = (index) => {
    if (form.deliverables.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index),
    }));
  };

  // Milestone helpers
  const addMilestone = () => {
    setForm((prev) => ({
      ...prev,
      milestones: [...prev.milestones, { name: '', amount: '' }],
    }));
  };

  const updateMilestone = (index, field, value) => {
    setForm((prev) => {
      const next = [...prev.milestones];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, milestones: next };
    });
  };

  const removeMilestone = (index) => {
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }));
  };

  // ---- Validate ----
  const validate = () => {
    const errors = {};
    if (!form.projectTitle.trim()) errors.projectTitle = 'Project title is required';
    if (!form.clientName.trim()) errors.clientName = 'Client name is required';
    if (!form.yourName.trim()) errors.yourName = 'Your name is required';
    if (!form.scope.trim()) errors.scope = 'Scope of work is required';
    const validDeliverables = form.deliverables.filter((d) => d.trim());
    if (validDeliverables.length === 0) errors.deliverables = 'At least one deliverable is required';
    if (!form.timeline || form.timeline < 1) errors.timeline = 'Valid timeline is required';
    if (!form.projectValue || Number(form.projectValue) <= 0) errors.projectValue = 'Valid project value is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ---- Submit ----
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) {
      addToast('Please fix the errors in the form', 'error');
      return;
    }

    const proposal = {
      id: editingId || generateId(),
      projectTitle: form.projectTitle.trim(),
      clientName: form.clientName.trim(),
      yourName: form.yourName.trim(),
      scope: form.scope.trim(),
      deliverables: form.deliverables.filter((d) => d.trim()),
      timeline: Number(form.timeline),
      paymentTerms: form.paymentTerms,
      milestones: form.milestones
        .filter((m) => m.name.trim())
        .map((m) => ({ name: m.name.trim(), amount: Number(m.amount) || 0 })),
      projectValue: Number(form.projectValue),
      status: editingId ? (proposals.find((p) => p.id === editingId)?.status || 'Draft') : 'Draft',
      validity: Number(form.validity) || 15,
      termsAndConditions: form.termsAndConditions.trim(),
      createdAt: editingId
        ? proposals.find((p) => p.id === editingId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };

    if (editingId) {
      dispatch({ type: 'UPDATE_PROPOSAL', payload: proposal });
      addToast('Proposal updated successfully!', 'success');
    } else {
      dispatch({ type: 'ADD_PROPOSAL', payload: proposal });
      dispatch({
        type: 'ADD_ACTIVITY',
        payload: {
          id: generateId(),
          type: 'proposal',
          message: `Proposal "${proposal.projectTitle}" created for ${proposal.clientName}`,
          timestamp: new Date().toISOString(),
          icon: 'FileText',
        },
      });
      addToast('Proposal created successfully!', 'success');
    }

    setPreviewProposal(proposal);
    setEditingId(null);
    setView('preview');
  };

  // ---- Delete ----
  const handleDelete = (id) => {
    dispatch({ type: 'DELETE_PROPOSAL', payload: id });
    addToast('Proposal deleted', 'success');
    if (previewProposal?.id === id) {
      setView('list');
      setPreviewProposal(null);
    }
  };

  // ---- Open Create ----
  const openCreate = () => {
    setForm({ ...defaultForm, yourName: settings.yourName || '' });
    setFormErrors({});
    setEditingId(null);
    setView('create');
  };

  // ---- Open Edit ----
  const openEdit = (p) => {
    setForm({
      projectTitle: p.projectTitle,
      clientName: p.clientName,
      yourName: p.yourName,
      scope: p.scope,
      deliverables: p.deliverables?.length ? [...p.deliverables] : [''],
      timeline: p.timeline,
      paymentTerms: p.paymentTerms,
      milestones: p.milestones?.length ? p.milestones.map((m) => ({ ...m })) : [],
      projectValue: p.projectValue,
      validity: p.validity || 15,
      termsAndConditions: p.termsAndConditions || '',
    });
    setFormErrors({});
    setEditingId(p.id);
    setView('create');
  };

  // ---- Open Preview ----
  const openPreview = (p) => {
    setPreviewProposal(p);
    setView('preview');
  };

  // ---- Status icon ----
  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'Draft': return <Clock className="w-4 h-4 text-gray-400" />;
      case 'Sent': return <Send className="w-4 h-4 text-blue-400" />;
      case 'Accepted': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'Rejected': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <FileText className="w-4 h-4 text-dark-400" />;
    }
  };

  // =========================================
  // RENDER — PREVIEW
  // =========================================
  if (view === 'preview' && previewProposal) {
    // Ensure we show latest data from state
    const latest = proposals.find((p) => p.id === previewProposal.id) || previewProposal;
    return (
      <div className="page-enter">
        <ProposalPreview
          proposal={latest}
          onBack={() => { setView('list'); setPreviewProposal(null); }}
        />
      </div>
    );
  }

  // =========================================
  // RENDER — CREATE / EDIT FORM
  // =========================================
  if (view === 'create') {
    return (
      <div className="page-enter">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="btn-ghost flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-dark-50">
              {editingId ? 'Edit Proposal' : 'Create New Proposal'}
            </h1>
            <p className="text-sm text-dark-400 mt-0.5">
              Fill in the details to generate a professional proposal
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Info */}
          <div className="glass-card p-6">
            <h3 className="section-title mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" /> Project Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Title */}
              <div>
                <label className="input-label">Project Title *</label>
                <input
                  type="text"
                  value={form.projectTitle}
                  onChange={(e) => updateField('projectTitle', e.target.value)}
                  placeholder="e.g. E-commerce Platform"
                  className={`w-full ${formErrors.projectTitle ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                />
                {formErrors.projectTitle && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.projectTitle}</p>
                )}
              </div>

              {/* Client Name */}
              <div>
                <label className="input-label">Client Name *</label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(e) => updateField('clientName', e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  list="client-suggestions"
                  className={`w-full ${formErrors.clientName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                />
                <datalist id="client-suggestions">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                {formErrors.clientName && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.clientName}</p>
                )}
              </div>

              {/* Your Name */}
              <div>
                <label className="input-label">Your Name *</label>
                <input
                  type="text"
                  value={form.yourName}
                  onChange={(e) => updateField('yourName', e.target.value)}
                  placeholder="Your full name"
                  className={`w-full ${formErrors.yourName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                />
                {formErrors.yourName && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.yourName}</p>
                )}
              </div>

              {/* Project Value */}
              <div>
                <label className="input-label">Project Value (₹) *</label>
                <input
                  type="number"
                  value={form.projectValue}
                  onChange={(e) => updateField('projectValue', e.target.value)}
                  placeholder="e.g. 120000"
                  min="0"
                  className={`w-full ${formErrors.projectValue ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                />
                {form.projectValue > 0 && (
                  <p className="text-xs text-accent mt-1">{formatINR(form.projectValue)}</p>
                )}
                {formErrors.projectValue && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.projectValue}</p>
                )}
              </div>
            </div>
          </div>

          {/* Scope */}
          <div className="glass-card p-6">
            <h3 className="section-title mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" /> Scope of Work
            </h3>
            <div>
              <label className="input-label">Describe the scope *</label>
              <textarea
                value={form.scope}
                onChange={(e) => updateField('scope', e.target.value)}
                rows={4}
                placeholder="Describe the project scope, objectives, and what's included..."
                className={`w-full resize-none ${formErrors.scope ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
              />
              {formErrors.scope && (
                <p className="text-xs text-red-400 mt-1">{formErrors.scope}</p>
              )}
            </div>
          </div>

          {/* Deliverables */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent" /> Deliverables
              </h3>
              <span className="text-xs text-dark-400">{form.deliverables.length}/5</span>
            </div>
            {formErrors.deliverables && (
              <p className="text-xs text-red-400 mb-3">{formErrors.deliverables}</p>
            )}
            <div className="space-y-3">
              {form.deliverables.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-accent w-6 text-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={d}
                    onChange={(e) => updateDeliverable(i, e.target.value)}
                    placeholder={`Deliverable ${i + 1}`}
                    className="flex-1"
                  />
                  {form.deliverables.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDeliverable(i)}
                      className="p-2 text-dark-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.deliverables.length < 5 && (
              <button
                type="button"
                onClick={addDeliverable}
                className="mt-3 text-sm text-accent hover:text-amber-400 font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Deliverable
              </button>
            )}
          </div>

          {/* Timeline + Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timeline */}
            <div className="glass-card p-6">
              <h3 className="section-title mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" /> Timeline & Validity
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="input-label">Timeline (days) *</label>
                  <input
                    type="number"
                    value={form.timeline}
                    onChange={(e) => updateField('timeline', e.target.value)}
                    min="1"
                    className={`w-full ${formErrors.timeline ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                  />
                  {formErrors.timeline && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.timeline}</p>
                  )}
                </div>
                <div>
                  <label className="input-label">Proposal Validity (days)</label>
                  <input
                    type="number"
                    value={form.validity}
                    onChange={(e) => updateField('validity', e.target.value)}
                    min="1"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="glass-card p-6">
              <h3 className="section-title mb-4 flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-accent" /> Payment Terms
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="input-label">Payment Structure</label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => updateField('paymentTerms', e.target.value)}
                    className="w-full"
                  >
                    {paymentOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {form.paymentTerms === 'Milestone Based' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="input-label mb-0">Milestones</label>
                      <button
                        type="button"
                        onClick={addMilestone}
                        className="text-xs text-accent hover:text-amber-400 font-medium flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {form.milestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => updateMilestone(i, 'name', e.target.value)}
                            placeholder="Milestone name"
                            className="flex-1"
                          />
                          <input
                            type="number"
                            value={m.amount}
                            onChange={(e) => updateMilestone(i, 'amount', e.target.value)}
                            placeholder="₹ Amount"
                            className="w-28"
                          />
                          <button
                            type="button"
                            onClick={() => removeMilestone(i)}
                            className="p-2 text-dark-400 hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {form.milestones.length === 0 && (
                        <p className="text-xs text-dark-400">Click "Add" to define milestones</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="glass-card p-6">
            <h3 className="section-title mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" /> Terms & Conditions
            </h3>
            <textarea
              value={form.termsAndConditions}
              onChange={(e) => updateField('termsAndConditions', e.target.value)}
              rows={3}
              placeholder="Specify any terms like IP ownership, revision policy, cancellation policy..."
              className="w-full resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setView('list')} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {editingId ? 'Update & Preview' : 'Create & Preview'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =========================================
  // RENDER — PROPOSAL LIST
  // =========================================
  return (
    <div className="page-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 tracking-tight">Proposals</h1>
          <p className="text-sm text-dark-400 mt-1">
            Create, manage, and share professional proposals
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Proposal
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Accepted', value: stats.accepted, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Total Value', value: formatINR(stats.totalValue), icon: IndianRupee, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Won Value', value: formatINR(stats.acceptedValue), icon: IndianRupee, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-dark-400">{s.label}</p>
              <p className="text-sm font-bold text-dark-50 mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="glass-card p-3 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search proposals..."
              className="w-full pl-9 bg-dark-700/50 border-dark-600/50"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-dark-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-dark-700/50 border-dark-600/50 text-sm min-w-[120px]"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-dark-700/50 border-dark-600/50 text-sm min-w-[130px]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="value-high">Value: High → Low</option>
            <option value="value-low">Value: Low → High</option>
          </select>

          {/* Layout toggle */}
          <div className="flex items-center border border-dark-600/50 rounded-lg overflow-hidden flex-shrink-0">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-2 transition-colors ${
                layoutMode === 'grid'
                  ? 'bg-accent/20 text-accent'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode('table')}
              className={`p-2 transition-colors ${
                layoutMode === 'table'
                  ? 'bg-accent/20 text-accent'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredProposals.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-dark-700 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-dark-400" />
          </div>
          <h3 className="text-lg font-semibold text-dark-200 mb-2">
            {proposals.length === 0 ? 'No proposals yet' : 'No proposals match your filters'}
          </h3>
          <p className="text-sm text-dark-400 mb-6">
            {proposals.length === 0
              ? 'Create your first professional proposal to send to clients'
              : 'Try adjusting your search or filter criteria'}
          </p>
          {proposals.length === 0 && (
            <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Proposal
            </button>
          )}
        </div>
      ) : layoutMode === 'grid' ? (
        /* ---- Grid View ---- */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProposals.map((p) => (
            <div
              key={p.id}
              className="glass-card-hover group relative overflow-hidden"
            >
              {/* Top accent */}
              <div
                className="h-1 w-full"
                style={{
                  background:
                    p.status === 'Accepted'
                      ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                      : p.status === 'Rejected'
                      ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                      : p.status === 'Sent'
                      ? 'linear-gradient(90deg, #3B82F6, #2563EB)'
                      : 'linear-gradient(90deg, #F97316, #F59E0B)',
                }}
              />
              <div className="p-5" onClick={() => openPreview(p)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-dark-50 truncate">
                      {p.projectTitle}
                    </h3>
                    <p className="text-xs text-dark-400 mt-0.5">{p.clientName}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-bold text-gradient">
                    {formatINR(p.projectValue)}
                  </span>
                  <span className="text-xs text-dark-400">
                    {getRelativeTime(p.createdAt)}
                  </span>
                </div>

                {p.deliverables?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dark-600/30">
                    <p className="text-xs text-dark-400">
                      {p.deliverables.length} deliverable{p.deliverables.length !== 1 ? 's' : ''} · {p.timeline} days
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center border-t border-dark-600/30 divide-x divide-dark-600/30">
                <button
                  onClick={() => openPreview(p)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-dark-300 hover:text-accent hover:bg-dark-700/50 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-dark-300 hover:text-blue-400 hover:bg-dark-700/50 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setDeleteDialog({ open: true, id: p.id })}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-dark-300 hover:text-red-400 hover:bg-dark-700/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ---- Table/List View ---- */
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600/50">
                  <th className="text-left px-5 py-3.5 table-header">Proposal</th>
                  <th className="text-left px-5 py-3.5 table-header hidden sm:table-cell">Client</th>
                  <th className="text-left px-5 py-3.5 table-header hidden md:table-cell">Value</th>
                  <th className="text-left px-5 py-3.5 table-header hidden lg:table-cell">Date</th>
                  <th className="text-left px-5 py-3.5 table-header">Status</th>
                  <th className="text-right px-5 py-3.5 table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600/30">
                {filteredProposals.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-dark-700/30 transition-colors cursor-pointer"
                    onClick={() => openPreview(p)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <StatusIcon status={p.status} />
                        <div>
                          <p className="text-sm font-medium text-dark-50">{p.projectTitle}</p>
                          <p className="text-xs text-dark-400 sm:hidden">{p.clientName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-dark-200 hidden sm:table-cell">
                      {p.clientName}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm font-semibold text-gradient">
                        {formatINR(p.projectValue)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-dark-400 hidden lg:table-cell">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openPreview(p)}
                          className="p-2 text-dark-400 hover:text-accent rounded-lg hover:bg-dark-700/50 transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 text-dark-400 hover:text-blue-400 rounded-lg hover:bg-dark-700/50 transition-colors"
                          title="Edit"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ open: true, id: p.id })}
                          className="p-2 text-dark-400 hover:text-red-400 rounded-lg hover:bg-dark-700/50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: null })}
        onConfirm={() => handleDelete(deleteDialog.id)}
        title="Delete Proposal"
        message="Are you sure you want to delete this proposal? This action cannot be undone."
      />
    </div>
  );
}
