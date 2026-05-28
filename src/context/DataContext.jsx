// ==========================================
// FreelanceOS — Central Data Context
// ==========================================
import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import {
  sampleClients, sampleInvoices, sampleActivities, sampleProjects,
  sampleTimeEntries, sampleExpenses, sampleProposals, sampleEarnings,
  sampleMilestoneProjects, sampleRecurringSchedules, sampleChangeRequests,
  defaultSettings,
} from '../utils/sampleData';

const DataContext = createContext(null);

const STORAGE_KEY = 'freelanceos_data';
const DEFAULT_REVENUE_GOALS = defaultSettings.revenueGoals || { monthly: 150000, quarterly: 450000, annual: 1800000 };

function normalizeSettings(settings = {}) {
  const merged = { ...defaultSettings, ...settings };
  const startupRecurringCheck =
    settings.startupRecurringCheck ??
    settings.checkRecurringOnStartup ??
    defaultSettings.startupRecurringCheck ??
    defaultSettings.checkRecurringOnStartup ??
    true;

  return {
    ...merged,
    startupRecurringCheck,
    checkRecurringOnStartup: startupRecurringCheck,
    defaultPaymentTerms: merged.defaultPaymentTerms ?? merged.defaultPaymentDays ?? 15,
    revenueGoals: merged.revenueGoals || DEFAULT_REVENUE_GOALS,
  };
}

function getDefaultState() {
  const settings = normalizeSettings(defaultSettings);

  return {
    clients: sampleClients,
    invoices: sampleInvoices,
    activities: sampleActivities,
    projects: sampleProjects,
    timeEntries: sampleTimeEntries,
    expenses: sampleExpenses,
    proposals: sampleProposals,
    earnings: sampleEarnings,
    earningsHistory: sampleEarnings,
    revenueGoals: settings.revenueGoals,
    tdsEntries: [],
    milestoneProjects: sampleMilestoneProjects,
    recurringSchedules: sampleRecurringSchedules,
    changeRequests: sampleChangeRequests,
    settings,
    activeTimer: null,
  };
}

// ---- Initial State ----
function getInitialState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const settings = normalizeSettings(parsed.settings || {});
      const revenueGoals = parsed.revenueGoals || settings.revenueGoals || DEFAULT_REVENUE_GOALS;
      // Ensure all keys exist (merge with defaults for forward compat)
      return {
        clients: parsed.clients || [],
        invoices: parsed.invoices || [],
        activities: parsed.activities || [],
        projects: parsed.projects || [],
        timeEntries: parsed.timeEntries || [],
        expenses: parsed.expenses || [],
        proposals: parsed.proposals || [],
        earnings: parsed.earnings || parsed.earningsHistory || sampleEarnings,
        earningsHistory: parsed.earningsHistory || parsed.earnings || sampleEarnings,
        revenueGoals,
        tdsEntries: parsed.tdsEntries || [],
        milestoneProjects: parsed.milestoneProjects || [],
        recurringSchedules: parsed.recurringSchedules || [],
        changeRequests: parsed.changeRequests || [],
        settings: { ...settings, revenueGoals },
        activeTimer: parsed.activeTimer || null,
      };
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
  }

  // First load — use sample data
  return getDefaultState();
}

