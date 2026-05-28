// ==========================================
// FreelanceOS — Expense Tracker
// ==========================================
import React, { useState, useMemo } from 'react';
import {
  Wallet, Plus, Trash2, Search, Filter, ShieldCheck, Users2,
  Monitor, Cpu, Car, Wifi, Building2, Megaphone, MoreHorizontal,
  CalendarDays, Tag, Receipt, TrendingDown, X, ChevronDown,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useData } from '../context/DataContext';
import Modal from '../components/UI/Modal';
import StatCard from '../components/UI/StatCard';
import { formatINR, generateId } from '../utils/helpers';

// ---- Category config ----
const CATEGORIES = ['Software', 'Hardware', 'Travel', 'Internet', 'Office', 'Marketing', 'Other'];

const CATEGORY_ICONS = {
  Software: Monitor,
  Hardware: Cpu,
  Travel: Car,
  Internet: Wifi,
  Office: Building2,
  Marketing: Megaphone,
  Other: MoreHorizontal,
};

const CATEGORY_COLORS = {
  Software: '#3B82F6',
  Hardware: '#A855F7',
  Travel: '#F59E0B',
  Internet: '#22C55E',
  Office: '#F97316',
  Marketing: '#EC4899',
  Other: '#737373',
};

// ---- Date range helpers ----
function getDateRangeStart(range) {
  const now = new Date();
  switch (range) {
    case 'this-month': {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    case 'last-month': {
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }
    case 'last-3-months': {
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    }
    default:
      return null; // 'all'
  }
}

function getDateRangeEnd(range) {
  const now = new Date();
  switch (range) {
    case 'last-month': {
      return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }
    default:
      return now;
  }
}

const DATE_RANGES = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'all', label: 'All Time' },
];

// ---- Custom Tooltip for Pie Chart ----
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 shadow-2xl">
      <p className="text-xs text-dark-400 mb-1">{payload[0].name}</p>
      <p className="text-base font-semibold text-dark-50">
        {formatINR(payload[0].value)}
      </p>
    </div>
  );
}

// ---- Empty form state ----
const emptyForm = {
  description: '',
  amount: '',
  category: 'Software',
  date: new Date().toISOString().split('T')[0],
  clientName: '',
  taxDeductible: false,
};

