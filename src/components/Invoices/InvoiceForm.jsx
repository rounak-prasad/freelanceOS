// ==========================================
// FreelanceOS — GST Invoice Form Component
// ==========================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Trash2, ChevronDown, FileText, User, Building2,
  MapPin, Calendar, Hash, Calculator, AlertCircle, Info,
  Save, FolderOpen, X,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import {
  formatINR, generateInvoiceNumber, generateId, calculateGST,
  getStateFromGSTIN, toInputDate, STATE_CODES, SAC_CODES,
} from '../../utils/helpers';

const emptyItem = { id: '', description: '', sacCode: '998314', quantity: 1, rate: 0 };

const TEMPLATES_KEY = 'invoiceTemplates';

function getTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
  } catch { return []; }
}

function saveTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export default function InvoiceForm({ onSubmit, onCancel, editInvoice }) {
  const { state, addToast } = useData();
  const { settings, clients } = state;

  // ---- Client autocomplete ----
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef(null);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ---- Invoice Templates ----
  const [templates, setTemplates] = useState(getTemplates);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // ---- derive supplier state code from GSTIN ----
  const supplierStateCode = useMemo(() => {
    if (settings.gstin && settings.gstin.length >= 2) return settings.gstin.substring(0, 2);
    return '';
  }, [settings.gstin]);

  // ---- initial form state ----
  const buildInitial = () => {
    if (editInvoice) {
      return {
        invoiceNumber: editInvoice.invoiceNumber,
        date: toInputDate(editInvoice.date),
        dueDate: toInputDate(editInvoice.dueDate),
        clientId: editInvoice.clientId || '',
        clientName: editInvoice.clientName || '',
        clientCompany: editInvoice.clientCompany || '',
        clientGstin: editInvoice.clientGstin || '',
        clientAddress: editInvoice.clientAddress || '',
        placeOfSupply: editInvoice.placeOfSupply || '',
        lineItems: editInvoice.lineItems?.map(li => ({ ...li, id: li.id || generateId() })) || [{ ...emptyItem, id: generateId() }],
        gstRate: editInvoice.gstRate || 18,
        notes: editInvoice.notes || settings.defaultTerms || '',
      };
    }
    const today = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 15);
    return {
      invoiceNumber: generateInvoiceNumber(settings.invoicePrefix, settings.lastInvoiceNumber),
      date: toInputDate(today),
      dueDate: toInputDate(due),
      clientId: '',
      clientName: '',
      clientCompany: '',
      clientGstin: '',
      clientAddress: '',
      placeOfSupply: supplierStateCode || '',
      lineItems: [{ ...emptyItem, id: generateId() }],
      gstRate: 18,
      notes: settings.defaultTerms || '',
    };
  };

  const [form, setForm] = useState(buildInitial);

  // ---- derived calculations ----
  const subtotal = useMemo(
    () => form.lineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0),
    [form.lineItems],
  );

  const isInterState = useMemo(() => {
    if (!supplierStateCode || !form.placeOfSupply) return false;
    return supplierStateCode !== form.placeOfSupply;
  }, [supplierStateCode, form.placeOfSupply]);

  const taxInfo = useMemo(
    () => calculateGST(subtotal, form.gstRate, isInterState),
    [subtotal, form.gstRate, isInterState],
  );

  // ---- Find active project for selected client ----
  const activeProjectHint = useMemo(() => {
    if (!form.clientId) return '';
    const client = clients.find(c => c.id === form.clientId);
    if (client && client.projectName) return client.projectName;
    return '';
  }, [form.clientId, clients]);

  // ---- handlers ----
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleClientSelect = (client) => {
    setForm(prev => ({
      ...prev,
      clientId: client.id,
      clientName: client.name,
      clientCompany: client.company || '',
      clientGstin: client.gstin || '',
      clientAddress: client.address || '',
      placeOfSupply: client.gstin ? client.gstin.substring(0, 2) : prev.placeOfSupply,
    }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  // Auto-detect place of supply when client GSTIN changes
  useEffect(() => {
    if (form.clientGstin && form.clientGstin.length >= 2) {
      const code = form.clientGstin.substring(0, 2);
      if (STATE_CODES[code]) {
        set('placeOfSupply', code);
      }
    }
  }, [form.clientGstin]);

  const updateItem = (id, field, value) => {
    setForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(li =>
        li.id === id ? { ...li, [field]: field === 'quantity' || field === 'rate' ? Number(value) || 0 : value } : li,
      ),
    }));
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { ...emptyItem, id: generateId() }],
    }));
  };

  const removeItem = (id) => {
    if (form.lineItems.length <= 1) return;
    setForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(li => li.id !== id),
    }));
  };

  // ---- Template handlers ----
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      addToast('Please enter a template name', 'error');
      return;
    }
    const template = {
      id: generateId(),
      name: templateName.trim(),
      lineItems: form.lineItems.map(({ id, ...rest }) => rest),
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, template];
    setTemplates(updated);
    saveTemplates(updated);
    setTemplateName('');
    setShowSaveTemplate(false);
    addToast(`Template "${template.name}" saved!`);
  };

  const handleLoadTemplate = (template) => {
    setForm(prev => ({
      ...prev,
      lineItems: template.lineItems.map(li => ({ ...li, id: generateId() })),
    }));
    setShowTemplateMenu(false);
    addToast(`Template "${template.name}" loaded`);
  };

  const handleDeleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
    addToast('Template deleted');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const invoiceData = {
      id: editInvoice?.id || generateId(),
      invoiceNumber: form.invoiceNumber,
      date: new Date(form.date).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      clientId: form.clientId,
      clientName: form.clientName,
      clientCompany: form.clientCompany,
      clientGstin: form.clientGstin,
      clientAddress: form.clientAddress,
      placeOfSupply: form.placeOfSupply,
      lineItems: form.lineItems.map(({ id, ...rest }) => rest),
      gstRate: form.gstRate,
      subtotal,
      isInterState,
      cgst: taxInfo.cgst,
      sgst: taxInfo.sgst,
      igst: taxInfo.igst,
      total: taxInfo.total,
      status: editInvoice?.status || 'Draft',
      paidDate: editInvoice?.paidDate || null,
      notes: form.notes,
      supplierName: settings.yourName || settings.businessName,
      supplierGstin: settings.gstin,
      supplierAddress: settings.address,
    };
    onSubmit(invoiceData);
  };

  // ---- section styles ----
  const sectionClass = 'bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 md:p-6 space-y-4';
  const labelClass = 'block text-sm font-medium text-[#A3A3A3] mb-1.5';
  const inputClass =
    'w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg px-3.5 py-2.5 text-[#FAFAFA] text-sm placeholder-[#737373] focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/30 transition-colors';
  const selectClass = inputClass + ' appearance-none cursor-pointer';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ======== YOUR DETAILS ======== */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F97316] to-[#F59E0B] flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <h3 className="text-[#FAFAFA] font-semibold text-base">Your Details (Supplier)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Name / Business</label>
            <input className={inputClass} value={settings.yourName || settings.businessName} readOnly />
          </div>
          <div>
            <label className={labelClass}>GSTIN</label>
            <input className={inputClass} value={settings.gstin || '—'} readOnly />
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input className={inputClass} value={settings.address || '—'} readOnly />
          </div>
        </div>

        {!settings.gstin && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-2">
            <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-amber-400 text-xs">GSTIN not configured. Go to Settings to add your GST details for accurate tax calculations.</p>
          </div>
        )}
      </div>

      {/* ======== CLIENT DETAILS ======== */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#A855F7] flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <h3 className="text-[#FAFAFA] font-semibold text-base">Client Details (Recipient)</h3>
        </div>

        {/* Client Autocomplete */}
        <div ref={clientDropdownRef} className="relative">
          <label className={labelClass}>Search & Select Client</label>
          <input
            className={inputClass}
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setShowClientDropdown(true);
              if (!e.target.value.trim()) {
                setForm(prev => ({ ...prev, clientId: '', clientName: '', clientCompany: '', clientGstin: '', clientAddress: '' }));
              }
            }}
            onFocus={() => setShowClientDropdown(true)}
            placeholder="Type client name or company..."
          />
          {showClientDropdown && filteredClients.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl max-h-48 overflow-y-auto custom-scroll">
              {filteredClients.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleClientSelect(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#262626] transition-colors border-b border-[#2A2A2A] last:border-0"
                >
                  <p className="text-sm font-medium text-[#FAFAFA]">{c.name}</p>
                  <p className="text-xs text-[#737373]">
                    {c.company || ''}{c.gstin ? ` · GSTIN: ${c.gstin}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
          {activeProjectHint && (
            <p className="text-xs text-accent mt-1.5">Active project: {activeProjectHint}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Client Name *</label>
            <input
              className={inputClass}
              value={form.clientName}
              onChange={(e) => set('clientName', e.target.value)}
              placeholder="Client or company name"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Company</label>
            <input
              className={inputClass}
              value={form.clientCompany}
              onChange={(e) => set('clientCompany', e.target.value)}
              placeholder="Company name"
            />
          </div>
          <div>
            <label className={labelClass}>Client GSTIN</label>
            <input
              className={inputClass}
              value={form.clientGstin}
              onChange={(e) => set('clientGstin', e.target.value.toUpperCase())}
              placeholder="e.g. 27AABCT1234F1ZP"
              maxLength={15}
            />
          </div>
          <div>
            <label className={labelClass}>Client Address</label>
            <input
              className={inputClass}
              value={form.clientAddress}
              onChange={(e) => set('clientAddress', e.target.value)}
              placeholder="Full address"
            />
          </div>
        </div>
      </div>

      {/* ======== INVOICE DETAILS ======== */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22C55E] to-[#3B82F6] flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <h3 className="text-[#FAFAFA] font-semibold text-base">Invoice Details</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Invoice Number</label>
            <input className={inputClass} value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Invoice Date *</label>
            <input type="date" className={inputClass} value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Due Date *</label>
            <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Place of Supply *</label>
            <div className="relative">
              <select
                className={selectClass}
                value={form.placeOfSupply}
                onChange={(e) => set('placeOfSupply', e.target.value)}
                required
              >
                <option value="">Select State</option>
                {Object.entries(STATE_CODES).map(([code, name]) => (
                  <option key={code} value={code}>{code} — {name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] pointer-events-none" />
            </div>
          </div>
        </div>

        {isInterState && (
          <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-blue-400 text-xs">
              Inter-state supply detected — IGST will be applied instead of CGST + SGST.
            </p>
          </div>
        )}
      </div>

      {/* ======== LINE ITEMS ======== */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
              <Hash size={16} className="text-white" />
            </div>
            <h3 className="text-[#FAFAFA] font-semibold text-base">Line Items</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Template buttons */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-colors"
              >
                <FolderOpen size={14} /> Templates
              </button>
              {showTemplateMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl overflow-hidden">
                  {templates.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-[#737373]">No saved templates yet</p>
                  ) : (
                    templates.map(t => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#262626] border-b border-[#2A2A2A] last:border-0">
                        <button type="button" onClick={() => handleLoadTemplate(t)} className="text-sm text-[#FAFAFA] font-medium flex-1 text-left truncate">
                          {t.name}
                        </button>
                        <button type="button" onClick={() => handleDeleteTemplate(t.id)} className="p-1 text-[#737373] hover:text-red-400 ml-2">
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowTemplateMenu(false); setShowSaveTemplate(true); }}
                    className="w-full px-4 py-2.5 text-xs text-accent hover:bg-[#262626] text-left font-medium border-t border-[#2A2A2A]"
                  >
                    + Save Current as Template
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20 rounded-lg text-xs font-medium hover:bg-[#F97316]/20 transition-colors"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>
        </div>

        {/* Save Template inline form */}
        {showSaveTemplate && (
          <div className="flex items-center gap-2 bg-[#0F0F0F] rounded-lg p-3 border border-blue-500/20">
            <Save size={14} className="text-blue-400 flex-shrink-0" />
            <input
              type="text"
              className={inputClass + ' flex-1'}
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="Template name..."
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSaveTemplate())}
            />
            <button type="button" onClick={handleSaveTemplate} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30">Save</button>
            <button type="button" onClick={() => setShowSaveTemplate(false)} className="p-1.5 text-[#737373] hover:text-[#FAFAFA]"><X size={14} /></button>
          </div>
        )}

        {/* Desktop header */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_180px_80px_120px_120px_40px] gap-3 text-xs text-[#737373] font-medium uppercase tracking-wider pb-2 border-b border-[#2A2A2A]">
          <span>Description</span>
          <span>SAC Code</span>
          <span>Qty</span>
          <span>Rate (₹)</span>
          <span>Amount</span>
          <span></span>
        </div>

        <div className="space-y-3">
          {form.lineItems.map((item, idx) => (
            <div key={item.id} className="lg:grid lg:grid-cols-[1fr_180px_80px_120px_120px_40px] gap-3 items-start bg-[#0F0F0F] rounded-lg p-3 lg:p-2 lg:bg-transparent lg:rounded-none space-y-3 lg:space-y-0">
              {/* Description */}
              <div>
                <label className="lg:hidden text-xs text-[#737373] mb-1 block">Description</label>
                <input
                  className={inputClass}
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Service description"
                  required
                />
              </div>
              {/* SAC Code */}
              <div>
                <label className="lg:hidden text-xs text-[#737373] mb-1 block">SAC Code</label>
                <div className="relative">
                  <select
                    className={selectClass}
                    value={item.sacCode}
                    onChange={(e) => updateItem(item.id, 'sacCode', e.target.value)}
                  >
                    {SAC_CODES.map(sc => (
                      <option key={sc.code} value={sc.code}>{sc.code}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] pointer-events-none" />
                </div>
              </div>
              {/* Qty */}
              <div>
                <label className="lg:hidden text-xs text-[#737373] mb-1 block">Qty</label>
                <input
                  type="number"
                  min="1"
                  className={inputClass}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                  required
                />
              </div>
              {/* Rate */}
              <div>
                <label className="lg:hidden text-xs text-[#737373] mb-1 block">Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={item.rate}
                  onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                  required
                />
              </div>
              {/* Amount */}
              <div className="flex items-center">
                <label className="lg:hidden text-xs text-[#737373] mr-2">Amount:</label>
                <span className="text-[#FAFAFA] text-sm font-medium lg:py-2.5">{formatINR(item.quantity * item.rate)}</span>
              </div>
              {/* Remove */}
              <div className="flex items-center justify-end lg:justify-center">
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={form.lineItems.length <= 1}
                  className="p-2 text-[#737373] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======== TAX CALCULATION ======== */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#A855F7] to-[#F97316] flex items-center justify-center">
            <Calculator size={16} className="text-white" />
          </div>
          <h3 className="text-[#FAFAFA] font-semibold text-base">Tax Calculation</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>GST Rate (%)</label>
            <div className="relative">
              <select
                className={selectClass}
                value={form.gstRate}
                onChange={(e) => set('gstRate', Number(e.target.value))}
              >
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tax Type</label>
            <input className={inputClass} value={isInterState ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'} readOnly />
          </div>
        </div>

        <div className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#A3A3A3]">Subtotal</span>
            <span className="text-[#FAFAFA] font-medium">{formatINR(subtotal)}</span>
          </div>
          {isInterState ? (
            <div className="flex justify-between text-sm">
              <span className="text-[#A3A3A3]">IGST @ {form.gstRate}%</span>
              <span className="text-[#FAFAFA] font-medium">{formatINR(taxInfo.igst)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-[#A3A3A3]">CGST @ {form.gstRate / 2}%</span>
                <span className="text-[#FAFAFA] font-medium">{formatINR(taxInfo.cgst)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#A3A3A3]">SGST @ {form.gstRate / 2}%</span>
                <span className="text-[#FAFAFA] font-medium">{formatINR(taxInfo.sgst)}</span>
              </div>
            </>
          )}
          <div className="border-t border-[#2A2A2A] pt-3 flex justify-between">
            <span className="text-[#FAFAFA] font-semibold">Grand Total</span>
            <span className="text-lg font-bold bg-gradient-to-r from-[#F97316] to-[#F59E0B] bg-clip-text text-transparent">
              {formatINR(taxInfo.total)}
            </span>
          </div>
        </div>
      </div>

      {/* ======== TERMS ======== */}
      <div className={sectionClass}>
        <label className={labelClass}>Terms & Conditions</label>
        <textarea
          className={inputClass + ' min-h-[80px] resize-y'}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Payment terms, late fees, jurisdiction…"
          rows={3}
        />
      </div>

      {/* ======== ACTIONS ======== */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          type="submit"
          className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all duration-200 text-sm"
        >
          {editInvoice ? 'Update Invoice' : 'Generate Invoice'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto px-8 py-3 bg-[#1A1A1A] border border-[#2A2A2A] text-[#A3A3A3] rounded-xl hover:bg-[#262626] hover:text-[#FAFAFA] transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
