// ==========================================
// FreelanceOS — Settings Page
// ==========================================
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { formatINR } from '../utils/helpers';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import {
  User, Building2, Mail, Phone, CreditCard, FileText,
  Download, Upload, RotateCcw, Info, Save, Shield,
  MapPin, Hash, Landmark, IndianRupee, Sparkles,
} from 'lucide-react';

// ---- Reusable field component ----
function Field({ icon: Icon, label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium text-dark-200">
        {Icon && <Icon className="w-3.5 h-3.5 text-dark-400" />}
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-dark-400 pl-0.5">{hint}</p>}
    </div>
  );
}

// ---- Section wrapper ----
function Section({ icon: Icon, title, description, children }) {
  return (
    <div className="backdrop-blur-xl bg-white/5 border border-[#2A2A2A] rounded-xl p-6 space-y-6 hover:border-[#3A3A3A] transition-colors duration-300">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#FAFAFA]">{title}</h2>
          {description && <p className="text-sm text-[#737373] mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ---- Input class ----
const inputClass =
  'w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#525252] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all duration-200';
const textareaClass = inputClass + ' resize-none min-h-[100px]';

export default function Settings() {
  const { state, dispatch, addToast, exportData, importData } = useData();
  const fileInputRef = useRef(null);

  // ---- Local form state synced from context ----
  const [form, setForm] = useState({ ...state.settings });
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Re-sync when settings change externally (e.g. after import/reset)
  useEffect(() => {
    setForm({ ...state.settings });
    setHasChanges(false);
  }, [state.settings]);

  // ---- Handlers ----
  function handleChange(field, value) {
    setForm(prev => {
      if (field === 'startupRecurringCheck' || field === 'checkRecurringOnStartup') {
        return { ...prev, startupRecurringCheck: value, checkRecurringOnStartup: value };
      }
      return { ...prev, [field]: value };
    });
    setHasChanges(true);
  }

  function handleSave() {
    dispatch({ type: 'UPDATE_SETTINGS', payload: form });
    setHasChanges(false);
    addToast('Settings saved successfully!', 'success');
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      importData(evt.target.result);
    };
    reader.readAsText(file);
    // Reset so the same file can be picked again
    e.target.value = '';
  }

  function handleReset() {
    dispatch({ type: 'RESET_DATA' });
    addToast('Data reset to demo defaults.', 'success');
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#FAFAFA]">Settings</h1>
          <p className="text-[#737373] text-sm mt-1">Manage your profile, bank details, and app preferences</p>
        </div>

        {/* Floating save button */}
        {hasChanges && (
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        )}
      </div>

      {/* ============================== */}
      {/* 1 — Profile Section            */}
      {/* ============================== */}
      <Section
        icon={User}
        title="Profile"
        description="Your personal and business information"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field icon={User} label="Your Name">
            <input
              className={inputClass}
              value={form.yourName}
              onChange={e => handleChange('yourName', e.target.value)}
              placeholder="e.g. Aditya Kumar"
            />
          </Field>

          <Field icon={Building2} label="Business Name">
            <input
              className={inputClass}
              value={form.businessName}
              onChange={e => handleChange('businessName', e.target.value)}
              placeholder="e.g. Kumar Designs"
            />
          </Field>

          <Field icon={Mail} label="Email">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field icon={Phone} label="Phone">
            <input
              className={inputClass}
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="+91 99999 99999"
            />
          </Field>

          <Field icon={Shield} label="GSTIN" hint="15-character alphanumeric — e.g. 27AABCT1234F1ZP">
            <input
              className={inputClass}
              value={form.gstin}
              onChange={e => handleChange('gstin', e.target.value.toUpperCase())}
              placeholder="27AABCT1234F1ZP"
              maxLength={15}
            />
          </Field>

          <Field icon={Hash} label="PAN">
            <input
              className={inputClass}
              value={form.pan}
              onChange={e => handleChange('pan', e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
            />
          </Field>
        </div>

        <Field icon={MapPin} label="Address">
          <textarea
            className={textareaClass}
            value={form.address}
            onChange={e => handleChange('address', e.target.value)}
            placeholder="Your full business address"
            rows={2}
          />
        </Field>
      </Section>

      {/* ============================== */}
      {/* 2 — Bank Details               */}
      {/* ============================== */}
      <Section
        icon={Landmark}
        title="Bank Details"
        description="These details appear on your invoices for client payments"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field icon={User} label="Account Holder Name">
            <input
              className={inputClass}
              value={form.accountHolderName || ''}
              onChange={e => handleChange('accountHolderName', e.target.value)}
              placeholder="e.g. Aditya Kumar"
            />
          </Field>

          <Field icon={Landmark} label="Bank Name">
            <input
              className={inputClass}
              value={form.bankName}
              onChange={e => handleChange('bankName', e.target.value)}
              placeholder="e.g. HDFC Bank"
            />
          </Field>

          <Field icon={CreditCard} label="Account Number">
            <input
              className={inputClass}
              value={form.accountNumber}
              onChange={e => handleChange('accountNumber', e.target.value)}
              placeholder="e.g. 12345678901234"
            />
          </Field>

          <Field icon={Hash} label="IFSC Code">
            <input
              className={inputClass}
              value={form.ifsc}
              onChange={e => handleChange('ifsc', e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              maxLength={11}
            />
          </Field>

          <Field icon={IndianRupee} label="UPI ID">
            <input
              className={inputClass}
              value={form.upiId}
              onChange={e => handleChange('upiId', e.target.value)}
              placeholder="e.g. yourname@upi"
            />
          </Field>
        </div>
      </Section>

      {/* ============================== */}
      {/* 3 — Invoice Settings           */}
      {/* ============================== */}
      <Section
        icon={FileText}
        title="Invoice Settings"
        description="Customise your invoice numbering, terms, and revenue target"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field icon={Hash} label="Invoice Number Prefix">
            <input
              className={inputClass}
              value={form.invoicePrefix}
              onChange={e => handleChange('invoicePrefix', e.target.value.toUpperCase())}
              placeholder="INV"
              maxLength={10}
            />
          </Field>

          <Field icon={FileText} label="Last Invoice Number" hint="Automatically incremented when you create invoices">
            <div className="flex items-center gap-2">
              <input
                className={inputClass + ' opacity-60 cursor-not-allowed'}
                value={`${form.invoicePrefix}-${String(form.lastInvoiceNumber).padStart(4, '0')}`}
                readOnly
              />
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Field icon={IndianRupee} label="Revenue Goal (₹)">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#737373]">₹</span>
                <input
                  type="number"
                  className={inputClass + ' pl-8'}
                  value={form.revenueGoal}
                  onChange={e => handleChange('revenueGoal', Number(e.target.value))}
                  placeholder="500000"
                  min={0}
                />
              </div>
              <p className="text-xs text-[#525252] mt-1">
                Current goal: <span className="text-orange-400 font-medium">{formatINR(form.revenueGoal)}</span>
              </p>
            </Field>
          </div>
        </div>

        <Field icon={FileText} label="Default Payment Terms">
          <textarea
            className={textareaClass}
            value={form.defaultTerms}
            onChange={e => handleChange('defaultTerms', e.target.value)}
            placeholder="Payment terms that appear on every invoice…"
            rows={4}
          />
        </Field>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="startupRecurringCheck"
            className="rounded bg-[#1A1A1A] border border-[#2A2A2A] text-orange-500 focus:ring-orange-500/20 w-4.5 h-4.5 cursor-pointer"
            checked={(form.startupRecurringCheck ?? form.checkRecurringOnStartup) || false}
            onChange={e => handleChange('startupRecurringCheck', e.target.checked)}
          />
          <label htmlFor="startupRecurringCheck" className="text-sm font-medium text-dark-200 cursor-pointer">
            Check recurring invoices on application startup
          </label>
        </div>
      </Section>

      {/* ============================== */}
      {/* 4 — Data Management            */}
      {/* ============================== */}
      <Section
        icon={CreditCard}
        title="Data Management"
        description="Export, import, or reset your FreelanceOS data"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Export */}
          <button
            onClick={exportData}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-sm font-medium text-[#FAFAFA] hover:border-green-500/40 hover:bg-green-500/5 transition-all duration-200 group"
          >
            <Download className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
            Export Data
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-sm font-medium text-[#FAFAFA] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-200 group"
          >
            <Upload className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            Import Data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />

          {/* Reset */}
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-sm font-medium text-[#FAFAFA] hover:border-red-500/40 hover:bg-red-500/5 transition-all duration-200 group"
          >
            <RotateCcw className="w-4 h-4 text-red-400 group-hover:rotate-[-90deg] transition-transform duration-300" />
            Reset to Demo
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            All data is stored locally in your browser's <span className="font-medium text-amber-300">localStorage</span>.
            Clearing browser data will delete everything. We recommend exporting a backup regularly.
          </p>
        </div>
      </Section>

      {/* ============================== */}
      {/* 5 — About                      */}
      {/* ============================== */}
      <div className="backdrop-blur-xl bg-white/5 border border-[#2A2A2A] rounded-xl p-6 hover:border-[#3A3A3A] transition-colors duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#FAFAFA]">FreelanceOS <span className="text-orange-400">v1.0</span></h2>
            <p className="text-sm text-[#737373]">The all-in-one productivity dashboard for Indian freelancers</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {['React', 'Tailwind CSS', 'Recharts', 'Lucide Icons', 'jsPDF'].map(tech => (
            <span
              key={tech}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#A3A3A3]"
            >
              {tech}
            </span>
          ))}
        </div>

        <p className="text-xs text-[#525252] mt-5 leading-relaxed">
          Built with ❤️ for the Indian freelancer community. Manage clients, invoices,
          projects, expenses, and proposals — all from one beautiful dashboard.
        </p>
      </div>

      {/* ---- Sticky save bar (when changes pending) ---- */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0F0F0F]/90 backdrop-blur-lg border-t border-[#2A2A2A] py-3 px-6 flex items-center justify-between animate-slide-up">
          <p className="text-sm text-[#A3A3A3]">
            You have <span className="text-orange-400 font-medium">unsaved changes</span>
          </p>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      )}

      {/* ---- Reset confirmation dialog ---- */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        title="Reset All Data?"
        message="This will replace all your data (clients, invoices, projects, expenses, and settings) with demo data. This action cannot be undone."
      />
    </div>
  );
}