// ==================================================
// Main Expenses Page
// ==================================================
export default function Expenses() {
  const { state, dispatch, addToast } = useData();

  // ---- Modal state ----
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // ---- Filter state ----
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState('this-month');
  const [search, setSearch] = useState('');

  // ---- Filtered expenses ----
  const filteredExpenses = useMemo(() => {
    const rangeStart = getDateRangeStart(dateRange);
    const rangeEnd = getDateRangeEnd(dateRange);

    return (state.expenses || [])
      .filter((exp) => {
        // Category filter
        if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
        // Date range filter
        if (rangeStart) {
          const d = new Date(exp.date);
          if (d < rangeStart || d > rangeEnd) return false;
        }
        // Search
        if (search.trim()) {
          const q = search.toLowerCase();
          if (
            !exp.description.toLowerCase().includes(q) &&
            !(exp.clientName || '').toLowerCase().includes(q)
          ) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.expenses, categoryFilter, dateRange, search]);

  // ---- Summary stats (always for current month) ----
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthExpenses = (state.expenses || []).filter(
      (exp) => new Date(exp.date) >= monthStart && new Date(exp.date) <= now,
    );

    const totalMonth = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const taxDeductible = thisMonthExpenses
      .filter((e) => e.taxDeductible)
      .reduce((s, e) => s + Number(e.amount), 0);
    const clientLinked = thisMonthExpenses
      .filter((e) => e.clientName)
      .reduce((s, e) => s + Number(e.amount), 0);

    return { totalMonth, taxDeductible, clientLinked };
  }, [state.expenses]);

  // ---- Category breakdown (from filtered list) ----
  const categoryData = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((exp) => {
      map[exp.category] = (map[exp.category] || 0) + Number(exp.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const totalFiltered = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

  // ---- Form handlers ----
  function openModal() {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) {
      addToast('Please fill required fields', 'error');
      return;
    }

    const expense = {
      id: generateId(),
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      category: form.category,
      date: form.date,
      clientName: form.clientName,
      taxDeductible: form.taxDeductible,
    };

    dispatch({ type: 'ADD_EXPENSE', payload: expense });
    addToast('Expense added successfully!');
    setShowModal(false);
  }

  function handleDelete(id) {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
    addToast('Expense deleted', 'info');
  }

  // ---- Format date for display ----
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ---- Render ----
  return (
    <div className="page-enter space-y-6">
      {/* ═══════ Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            Expenses
            <Wallet className="w-6 h-6 text-accent opacity-70" />
          </h1>
          <p className="text-dark-400 mt-1">
            Track business expenses and maximise your tax deductions.
          </p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* ═══════ Summary Cards ═══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={TrendingDown}
          label="Total Expenses This Month"
          value={formatINR(stats.totalMonth)}
          color="red"
          subValue={`${(state.expenses || []).filter((e) => {
            const now = new Date();
            const ms = new Date(now.getFullYear(), now.getMonth(), 1);
            return new Date(e.date) >= ms && new Date(e.date) <= now;
          }).length} transactions`}
        />
        <StatCard
          icon={ShieldCheck}
          label="Tax Deductible"
          value={formatINR(stats.taxDeductible)}
          color="green"
          subValue="Claimable under 44ADA / ITR"
        />
        <StatCard
          icon={Users2}
          label="Client-linked Expenses"
          value={formatINR(stats.clientLinked)}
          color="blue"
          subValue="Billable to clients"
        />
      </div>

      {/* ═══════ Filters Bar ═══════ */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-dark-100 text-sm placeholder-dark-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none pl-10 pr-9 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-dark-100 text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors cursor-pointer"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
          </div>

          {/* Date range */}
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none pl-10 pr-9 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-dark-100 text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors cursor-pointer"
            >
              {DATE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ═══════ Content: Table + Chart ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ---- Expense Table (2/3 width) ---- */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#2A2A2A] text-xs font-semibold text-dark-400 uppercase tracking-wider">
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-2">Client</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Table body */}
          <div className="divide-y divide-[#2A2A2A]/60">
            {filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-dark-500">
                <Receipt className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">No expenses found</p>
                <p className="text-xs text-dark-600 mt-1">Try adjusting your filters or add a new expense.</p>
              </div>
            ) : (
              filteredExpenses.map((exp) => {
                const CatIcon = CATEGORY_ICONS[exp.category] || MoreHorizontal;
                const catColor = CATEGORY_COLORS[exp.category] || '#737373';

                return (
                  <div
                    key={exp.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group items-center"
                  >
                    {/* Date */}
                    <div className="md:col-span-2 flex items-center gap-2 md:gap-0">
                      <span className="md:hidden text-xs text-dark-500 font-medium w-16 shrink-0">Date</span>
                      <span className="text-sm text-dark-300">{fmtDate(exp.date)}</span>
                    </div>

                    {/* Description + Tax badge (mobile-friendly) */}
                    <div className="md:col-span-3 flex items-center gap-2 min-w-0">
                      <span className="md:hidden text-xs text-dark-500 font-medium w-16 shrink-0">Desc</span>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="text-sm font-medium text-dark-100 truncate">{exp.description}</span>
                        {exp.taxDeductible && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            Tax
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Category */}
                    <div className="md:col-span-2 flex items-center gap-2">
                      <span className="md:hidden text-xs text-dark-500 font-medium w-16 shrink-0">Cat</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${catColor}15`, border: `1px solid ${catColor}30` }}
                        >
                          <CatIcon className="w-3.5 h-3.5" style={{ color: catColor }} />
                        </div>
                        <span className="text-sm text-dark-300">{exp.category}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="md:col-span-2 flex items-center gap-2 md:justify-end">
                      <span className="md:hidden text-xs text-dark-500 font-medium w-16 shrink-0">Amt</span>
                      <span className="text-sm font-semibold text-dark-50">{formatINR(exp.amount)}</span>
                    </div>

                    {/* Client */}
                    <div className="md:col-span-2 flex items-center gap-2">
                      <span className="md:hidden text-xs text-dark-500 font-medium w-16 shrink-0">Client</span>
                      {exp.clientName ? (
                        <span className="text-sm text-dark-300 truncate">{exp.clientName}</span>
                      ) : (
                        <span className="text-xs text-dark-600">—</span>
                      )}
                    </div>

                    {/* Delete */}
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="p-2 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Table footer */}
          {filteredExpenses.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#2A2A2A] bg-white/[0.02]">
              <span className="text-xs text-dark-400">
                {filteredExpenses.length} expense{filteredExpenses.length !== 1 && 's'}
              </span>
              <span className="text-sm font-semibold text-dark-50">
                Total: {formatINR(totalFiltered)}
              </span>
            </div>
          )}
        </div>

        {/* ---- Category Breakdown (1/3 width) ---- */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-dark-100 mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-accent" />
            Category Breakdown
          </h2>

          {categoryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-dark-500">
              <Tag className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs">No data to display</p>
            </div>
          ) : (
            <>
              {/* Pie chart */}
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={3}
                    >
                      {categoryData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={CATEGORY_COLORS[entry.name] || '#737373'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend / bars */}
              <div className="space-y-3 mt-4">
                {categoryData.map((entry) => {
                  const pct = totalFiltered > 0 ? ((entry.value / totalFiltered) * 100).toFixed(1) : 0;
                  const CatIcon = CATEGORY_ICONS[entry.name] || MoreHorizontal;
                  const color = CATEGORY_COLORS[entry.name] || '#737373';

                  return (
                    <div key={entry.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <CatIcon className="w-3.5 h-3.5" style={{ color }} />
                          <span className="text-xs text-dark-200">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-dark-100">{formatINR(entry.value)}</span>
                          <span className="text-[10px] text-dark-500">{pct}%</span>
                        </div>
                      </div>
                      <div className="relative w-full h-1.5 rounded-full bg-[#262626] overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════ Add Expense Modal ═══════ */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Expense" maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="e.g. Figma Pro subscription"
              className="w-full px-4 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-dark-100 text-sm placeholder-dark-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
              autoFocus
            />
          </div>

          {/* Amount + Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">
                Amount (₹) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full px-4 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-dark-100 text-sm placeholder-dark-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Category</label>
              <div className="relative">
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="appearance-none w-full px-4 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-dark-100 text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Date + Client row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-dark-100 text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Client (optional)</label>
              <div className="relative">
                <select
                  name="clientName"
                  value={form.clientName}
                  onChange={handleChange}
                  className="appearance-none w-full px-4 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-dark-100 text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors cursor-pointer"
                >
                  <option value="">None</option>
                  {(state.clients || []).map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Tax Deductible */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                name="taxDeductible"
                checked={form.taxDeductible}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-md border-2 border-[#2A2A2A] bg-[#1A1A1A] peer-checked:bg-green-500 peer-checked:border-green-500 transition-all flex items-center justify-center">
                {form.taxDeductible && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-dark-200 group-hover:text-dark-50 transition-colors">
                Tax Deductible
              </span>
              <p className="text-xs text-dark-500">Mark if claimable under section 44ADA or other deductions</p>
            </div>
          </label>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-dark-300 hover:text-dark-100 hover:bg-dark-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all duration-300"
            >
              Add Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
