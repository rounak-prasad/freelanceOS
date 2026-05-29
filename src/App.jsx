import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import ToastContainer from './components/UI/Toast';
import AIChatWidget from './components/UI/AIChatWidget';
import GuardrailAlerts from './components/UI/GuardrailAlerts';
import { useData } from './context/DataContext';

// Lazy load pages for better initial load
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceHistory = lazy(() => import('./pages/InvoiceHistory'));
const AgingReport = lazy(() => import('./pages/AgingReport'));
const ClientLedger = lazy(() => import('./pages/ClientLedger'));
const Milestones = lazy(() => import('./pages/Milestones'));
const RevenueGoals = lazy(() => import('./pages/RevenueGoals'));
const GSTR1Summary = lazy(() => import('./pages/GSTR1Summary'));
const FYSummary = lazy(() => import('./pages/FYSummary'));
const RecurringInvoices = lazy(() => import('./pages/RecurringInvoices'));
const ContractGenerator = lazy(() => import('./pages/ContractGenerator'));
const LinkedInOutreach = lazy(() => import('./pages/LinkedInOutreach'));
const WhatsApp = lazy(() => import('./pages/WhatsApp'));
const Proposals = lazy(() => import('./pages/Proposals'));
const TimeTracker = lazy(() => import('./pages/TimeTracker'));
const Expenses = lazy(() => import('./pages/Expenses'));
const TaxDashboard = lazy(() => import('./pages/TaxDashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

// New pages
const ScopeCreep = lazy(() => import('./pages/ScopeCreep'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const RateCalculator = lazy(() => import('./pages/RateCalculator'));
const BusinessHealth = lazy(() => import('./pages/BusinessHealth'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));

// India compliance moat
const ComplianceGuardrails = lazy(() => import('./pages/ComplianceGuardrails'));
const CrossBorder = lazy(() => import('./pages/CrossBorder'));
const CashFlow = lazy(() => import('./pages/CashFlow'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="text-sm text-dark-300">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { state, addToast } = useData();
  const startupRecurringCheck =
    state?.settings?.startupRecurringCheck ?? state?.settings?.checkRecurringOnStartup;

  // On app load, check for due recurring invoices
  useEffect(() => {
    if (state && startupRecurringCheck) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const due = (state.recurringSchedules || []).filter(s =>
        s.isActive && new Date(s.nextDueDate) <= today
      );
      if (due.length > 0) {
        // Wait a small delay so components are mounted
        const timer = setTimeout(() => {
          addToast(`${due.length} recurring invoice(s) are due! Go to Recurring to generate them.`, 'warning');
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [state?.recurringSchedules, startupRecurringCheck, addToast]);

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar />
      <main className="flex-1 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-6">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<div className="space-y-6"><GuardrailAlerts /><Dashboard /></div>} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/client-ledger" element={<ClientLedger />} />
              <Route path="/milestones" element={<Milestones />} />
              <Route path="/goals" element={<RevenueGoals />} />
              <Route path="/invoice" element={<Invoices />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoice-history" element={<InvoiceHistory />} />
              <Route path="/aging" element={<AgingReport />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/tax" element={<TaxDashboard />} />
              <Route path="/gstr1" element={<GSTR1Summary />} />
              <Route path="/fy-summary" element={<FYSummary />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/recurring" element={<RecurringInvoices />} />
              <Route path="/whatsapp" element={<WhatsApp />} />
              <Route path="/proposals" element={<Proposals />} />
              <Route path="/contract" element={<ContractGenerator />} />
              <Route path="/linkedin" element={<LinkedInOutreach />} />
              <Route path="/time-tracker" element={<TimeTracker />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/settings" element={<Settings />} />

              {/* New Pages */}
              <Route path="/scope-creep" element={<ScopeCreep />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/rate-calculator" element={<RateCalculator />} />
              <Route path="/health" element={<BusinessHealth />} />
              <Route path="/client-portal/:projectId" element={<ClientPortal />} />

              {/* India compliance moat */}
              <Route path="/guardrails" element={<ComplianceGuardrails />} />
              <Route path="/cross-border" element={<CrossBorder />} />
              <Route path="/cash-flow" element={<CashFlow />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      <ToastContainer />
      <AIChatWidget />
    </div>
  );
}
