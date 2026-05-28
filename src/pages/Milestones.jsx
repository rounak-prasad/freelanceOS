// ==========================================
// FreelanceOS — Milestones Page
// ==========================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { formatINR, generateId, generateInvoiceNumber, calculateGST } from '../utils/helpers';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import {
  Flag, Plus, CheckCircle, FileText, Circle, Trash2,
  ChevronDown, Calendar, IndianRupee, X, ShieldAlert,
} from 'lucide-react';

export default function Milestones() {
  const { state, dispatch, addToast } = useData();
  const navigate = useNavigate();
  const [showNewProject, setShowNewProject] = useState(false);
  const [deleteProject, setDeleteProject] = useState(null);
  const projects = state.milestoneProjects || [];

  // Collapsible lists of CRs per project
  const [expandedCRProject, setExpandedCRProject] = useState(null);
  
  // Log Change Request State
  const [logCRFor, setLogCRFor] = useState(null);
  const [crForm, setCrForm] = useState({
    title: '',
    description: '',
    estimatedAmount: '',
    estimatedHours: '',
    notes: '',
  });

  // Edit completion percentages
  const [editingPctFor, setEditingPctFor] = useState(null);
  const [pctInput, setPctInput] = useState('');

  // New project form
  const [pForm, setPForm] = useState({ name: '', clientId: '', clientName: '', totalValue: '', milestones: [] });
  const [newMs, setNewMs] = useState({ name: '', percentage: '', dueDate: '' });

  function addMilestoneToForm() {
    if (!newMs.name || !newMs.percentage) return;
    const pct = Number(newMs.percentage);
    const total = Number(pForm.totalValue) || 0;
    setPForm(prev => ({
      ...prev,
      milestones: [...prev.milestones, {
        id: generateId(), name: newMs.name, percentage: pct,
        amount: Math.round(total * pct / 100), dueDate: newMs.dueDate, status: 'Pending',
      }],
    }));
    setNewMs({ name: '', percentage: '', dueDate: '' });
  }

  function removeMilestoneFromForm(id) {
    setPForm(prev => ({ ...prev, milestones: prev.milestones.filter(m => m.id !== id) }));
  }

  function handleCreateProject(e) {
    e.preventDefault();
    if (!pForm.name || !pForm.clientName || !pForm.totalValue) {
      addToast('Please fill in all required fields', 'error');
      return;
    }
    const project = {
      id: generateId(),
      name: pForm.name,
      clientId: pForm.clientId,
      clientName: pForm.clientName,
      totalValue: Number(pForm.totalValue),
      milestones: pForm.milestones,
    };
    dispatch({ type: 'ADD_MILESTONE_PROJECT', payload: project });
    addToast('Project created!');
    setShowNewProject(false);
    setPForm({ name: '', clientId: '', clientName: '', totalValue: '', milestones: [] });
  }

  function handleClientChange(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    setPForm(prev => ({ ...prev, clientId, clientName: client ? client.name : '' }));
  }

  function markCompleted(projectId, milestoneId) {
    dispatch({ type: 'UPDATE_MILESTONE_STATUS', payload: { projectId, milestoneId, status: 'Completed' } });
    addToast('Milestone marked as completed!');
  }

  function generateInvoiceForMilestone(project, milestone) {
    const subtotal = milestone.amount;
    const gst = calculateGST(subtotal, 18, false);
    const invoice = {
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(state.settings.invoicePrefix, state.settings.lastInvoiceNumber),
      clientId: project.clientId,
      clientName: project.clientName,
      clientCompany: '',
      clientGstin: '',
      clientAddress: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      placeOfSupply: state.settings.gstin ? state.settings.gstin.substring(0, 2) : '',
      lineItems: [{ description: `${project.name} — ${milestone.name}`, sacCode: '998314', quantity: 1, rate: milestone.amount }],
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
    dispatch({ type: 'UPDATE_MILESTONE_STATUS', payload: { projectId: project.id, milestoneId: milestone.id, status: 'Invoiced' } });
    dispatch({ type: 'ADD_ACTIVITY', payload: {
      id: generateId(), type: 'invoice',
      message: `Invoice ${invoice.invoiceNumber} generated for milestone "${milestone.name}"`,
      timestamp: new Date().toISOString(), icon: 'FileText',
    }});
    addToast(`Invoice ${invoice.invoiceNumber} generated!`);
    navigate('/invoice-history');
  }

  function deleteMilestone(projectId, milestoneId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    dispatch({
      type: 'UPDATE_MILESTONE_PROJECT',
      payload: { id: projectId, milestones: project.milestones.filter(m => m.id !== milestoneId) },
    });
    addToast('Milestone deleted');
  }

  function handleDeleteProject() {
    dispatch({ type: 'DELETE_MILESTONE_PROJECT', payload: deleteProject });
    addToast('Project deleted');
    setDeleteProject(null);
  }

  // Add milestone inline to existing project
  const [addingMsTo, setAddingMsTo] = useState(null);
  const [inlineMs, setInlineMs] = useState({ name: '', percentage: '', dueDate: '' });

  function addMilestoneToProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project || !inlineMs.name || !inlineMs.percentage) return;
    const pct = Number(inlineMs.percentage);
    const newMilestone = {
      id: generateId(), name: inlineMs.name, percentage: pct,
      amount: Math.round(project.totalValue * pct / 100),
      dueDate: inlineMs.dueDate, status: 'Pending',
    };
    dispatch({
      type: 'UPDATE_MILESTONE_PROJECT',
      payload: { id: projectId, milestones: [...project.milestones, newMilestone] },
    });
    setAddingMsTo(null);
    setInlineMs({ name: '', percentage: '', dueDate: '' });
    addToast('Milestone added!');
  }

  function handleLogCR(e) {
    e.preventDefault();
    if (!crForm.title || !crForm.estimatedAmount) {
      addToast('Please fill in required fields', 'error');
      return;
    }
    const cr = {
      id: generateId(),
      projectId: logCRFor.id,
      projectName: logCRFor.name,
      clientName: logCRFor.clientName,
      clientId: logCRFor.clientId,
      title: crForm.title,
      description: crForm.description,
      requestedBy: 'client',
      estimatedHours: Number(crForm.estimatedHours) || 0,
      estimatedAmount: Number(crForm.estimatedAmount),
      status: 'Pending',
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      billedInvoiceId: null,
      clientApprovalMethod: null,
      notes: crForm.notes,
    };
    dispatch({ type: 'ADD_CHANGE_REQUEST', payload: cr });
    addToast('Change Request logged!');
    setLogCRFor(null);
    setCrForm({ title: '', description: '', estimatedAmount: '', estimatedHours: '', notes: '' });
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
    addToast('Change Request rejected');
  }

  function billCR(project, cr) {
    const subtotal = cr.estimatedAmount;
    const gst = calculateGST(subtotal, 18, false);
    const invoice = {
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(state.settings.invoicePrefix, state.settings.lastInvoiceNumber),
      clientId: project.clientId,
      clientName: project.clientName,
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
    navigate('/invoice-history');
  }

  function getStatusIcon(status) {
    if (status === 'Invoiced') return <FileText className="w-4 h-4 text-accent" />;
    if (status === 'Completed') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    return <Circle className="w-4 h-4 text-dark-400" />;
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            <Flag className="w-6 h-6 text-accent" />
            Milestone Tracker
          </h1>
          <p className="text-sm text-dark-300 mt-0.5">Track project milestones and generate invoices when each one is complete.</p>
        </div>
        <button onClick={() => setShowNewProject(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Flag className="w-12 h-12 text-dark-400 mx-auto mb-3" />
          <p className="text-dark-300">No milestone projects yet</p>
          <button onClick={() => setShowNewProject(true)} className="btn-primary mt-4">Create Your First Project</button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => {
            const completed = project.milestones.filter(m => m.status !== 'Pending').length;
            const total = project.milestones.length;
            
            // Editable complete percent logic
            const pct = project.completionPercent !== null && project.completionPercent !== undefined 
              ? project.completionPercent 
              : (total > 0 ? Math.round((completed / total) * 100) : 0);

            const invoiced = project.milestones.filter(m => m.status === 'Invoiced').reduce((s, m) => s + m.amount, 0);

            // Change Requests mapped to project
            const projectCRs = (state.changeRequests || []).filter(cr => cr.projectId === project.id);
            const approvedUnbilledCRValue = projectCRs.filter(cr => cr.status === 'Approved').reduce((s, cr) => s + cr.estimatedAmount, 0);

            return (
              <div key={project.id} className="glass-card overflow-hidden">
                {/* Project Header */}
                <div className="p-5 border-b border-dark-600/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-dark-50">{project.name}</h3>
                      <p className="text-sm text-dark-300">{project.clientName} • {formatINR(project.totalValue)}</p>
                    </div>
                    <button onClick={() => setDeleteProject(project.id)} className="p-1.5 text-dark-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-dark-400 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span>{completed}/{total} done •</span>
                        {editingPctFor === project.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const val = Math.min(100, Math.max(0, Number(pctInput) || 0));
                              dispatch({ type: 'UPDATE_MILESTONE_PROJECT', payload: { id: project.id, completionPercent: val } });
                              setEditingPctFor(null);
                            }}
                            className="inline-flex items-center gap-1"
                          >
                            <input
                              type="number"
                              value={pctInput}
                              onChange={(e) => setPctInput(e.target.value)}
                              className="w-12 h-6 px-1.5 py-0.5 text-xs bg-dark-700 border border-dark-600 rounded text-dark-50 focus:outline-none"
                              min="0"
                              max="100"
                              autoFocus
                            />
                            <button type="submit" className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">Save</button>
                          </form>
                        ) : (
                          <span
                            onClick={() => {
                              setEditingPctFor(project.id);
                              setPctInput(String(pct));
                            }}
                            className="hover:underline cursor-pointer text-accent font-semibold"
                            title="Click to edit completion percentage"
                          >
                            {pct}%
                          </span>
                        )}
                      </div>
                      <span>{formatINR(invoiced)} / {formatINR(project.totalValue)} invoiced</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-dark-700 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Scope Creep Alert */}
                  {approvedUnbilledCRValue > 0 && (
                    <div className="mt-3.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg flex items-center gap-1.5 animate-pulse-glow">
                      <span>⚠️ <strong>Scope Creep Alert:</strong> {formatINR(approvedUnbilledCRValue)} in approved but unbilled change requests.</span>
                    </div>
                  )}
                </div>

                {/* Milestones List */}
                <div className="divide-y divide-dark-600/20">
                  {project.milestones.map(ms => (
                    <div key={ms.id} className="px-5 py-3 flex items-center gap-3 hover:bg-dark-700/20 transition-colors">
                      {getStatusIcon(ms.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-dark-100 font-medium">{ms.name}</p>
                        <p className="text-xs text-dark-400">{formatINR(ms.amount)} ({ms.percentage}%) {ms.dueDate && `• Due: ${new Date(ms.dueDate).toLocaleDateString('en-IN')}`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          ms.status === 'Invoiced' ? 'bg-accent/10 text-accent border-accent/20' :
                          ms.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {ms.status}
                        </span>
                        {ms.status === 'Pending' && (
                          <button onClick={() => markCompleted(project.id, ms.id)} className="px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors">
                            Complete
                          </button>
                        )}
                        {ms.status === 'Completed' && (
                          <button onClick={() => generateInvoiceForMilestone(project, ms)} className="px-2 py-1 text-xs bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors">
                            Invoice
                          </button>
                        )}
                        <button onClick={() => deleteMilestone(project.id, ms.id)} className="p-1 text-dark-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Milestone Block */}
                <div className="px-5 py-3 border-t border-dark-600/30 flex flex-wrap items-center justify-between gap-4">
                  {addingMsTo === project.id ? (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <input value={inlineMs.name} onChange={e => setInlineMs(p => ({ ...p, name: e.target.value }))} placeholder="Milestone name" className="flex-1 text-sm bg-dark-900" />
                      <input type="number" value={inlineMs.percentage} onChange={e => setInlineMs(p => ({ ...p, percentage: e.target.value }))} placeholder="%" className="w-16 text-sm bg-dark-900" min="1" max="100" />
                      <input type="date" value={inlineMs.dueDate} onChange={e => setInlineMs(p => ({ ...p, dueDate: e.target.value }))} className="text-sm bg-dark-900" />
                      <button onClick={() => addMilestoneToProject(project.id)} className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-medium hover:bg-accent/20">Add</button>
                      <button onClick={() => setAddingMsTo(null)} className="p-1.5 text-dark-400 hover:text-dark-50"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingMsTo(project.id)} className="text-sm text-accent hover:text-amber-400 font-medium flex items-center gap-1.5 transition-colors">
                      <Plus className="w-4 h-4" /> Add milestone
                    </button>
                  )}
                </div>

                {/* Change Requests Section */}
                <div className="border-t border-dark-600/30 px-5 py-3 bg-[#111111]/30">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setExpandedCRProject(expandedCRProject === project.id ? null : project.id)}
                      className="text-xs text-dark-300 hover:text-dark-100 flex items-center gap-1.5 focus:outline-none"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                      <span>Change Requests ({projectCRs.length})</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedCRProject === project.id ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <button
                      onClick={() => setLogCRFor(project)}
                      className="text-xs text-accent hover:text-amber-400 font-semibold flex items-center gap-1 focus:outline-none"
                    >
                      <Plus className="w-3.5 h-3.5" /> Log Change
                    </button>
                  </div>
                  
                  {expandedCRProject === project.id && (
                    <div className="mt-3 space-y-2 animate-fade-in">
                      {projectCRs.length === 0 ? (
                        <p className="text-xs text-dark-400 italic py-1.5">No change requests logged for this project.</p>
                      ) : (
                        projectCRs.map(cr => (
                          <div key={cr.id} className="bg-dark-900/60 border border-dark-600/30 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-dark-100">{cr.title}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                  cr.status === 'Billed' ? 'bg-green-500/10 text-emerald-400 border-green-500/20' :
                                  cr.status === 'Approved' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  cr.status === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                }`}>
                                  {cr.status}
                                </span>
                              </div>
                              <p className="text-dark-300">{cr.description}</p>
                              <div className="text-[10px] text-dark-400 flex items-center gap-2">
                                <span>Requested: {new Date(cr.requestedAt).toLocaleDateString('en-IN')}</span>
                                {cr.approvedAt && <span>• Approved: {new Date(cr.approvedAt).toLocaleDateString('en-IN')}</span>}
                                {cr.clientApprovalMethod && <span>via {cr.clientApprovalMethod}</span>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 justify-between sm:justify-end">
                              <span className="font-bold text-dark-50 text-sm">{formatINR(cr.estimatedAmount)}</span>
                              <div className="flex items-center gap-1.5">
                                {cr.status === 'Pending' && (
                                  <>
                                    <button
                                      onClick={() => approveCR(cr.id)}
                                      className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => rejectCR(cr.id)}
                                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {cr.status === 'Approved' && (
                                  <button
                                    onClick={() => billCR(project, cr)}
                                    className="px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded transition-colors flex items-center gap-1"
                                  >
                                    <FileText className="w-3 h-3" /> Bill It
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      <Modal isOpen={showNewProject} onClose={() => setShowNewProject(false)} title="New Milestone Project" maxWidth="max-w-lg">
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="input-label">Project Name *</label>
            <input value={pForm.name} onChange={e => setPForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. E-commerce Website Redesign" className="w-full animate-fade-in" required />
          </div>
          <div>
            <label className="input-label">Client *</label>
            <div className="relative">
              <select value={pForm.clientId} onChange={e => handleClientChange(e.target.value)} className="w-full appearance-none" required>
                <option value="">Select client...</option>
                {state.clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="input-label">Total Project Value (₹) *</label>
            <input type="number" value={pForm.totalValue} onChange={e => setPForm(p => ({ ...p, totalValue: e.target.value }))} min="0" className="w-full" required />
          </div>

          {/* Milestones */}
          <div>
            <label className="input-label">Milestones</label>
            {pForm.milestones.length > 0 && (
              <div className="space-y-2 mb-3">
                {pForm.milestones.map(ms => (
                  <div key={ms.id} className="flex items-center justify-between bg-dark-700 rounded-lg px-3 py-2 text-sm">
                    <span className="text-dark-100">{ms.name} — {ms.percentage}% ({formatINR(ms.amount)})</span>
                    <button type="button" onClick={() => removeMilestoneFromForm(ms.id)} className="p-1 text-dark-400 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input value={newMs.name} onChange={e => setNewMs(p => ({ ...p, name: e.target.value }))} placeholder="Milestone name" className="flex-1 text-sm" />
              <input type="number" value={newMs.percentage} onChange={e => setNewMs(p => ({ ...p, percentage: e.target.value }))} placeholder="%" className="w-16 text-sm" min="1" max="100" />
              <input type="date" value={newMs.dueDate} onChange={e => setNewMs(p => ({ ...p, dueDate: e.target.value }))} className="text-sm" />
              <button type="button" onClick={addMilestoneToForm} className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-medium hover:bg-accent/20">+</button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full mt-2">Create Project</button>
        </form>
      </Modal>

      {/* Log Change Request Modal */}
      <Modal isOpen={!!logCRFor} onClose={() => setLogCRFor(null)} title={`Log Change Request - ${logCRFor?.name}`}>
        <form onSubmit={handleLogCR} className="space-y-4">
          <div>
            <label className="input-label">Change Title *</label>
            <input
              value={crForm.title}
              onChange={e => setCrForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Extra revision round for home hero"
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="input-label">Description of Extra Work *</label>
            <textarea
              value={crForm.description}
              onChange={e => setCrForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Client requested new illustrations and variations..."
              className="w-full min-h-[80px]"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Estimated Amount (₹) *</label>
              <input
                type="number"
                value={crForm.estimatedAmount}
                onChange={e => setCrForm(p => ({ ...p, estimatedAmount: e.target.value }))}
                min="0"
                className="w-full"
                required
              />
            </div>
            <div>
              <label className="input-label">Estimated Hours</label>
              <input
                type="number"
                value={crForm.estimatedHours}
                onChange={e => setCrForm(p => ({ ...p, estimatedHours: e.target.value }))}
                min="0"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Internal Notes / Context</label>
            <textarea
              value={crForm.notes}
              onChange={e => setCrForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Approved via WhatsApp chat on Monday"
              className="w-full min-h-[60px]"
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-2">Log Change Request</button>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteProject} onClose={() => setDeleteProject(null)} onConfirm={handleDeleteProject}
        title="Delete Project" message="Are you sure? This will delete the project and all its milestones." />
    </div>
  );
}
