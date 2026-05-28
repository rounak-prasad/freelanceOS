// ==========================================
// FreelanceOS — Invoice History Page
// ==========================================
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR, formatDate, calculateGST, generateId } from '../utils/helpers';
import InvoicePreview from '../components/Invoices/InvoicePreview';
import Modal from '../components/UI/Modal';
import {
  History, Download, Eye, Share2, Printer, ChevronDown,
  FileText, Search, Filter,
} from 'lucide-react';

const STATUS_OPTIONS = ['Unpaid', 'Paid', 'Partially Paid', 'Overdue'];

function getStatusBadge(status) {
  const map = {
    Unpaid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Paid: 'bg-green-500/10 text-green-400 border-green-500/20',
    Settled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    Overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
    'Partially Paid': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return map[status] || map.Draft;
}

function getInvoiceTotal(inv) {
  const subtotal = (inv.lineItems || []).reduce((s, li) => s + li.quantity * li.rate, 0);
  if (inv.total) return inv.total;
  const gst = calculateGST(subtotal, inv.gstRate || 18, inv.isInterState || false);
  return gst.total;
}

export default function InvoiceHistory() {
  const { state, dispatch, addToast } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [previewInvoice, setPreviewInvoice] = useState(null);

  const invoices = useMemo(() => {
    return state.invoices
      .filter(inv => {
        const matchesSearch = !search ||
          inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
          inv.clientName?.toLowerCase().includes(search.toLowerCase());
        const displayStatus = getDisplayStatus(inv);
        const matchesStatus = statusFilter === 'All' || displayStatus === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.invoices, search, statusFilter]);

  function getDisplayStatus(inv) {
    if (inv.status === 'Paid') return 'Paid';
    if (inv.status === 'Overdue') return 'Overdue';
    if (inv.amountPaid && inv.amountPaid > 0 && inv.amountPaid < getInvoiceTotal(inv)) return 'Partially Paid';
    const total = getInvoiceTotal(inv);
    const paid = inv.amountPaid || 0;
    if (paid >= total) return 'Paid';
    if (inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'Paid') return 'Overdue';
    return 'Unpaid';
  }

  function getOutstanding(inv) {
    const total = getInvoiceTotal(inv);
    const paid = inv.amountPaid || (inv.status === 'Paid' ? total : 0);
    return total - paid;
  }

  function handleStatusChange(invId, newStatus) {
    const updates = { id: invId, status: newStatus };
    if (newStatus === 'Paid') {
      const inv = state.invoices.find(i => i.id === invId);
      updates.paidDate = new Date().toISOString();
      updates.amountPaid = getInvoiceTotal(inv);
    }
    dispatch({ type: 'UPDATE_INVOICE', payload: updates });
    addToast(`Status updated to ${newStatus}`);
  }

  function handleShare(inv) {
    const total = getInvoiceTotal(inv);
    const outstanding = getOutstanding(inv);
    const text = `📄 Invoice ${inv.invoiceNumber}\n👤 Client: ${inv.clientName}\n📅 Date: ${formatDate(inv.date)}\n💰 Amount: ${formatINR(total)}\n📊 Outstanding: ${formatINR(outstanding)}\n📋 Status: ${getDisplayStatus(inv)}`;
    navigator.clipboard.writeText(text);
    addToast('Invoice details copied to clipboard!');
  }

  async function handlePrint(inv) {
    setPreviewInvoice(inv);
  }

  function exportCSV() {
    const headers = ['Invoice #', 'Client', 'Date', 'Amount', 'Outstanding', 'Status'];
    const rows = state.invoices.map(inv => {
      const total = getInvoiceTotal(inv);
      return [
        inv.invoiceNumber,
        inv.clientName,
        formatDate(inv.date),
        total.toFixed(2),
        getOutstanding(inv).toFixed(2),
        getDisplayStatus(inv),
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('CSV exported successfully!');
  }

  const statusTabs = ['All', 'Unpaid', 'Paid', 'Overdue', 'Partially Paid'];

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-accent" />
            Invoice History
          </h1>
          <p className="text-sm text-dark-300 mt-0.5">
            All generated invoices — track status, payments, and share with clients.
          </p>
        </div>
        <button onClick={exportCSV} className="btn-primary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

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

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText className="w-12 h-12 text-dark-400 mx-auto mb-3" />
          <p className="text-dark-300">No invoices found</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600/30">
                  <th className="table-header px-4 py-3 text-left">Invoice #</th>
                  <th className="table-header px-4 py-3 text-left">Client</th>
                  <th className="table-header px-4 py-3 text-left">Date</th>
                  <th className="table-header px-4 py-3 text-right">Amount</th>
                  <th className="table-header px-4 py-3 text-right">Outstanding</th>
                  <th className="table-header px-4 py-3 text-center">Status</th>
                  <th className="table-header px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const total = getInvoiceTotal(inv);
                  const outstanding = getOutstanding(inv);
                  const displayStatus = getDisplayStatus(inv);

                  return (
                    <tr key={inv.id} className="border-b border-dark-600/20 hover:bg-dark-700/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-dark-50">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-dark-100">{inv.clientName}</p>
                        {inv.clientCompany && <p className="text-xs text-dark-400">{inv.clientCompany}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-300">{formatDate(inv.date)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-dark-50 text-right">{formatINR(total)}</td>
                      <td className="px-4 py-3 text-right">
                        {outstanding <= 0 ? (
                          <span className="text-sm font-medium text-emerald-400">Settled</span>
                        ) : (
                          <span className="text-sm font-medium text-red-400">{formatINR(outstanding)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(displayStatus)}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setPreviewInvoice(inv)} className="p-1.5 rounded-lg text-dark-300 hover:text-accent hover:bg-dark-700 transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleShare(inv)} className="p-1.5 rounded-lg text-dark-300 hover:text-blue-400 hover:bg-dark-700 transition-colors" title="Share">
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePrint(inv)} className="p-1.5 rounded-lg text-dark-300 hover:text-purple-400 hover:bg-dark-700 transition-colors" title="Print/PDF">
                            <Printer className="w-4 h-4" />
                          </button>
                          <div className="relative">
                            <select
                              value={displayStatus}
                              onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                              className="bg-dark-700 border-dark-600 text-xs rounded-lg px-2 py-1 text-dark-200 cursor-pointer appearance-none pr-6"
                            >
                              {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Modal isOpen={!!previewInvoice} onClose={() => setPreviewInvoice(null)} title="Invoice Preview" maxWidth="max-w-4xl">
        {previewInvoice && (
          <InvoicePreview invoice={previewInvoice} onBack={null} />
        )}
      </Modal>
    </div>
  );
}
