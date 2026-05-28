import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR, formatDate, generateInvoiceNumber, generateId, calculateGST, STATE_CODES } from '../utils/helpers';
import StatusBadge from '../components/UI/StatusBadge';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import InvoiceForm from '../components/Invoices/InvoiceForm';
import InvoicePreview from '../components/Invoices/InvoicePreview';
import { FileText, Plus, Trash2, Eye, ArrowLeft, Filter, Search, IndianRupee } from 'lucide-react';

export default function Invoices() {
  const { state, dispatch, addToast } = useData();
  const [view, setView] = useState('list'); // 'list' | 'create' | 'preview'
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredInvoices = useMemo(() => {
    return state.invoices.filter(inv => {
      const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
      const matchesSearch = !search || 
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        inv.clientName.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.invoices, statusFilter, search]);

  function getInvoiceTotal(inv) {
    const subtotal = (inv.lineItems || []).reduce((s, item) => s + (item.quantity * item.rate), 0);
    const gst = calculateGST(subtotal, 18, inv.placeOfSupply !== (state.settings.gstin || '').substring(0, 2));
    return gst.total;
  }

  function handleCreateInvoice(invoiceData) {
    const newInvoice = {
      ...invoiceData,
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(state.settings.invoicePrefix, state.settings.lastInvoiceNumber),
      status: 'Draft',
    };
    dispatch({ type: 'ADD_INVOICE', payload: newInvoice });
    dispatch({ type: 'ADD_ACTIVITY', payload: {
      id: generateId(), type: 'invoice',
      message: `Invoice ${newInvoice.invoiceNumber} created for ${newInvoice.clientName}`,
      timestamp: new Date().toISOString(), icon: 'FileText'
    }});
    setSelectedInvoice(newInvoice);
    setView('preview');
    addToast('Invoice created successfully!');
  }

  function handleStatusChange(inv, newStatus) {
    dispatch({ type: 'UPDATE_INVOICE', payload: { id: inv.id, status: newStatus, ...(newStatus === 'Paid' ? { paidDate: new Date().toISOString() } : {}) }});
    addToast(`Invoice marked as ${newStatus}`);
  }

  function handleDelete() {
    dispatch({ type: 'DELETE_INVOICE', payload: deleteId });
    addToast('Invoice deleted');
    setDeleteId(null);
  }

  const statusTabs = ['All', 'Draft', 'Sent', 'Paid', 'Overdue'];

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setSelectedInvoice(null); }} className="btn-ghost p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-accent" />
              {view === 'list' ? 'GST Invoice' : view === 'create' ? 'Create Invoice' : `Invoice ${selectedInvoice?.invoiceNumber}`}
            </h1>
            <p className="text-sm text-dark-300 mt-0.5">
              {view === 'list' ? `${state.invoices.length} total invoices` : view === 'create' ? 'GST-compliant tax invoice' : 'Preview and download'}
            </p>
          </div>
        </div>
        {view === 'list' && (
          <button onClick={() => setView('create')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        )}
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" />
              <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {statusTabs.map(tab => (
                <button key={tab} onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === tab ? 'bg-accent/10 text-accent border border-accent/20' : 'text-dark-300 hover:text-dark-200 hover:bg-dark-700'}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Invoice Cards */}
          {filteredInvoices.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <FileText className="w-12 h-12 text-dark-400 mx-auto mb-3" />
              <p className="text-dark-300">No invoices found</p>
              <button onClick={() => setView('create')} className="btn-primary mt-4">Create Your First Invoice</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map(inv => {
                const total = getInvoiceTotal(inv);
                return (
                  <div key={inv.id} className="glass-card-hover p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                          <IndianRupee className="w-5 h-5 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-dark-50">{inv.invoiceNumber}</span>
                            <StatusBadge status={inv.status} />
                          </div>
                          <p className="text-sm text-dark-300 truncate">{inv.clientName} • {inv.clientCompany || ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-dark-50">{formatINR(total)}</p>
                          <p className="text-xs text-dark-400">{formatDate(inv.date)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setSelectedInvoice(inv); setView('preview'); }} className="p-2 rounded-lg text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          {inv.status === 'Draft' && (
                            <button onClick={() => handleStatusChange(inv, 'Sent')} className="px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                              Mark Sent
                            </button>
                          )}
                          {inv.status === 'Sent' && (
                            <button onClick={() => handleStatusChange(inv, 'Paid')} className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                              Mark Paid
                            </button>
                          )}
                          <button onClick={() => setDeleteId(inv.id)} className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* CREATE VIEW */}
      {view === 'create' && (
        <InvoiceForm onSubmit={handleCreateInvoice} onCancel={() => setView('list')} />
      )}

      {/* PREVIEW VIEW */}
      {view === 'preview' && selectedInvoice && (
        <InvoicePreview
          invoice={selectedInvoice}
          onBack={() => { setView('list'); setSelectedInvoice(null); }}
          onStatusChange={(status) => {
            handleStatusChange(selectedInvoice, status);
            setSelectedInvoice({ ...selectedInvoice, status });
          }}
        />
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Invoice" message="Are you sure? This action cannot be undone." />
    </div>
  );
}
