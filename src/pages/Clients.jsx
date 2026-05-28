// ==========================================
// FreelanceOS — Clients CRM Page
// ==========================================
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Mail, Phone, MapPin, Building2,
  Edit2, Trash2, IndianRupee, Users, Briefcase, Filter,
  MessageCircle, FileText, BookOpen, AlertTriangle
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { generateId, formatINR } from '../utils/helpers';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import StatusBadge from '../components/UI/StatusBadge';
import ClientForm from '../components/Clients/ClientForm';

const STATUS_TABS = ['All', 'Proposal Sent', 'In Progress', 'Invoice Sent', 'Paid', 'Overdue', 'At Risk'];

export default function Clients() {
  const { state, dispatch, addToast } = useData();
  const navigate = useNavigate();
  const { clients } = state;
  const invoices = state.invoices || [];

  // ---- Local UI state ----
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, client: null });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  // Compute Outstanding & Health for each client
  const clientsWithData = useMemo(() => {
    return (clients || []).map(c => {
      // 1. Outstanding Amount
      const clientInvoices = invoices.filter(i => (i.clientName === c.name || i.clientId === c.id) && i.status !== 'Paid');
      const outstanding = clientInvoices.reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);

      // 2. Health score dot (green/amber/red)
      let health = 'green';
      
      // Critical Red flags
      let maxOverdueDays = 0;
      clientInvoices.forEach(i => {
        const days = Math.floor((today - new Date(i.dueDate)) / 86400000);
        if (days > maxOverdueDays) maxOverdueDays = days;
      });

      if (c.isAtRisk || maxOverdueDays >= 60) {
        health = 'red';
      } else if (maxOverdueDays >= 15) {
        health = 'amber';
      } else if (c.lastContactedAt) {
        const contactDays = Math.floor((today - new Date(c.lastContactedAt)) / 86400000);
        if (contactDays > 30) {
          health = 'amber';
        }
      }

      return {
        ...c,
        outstanding,
        health,
      };
    });
  }, [clients, invoices, today]);

  // ---- Derived data ----
  const filteredClients = useMemo(() => {
    let list = clientsWithData;

    // Status / At Risk filter
    if (activeTab === 'At Risk') {
      list = list.filter(c => c.isAtRisk || c.health === 'red');
    } else if (activeTab !== 'All') {
      list = list.filter(c => c.status === activeTab);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.projectName || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [clientsWithData, activeTab, search]);

  // Status counts for badges
  const statusCounts = useMemo(() => {
    const counts = { All: clients.length };
    STATUS_TABS.slice(1).forEach(tab => {
      if (tab === 'At Risk') {
        counts[tab] = clientsWithData.filter(c => c.isAtRisk || c.health === 'red').length;
      } else {
        counts[tab] = clients.filter(c => c.status === tab).length;
      }
    });
    return counts;
  }, [clients, clientsWithData]);

  // Total portfolio value
  const totalValue = useMemo(
    () => clients.reduce((sum, c) => sum + (Number(c.projectValue) || 0), 0),
    [clients]
  );

  // ---- Handlers ----
  function openAddModal() {
    setEditingClient(null);
    setModalOpen(true);
  }

  function openEditModal(client) {
    setEditingClient(client);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingClient(null);
  }

  function handleFormSubmit(formData) {
    if (editingClient) {
      dispatch({
        type: 'UPDATE_CLIENT',
        payload: { ...editingClient, ...formData },
      });
      addToast('Client updated successfully', 'success');
    } else {
      dispatch({
        type: 'ADD_CLIENT',
        payload: {
          ...formData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          isAtRisk: false,
          lastContactedAt: null,
        },
      });
      addToast('Client added successfully', 'success');
    }
    closeModal();
  }

  function handleDelete() {
    if (deleteConfirm.client) {
      dispatch({ type: 'DELETE_CLIENT', payload: deleteConfirm.client.id });
      addToast('Client deleted', 'success');
      setDeleteConfirm({ open: false, client: null });
    }
  }

  function logClientContact(id) {
    dispatch({ type: 'LOG_CLIENT_CONTACT', payload: id });
    addToast('Client contact logged!');
  }

  function toggleAtRisk(client) {
    const newVal = !client.isAtRisk;
    dispatch({
      type: 'UPDATE_CLIENT',
      payload: { id: client.id, isAtRisk: newVal }
    });
    addToast(newVal ? 'Client marked as At Risk' : 'Client risk flag cleared');
  }

  // ---- Render ----
  return (
    <div className="page-enter space-y-6">
      {/* ============ Page Header ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-dark-50 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center shadow-lg shadow-accent/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            Clients
            <span className="ml-1 text-base font-medium text-dark-300">({clients.length})</span>
          </h1>
          <p className="text-dark-300 text-sm mt-1">
            Manage your client relationships &middot; Portfolio value:{' '}
            <span className="text-accent font-semibold">{formatINR(totalValue)}</span>
          </p>
        </div>

        <button onClick={openAddModal} className="btn-primary flex items-center gap-2 self-start">
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* ============ Search + Status Tabs ============ */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, company, or project..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scroll">
          <Filter className="w-4 h-4 text-dark-300 mr-1 flex-shrink-0" />
          {STATUS_TABS.map(tab => {
            const isActive = activeTab === tab;
            const count = statusCounts[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
                  ${
                    isActive
                      ? 'bg-accent/10 text-accent border border-accent/30 shadow-sm shadow-accent/10'
                      : 'text-dark-300 hover:text-dark-100 hover:bg-dark-700/60 border border-transparent'
                  }`}
              >
                {tab}
                {count > 0 && (
                  <span
                    className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold ${
                      isActive ? 'bg-accent/20 text-accent' : 'bg-dark-600 text-dark-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ Client Cards Grid ============ */}
      {filteredClients.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-dark-400" />
          </div>
          <h3 className="text-dark-100 font-semibold text-lg mb-1">No clients found</h3>
          <p className="text-dark-300 text-sm max-w-xs mb-5">
            {search || activeTab !== 'All'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first client.'}
          </p>
          {!search && activeTab === 'All' && (
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Your First Client
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClients.map((client, idx) => (
            <div
              key={client.id}
              className={`glass-card-hover group p-5 flex flex-col justify-between animate-slide-up transition-all duration-300 border-2 ${
                client.isAtRisk ? 'border-red-500/80 shadow-lg shadow-red-500/5' : 'border-transparent'
              }`}
              style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}
            >
              <div>
                {/* Card top: name + status + health dot */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar with health indicator dot */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-amber-500/20 border border-accent/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-accent font-bold text-sm">
                          {(client.name || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-dark-900 ${
                        client.health === 'green' ? 'bg-emerald-500' :
                        client.health === 'amber' ? 'bg-amber-500' :
                        'bg-red-500'
                      }`} title={`Health Status: ${client.health}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-dark-50 font-semibold text-sm truncate flex items-center gap-1.5">
                        {client.name}
                        {client.isAtRisk && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                      </h3>
                      <p className="text-dark-300 text-xs truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        {client.company}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={client.status} />
                  </div>
                </div>

                {/* Project info */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Briefcase className="w-3.5 h-3.5 text-dark-400 flex-shrink-0" />
                  <span className="text-dark-200 text-xs truncate">{client.projectName || '—'}</span>
                </div>

                {/* Value & Outstanding Chips */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-dark-700/50 border border-dark-600/30 rounded-lg p-2 text-center">
                    <span className="text-dark-400 text-[10px] block">Project Value</span>
                    <span className="text-dark-50 font-bold text-xs mt-0.5 inline-flex items-center gap-0.5">
                      <IndianRupee className="w-3 h-3 text-accent" />
                      {formatINR(client.projectValue || 0).replace('₹', '')}
                    </span>
                  </div>
                  
                  <div className={`border rounded-lg p-2 text-center ${
                    client.outstanding > 0 
                      ? 'bg-red-500/5 border-red-500/20 text-red-400'
                      : 'bg-dark-700/50 border-dark-600/30 text-dark-300'
                  }`}>
                    <span className="text-[10px] block">Outstanding</span>
                    <span className="font-bold text-xs mt-0.5 inline-flex items-center gap-0.5">
                      <IndianRupee className="w-3 h-3" />
                      {formatINR(client.outstanding).replace('₹', '')}
                    </span>
                  </div>
                </div>

                {/* Contact details */}
                <div className="space-y-1.5 mb-4 px-1">
                  {client.email && (
                    <a
                      href={`mailto:${client.email}`}
                      className="flex items-center gap-2 text-xs text-dark-300 hover:text-accent transition-colors truncate"
                    >
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </a>
                  )}
                  {client.phone && (
                    <a
                      href={`tel:${client.phone}`}
                      className="flex items-center gap-2 text-xs text-dark-300 hover:text-accent transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      {client.phone}
                    </a>
                  )}
                  {client.address && (
                    <p className="flex items-center gap-2 text-xs text-dark-300 truncate">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{client.address}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-dark-400 italic">
                    Last Contact: {client.lastContactedAt ? new Date(client.lastContactedAt).toLocaleDateString('en-IN') : 'No record'}
                  </p>
                </div>
              </div>

              {/* Action Buttons & Quick CRM */}
              <div className="space-y-2 pt-3 border-t border-dark-600/40 font-sans">
                {/* Quick actions strip */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => navigate(`/whatsapp?clientId=${client.id}`)}
                    className="flex-1 py-1 px-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-100 hover:text-dark-50 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all border border-dark-600/30"
                    title="Send WhatsApp Reminder"
                  >
                    <MessageCircle className="w-3 h-3 text-accent" /> Remind
                  </button>
                  <button
                    onClick={() => navigate('/invoice', { state: { client } })}
                    className="flex-1 py-1 px-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-100 hover:text-dark-50 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all border border-dark-600/30"
                    title="Generate GST Invoice"
                  >
                    <FileText className="w-3 h-3 text-accent" /> Invoice
                  </button>
                  <button
                    onClick={() => navigate(`/client-ledger?clientId=${client.id}`)}
                    className="flex-1 py-1 px-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-100 hover:text-dark-50 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all border border-dark-600/30"
                    title="View Account Statement Ledger"
                  >
                    <BookOpen className="w-3 h-3 text-accent" /> Ledger
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => logClientContact(client.id)}
                    className="px-2 py-1 rounded bg-accent/10 text-accent font-semibold hover:bg-accent/20 transition-all"
                  >
                    Log Contact
                  </button>
                  <button
                    onClick={() => toggleAtRisk(client)}
                    className={`px-2 py-1 rounded font-semibold transition-all ${
                      client.isAtRisk 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                    }`}
                  >
                    {client.isAtRisk ? 'Flagged At Risk' : 'Mark At Risk'}
                  </button>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(client)}
                      className="p-1.5 text-dark-400 hover:text-accent rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ open: true, client })}
                      className="p-1.5 text-dark-400 hover:text-red-400 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ Add / Edit Modal ============ */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingClient ? 'Edit Client' : 'Add New Client'}
        maxWidth="max-w-xl"
      >
        <ClientForm
          client={editingClient}
          onSubmit={handleFormSubmit}
          onCancel={closeModal}
        />
      </Modal>

      {/* ============ Delete Confirmation ============ */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, client: null })}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Are you sure you want to delete "${deleteConfirm.client?.name || ''}"? This action cannot be undone.`}
      />
    </div>
  );
}