// ---- Reducer ----
function dataReducer(state, action) {
  switch (action.type) {
    // -- Clients --
    case 'ADD_CLIENT':
      return { ...state, clients: [...state.clients, action.payload] };
    case 'UPDATE_CLIENT':
      return { ...state, clients: state.clients.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
    case 'DELETE_CLIENT':
      return { ...state, clients: state.clients.filter(c => c.id !== action.payload) };
    case 'LOG_CLIENT_CONTACT':
      return { ...state, clients: state.clients.map(c => c.id === action.payload ? { ...c, lastContactedAt: new Date().toISOString() } : c) };

    // -- Invoices --
    case 'ADD_INVOICE':
      return {
        ...state,
        invoices: [...state.invoices, action.payload],
        settings: { ...state.settings, lastInvoiceNumber: state.settings.lastInvoiceNumber + 1 },
      };
    case 'UPDATE_INVOICE':
      return { ...state, invoices: state.invoices.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
    case 'DELETE_INVOICE':
      return { ...state, invoices: state.invoices.filter(i => i.id !== action.payload) };

    // -- Activities --
    case 'ADD_ACTIVITY':
      return { ...state, activities: [action.payload, ...state.activities].slice(0, 50) };

    // -- Projects --
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case 'REORDER_PROJECTS':
      return { ...state, projects: action.payload };

    // -- Time Entries --
    case 'ADD_TIME_ENTRY':
      return { ...state, timeEntries: [action.payload, ...state.timeEntries] };
    case 'UPDATE_TIME_ENTRY':
      return { ...state, timeEntries: state.timeEntries.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t) };
    case 'DELETE_TIME_ENTRY':
      return { ...state, timeEntries: state.timeEntries.filter(t => t.id !== action.payload) };
    case 'SET_ACTIVE_TIMER':
      return { ...state, activeTimer: action.payload };

    // -- Expenses --
    case 'ADD_EXPENSE':
      return { ...state, expenses: [action.payload, ...state.expenses] };
    case 'UPDATE_EXPENSE':
      return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? { ...e, ...action.payload } : e) };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };

    // -- Proposals --
    case 'ADD_PROPOSAL':
      return { ...state, proposals: [...state.proposals, action.payload] };
    case 'UPDATE_PROPOSAL':
      return { ...state, proposals: state.proposals.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case 'DELETE_PROPOSAL':
      return { ...state, proposals: state.proposals.filter(p => p.id !== action.payload) };

    // -- Milestone Projects --
    case 'ADD_MILESTONE_PROJECT':
      return { ...state, milestoneProjects: [...state.milestoneProjects, action.payload] };
    case 'UPDATE_MILESTONE_PROJECT':
      return { ...state, milestoneProjects: state.milestoneProjects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case 'DELETE_MILESTONE_PROJECT':
      return { ...state, milestoneProjects: state.milestoneProjects.filter(p => p.id !== action.payload) };
    case 'UPDATE_MILESTONE_STATUS': {
      const { projectId, milestoneId, status } = action.payload;
      return {
        ...state,
        milestoneProjects: state.milestoneProjects.map(p =>
          p.id === projectId
            ? { ...p, milestones: p.milestones.map(m => m.id === milestoneId ? { ...m, status } : m) }
            : p
        ),
      };
    }

    // -- Recurring Schedules --
    case 'ADD_RECURRING_SCHEDULE':
      return { ...state, recurringSchedules: [...state.recurringSchedules, action.payload] };
    case 'UPDATE_RECURRING_SCHEDULE':
      return { ...state, recurringSchedules: state.recurringSchedules.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s) };
    case 'DELETE_RECURRING_SCHEDULE':
      return { ...state, recurringSchedules: state.recurringSchedules.filter(s => s.id !== action.payload) };

    // -- Change Requests --
    case 'ADD_CHANGE_REQUEST':
      return { ...state, changeRequests: [...state.changeRequests, action.payload] };
    case 'UPDATE_CHANGE_REQUEST':
      return { ...state, changeRequests: state.changeRequests.map(cr => cr.id === action.payload.id ? { ...cr, ...action.payload } : cr) };
    case 'DELETE_CHANGE_REQUEST':
      return { ...state, changeRequests: state.changeRequests.filter(cr => cr.id !== action.payload) };

    // -- Settings --
    case 'UPDATE_SETTINGS': {
      const settings = normalizeSettings({ ...state.settings, ...action.payload });
      const revenueGoals = action.payload.revenueGoals || state.revenueGoals || settings.revenueGoals;
      return { ...state, settings: { ...settings, revenueGoals }, revenueGoals };
    }

    // -- Revenue Goals --
    case 'UPDATE_REVENUE_GOALS':
      return {
        ...state,
        revenueGoals: action.payload,
        settings: { ...state.settings, revenueGoals: action.payload },
      };

    // -- TDS Entries --
    case 'ADD_TDS_ENTRY':
      return { ...state, tdsEntries: [action.payload, ...(state.tdsEntries || [])] };
    case 'DELETE_TDS_ENTRY':
      return { ...state, tdsEntries: (state.tdsEntries || []).filter(e => e.id !== action.payload) };

    // -- Earnings --
    case 'UPDATE_EARNINGS':
      return { ...state, earnings: action.payload, earningsHistory: action.payload };

    // -- Reset --
    case 'RESET_DATA':
      localStorage.removeItem(STORAGE_KEY);
      return getDefaultState();
    case 'LOAD_SAMPLE_DATA':
      return getDefaultState();
    case 'CLEAR_ALL_DATA':
      localStorage.removeItem(STORAGE_KEY);
      return {
        clients: [],
        invoices: [],
        activities: [],
        projects: [],
        timeEntries: [],
        expenses: [],
        proposals: [],
        earnings: [],
        earningsHistory: [],
        revenueGoals: DEFAULT_REVENUE_GOALS,
        tdsEntries: [],
        milestoneProjects: [],
        recurringSchedules: [],
        changeRequests: [],
        settings: normalizeSettings(defaultSettings),
        activeTimer: null,
      };

    // -- Import --
    case 'IMPORT_DATA': {
      const settings = normalizeSettings(action.payload.settings || state.settings);
      const revenueGoals = action.payload.revenueGoals || settings.revenueGoals || state.revenueGoals || DEFAULT_REVENUE_GOALS;
      return { ...state, ...action.payload, settings: { ...settings, revenueGoals }, revenueGoals };
    }

    default:
      return state;
  }
}

// ---- Provider ----
export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, null, getInitialState);
  const [toasts, setToasts] = useState([]);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, [state]);

  // Toast notification system
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Export data as JSON
  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freelanceos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Data exported successfully!');
  }, [state, addToast]);

  // Import data from JSON
  const importData = useCallback((jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      dispatch({ type: 'IMPORT_DATA', payload: data });
      addToast('Data imported successfully!');
    } catch {
      addToast('Failed to import data. Invalid JSON file.', 'error');
    }
  }, [addToast]);

  return (
    <DataContext.Provider value={{ state, dispatch, toasts, addToast, removeToast, exportData, importData }}>
      {children}
    </DataContext.Provider>
  );
}

// ---- Hook ----
export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
