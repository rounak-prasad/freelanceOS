// ==========================================
// FreelanceOS — Client Form Component
// ==========================================
import React, { useState, useEffect } from 'react';
import { User, Building2, Mail, Phone, Briefcase, IndianRupee, FileText, MapPin, StickyNote } from 'lucide-react';

const STATUS_OPTIONS = ['Proposal Sent', 'In Progress', 'Invoice Sent', 'Paid', 'Overdue'];

const emptyForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  projectName: '',
  status: 'Proposal Sent',
  projectValue: '',
  gstin: '',
  address: '',
  notes: '',
};

export default function ClientForm({ client, onSubmit, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || '',
        company: client.company || '',
        email: client.email || '',
        phone: client.phone || '',
        projectName: client.projectName || '',
        status: client.status || 'Proposal Sent',
        projectValue: client.projectValue ?? '',
        gstin: client.gstin || '',
        address: client.address || '',
        notes: client.notes || '',
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
    setTouched({});
  }, [client]);

  function validate(data) {
    const errs = {};
    if (!data.name.trim()) errs.name = 'Name is required';
    if (!data.company.trim()) errs.company = 'Company is required';
    if (!data.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errs.email = 'Enter a valid email';
    }
    if (!data.projectName.trim()) errs.projectName = 'Project name is required';
    return errs;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      const updated = { ...form, [name]: value };
      const newErrors = validate(updated);
      setErrors(prev => ({ ...prev, [name]: newErrors[name] || '' }));
    }
  }

  function handleBlur(e) {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const newErrors = validate(form);
    setErrors(prev => ({ ...prev, [name]: newErrors[name] || '' }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const allTouched = {};
    Object.keys(emptyForm).forEach(k => (allTouched[k] = true));
    setTouched(allTouched);

    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSubmit({
      ...form,
      projectValue: form.projectValue === '' ? 0 : Number(form.projectValue),
    });
  }

  function renderField(name, label, icon, type = 'text', required = false, placeholder = '') {
    const Icon = icon;
    const hasError = touched[name] && errors[name];
    return (
      <div>
        <label htmlFor={name} className="input-label flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-dark-300" />
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
        <input
          id={name}
          name={name}
          type={type}
          value={form[name]}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`w-full ${hasError ? '!border-red-500/60 focus:!border-red-500 focus:!ring-red-500/30' : ''}`}
        />
        {hasError && (
          <p className="mt-1 text-xs text-red-400">{errors[name]}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Row 1: Name & Company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderField('name', 'Name', User, 'text', true, 'John Doe')}
        {renderField('company', 'Company', Building2, 'text', true, 'Acme Corp')}
      </div>

      {/* Row 2: Email & Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderField('email', 'Email', Mail, 'email', true, 'john@acme.com')}
        {renderField('phone', 'Phone', Phone, 'tel', false, '+91 98765 43210')}
      </div>

      {/* Row 3: Project Name & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderField('projectName', 'Project Name', Briefcase, 'text', true, 'Website Redesign')}
        <div>
          <label htmlFor="status" className="input-label flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-dark-300" />
            Status
          </label>
          <select
            id="status"
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 4: Project Value & GSTIN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderField('projectValue', 'Project Value (₹)', IndianRupee, 'number', false, '50000')}
        {renderField('gstin', 'GSTIN', FileText, 'text', false, '22AAAAA0000A1Z5')}
      </div>

      {/* Address */}
      {renderField('address', 'Address', MapPin, 'text', false, 'Mumbai, Maharashtra')}

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="input-label flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-dark-300" />
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Any additional notes about the client..."
          rows={3}
          className="w-full resize-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-dark-600/50">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {client ? 'Update Client' : 'Add Client'}
        </button>
      </div>
    </form>
  );
}
