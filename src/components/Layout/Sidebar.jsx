import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, Flag, Target,
  FileText, History, AlertTriangle, Wallet, Calculator,
  BarChart3, CalendarClock, Repeat, MessageCircle,
  FileSignature, ScrollText, Linkedin,
  Settings, ChevronLeft, ChevronRight, Menu, X, Zap,
  Activity, Workflow, ShieldAlert, Timer, Briefcase,
  ShieldCheck, Globe, LineChart, UserPlus, CreditCard, FileCheck2
} from 'lucide-react';

const navSections = [
  {
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/health', label: 'Business Health', icon: Activity },
      { path: '/guardrails', label: 'Compliance Guard', icon: ShieldCheck },
    ]
  },
  {
    items: [
      { path: '/clients', label: 'Clients', icon: Users },
      { path: '/client-ledger', label: 'Client Ledger', icon: BookOpen },
      { path: '/projects', label: 'Projects', icon: Briefcase },
      { path: '/milestones', label: 'Milestones', icon: Flag, activePaths: ['/client-portal'] },
      { path: '/goals', label: 'Goals', icon: Target },
    ]
  },
  {
    title: 'FINANCES',
    items: [
      { path: '/pipeline', label: 'Pipeline', icon: Workflow },
      { path: '/cash-flow', label: 'Cash Flow', icon: LineChart },
      { path: '/invoice', label: 'GST Invoice', icon: FileText, activePaths: ['/invoices'] },
      { path: '/invoice-history', label: 'Invoice History', icon: History },
      { path: '/aging', label: 'Aging Report', icon: AlertTriangle },
      { path: '/expenses', label: 'Expenses', icon: Wallet },
      { path: '/tax', label: 'TDS & Tax', icon: Calculator },
      { path: '/cross-border', label: 'Cross-Border & FIRA', icon: Globe },
      { path: '/gstr1', label: 'GSTR-1 Summary', icon: BarChart3 },
      { path: '/fy-summary', label: 'FY Summary', icon: CalendarClock },
      { path: '/reports', label: 'FY Report', icon: BarChart3 },
      { path: '/recurring', label: 'Recurring', icon: Repeat },
    ]
  },
  {
    title: 'TOOLS',
    items: [
      { path: '/scope-creep', label: 'Scope Guard', icon: ShieldAlert },
      { path: '/time-tracker', label: 'Time Tracker', icon: Timer },
      { path: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
      { path: '/proposals', label: 'Proposal Builder', icon: FileSignature },
      { path: '/contract', label: 'Contract Generator', icon: ScrollText },
      { path: '/linkedin', label: 'LinkedIn Outreach', icon: Linkedin },
      { path: '/rate-calculator', label: 'Rate Calculator', icon: Calculator },
    ]
  },
  {
    title: 'WORKSPACE',
    authOnly: true, // only shown in cloud/auth mode
    items: [
      { path: '/team', label: 'Team', icon: UserPlus },
      { path: '/billing', label: 'Billing & Plan', icon: CreditCard },
      { path: '/gst-filing', label: 'GST Filing', icon: FileCheck2 },
    ]
  },
  {
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
    ]
  },
];

function normalizePath(path) {
  if (!path || path === '/') return '/';
  return path.replace(/\/+$/, '');
}

function pathMatches(currentPath, targetPath) {
  const current = normalizePath(currentPath);
  const target = normalizePath(targetPath);

  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}

function isNavItemActive(pathname, item) {
  return [item.path, ...(item.activePaths || [])].some((path) => pathMatches(pathname, path));
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, isAuthed, logout } = useAuth();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-dark-600/50">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-base font-bold text-dark-50 tracking-tight">Freelance<span className="text-gradient">OS</span></h1>
            <p className="text-[10px] text-dark-300 -mt-0.5">Your Business, Simplified</p>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto custom-scroll">
        {navSections.filter((section) => !section.authOnly || isAuthed).map((section, sIdx) => (
          <div key={sIdx}>
            {/* Section divider / title */}
            {section.title && (
              <div className="mt-4 mb-2 px-3">
                {!collapsed ? (
                  <p className="text-[10px] font-semibold text-dark-400 uppercase tracking-[0.15em]">{section.title}</p>
                ) : (
                  <div className="border-t border-dark-600/50 mx-1" />
                )}
              </div>
            )}
            {/* If no title and not the first section, add a subtle divider */}
            {!section.title && sIdx > 0 && (
              <div className="my-2 border-t border-dark-600/50 mx-2" />
            )}

            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(location.pathname, item);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative
                    ${isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-dark-200 hover:text-dark-50 hover:bg-dark-700/50'
                    }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full" />
                  )}
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-accent' : 'text-dark-300 group-hover:text-dark-200'}`} />
                  {!collapsed && <span className="animate-fade-in truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Account / sign out (auth mode only) */}
      {isAuthed && (
        <div className="border-t border-dark-600/50 p-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-dark-100 truncate">{user?.name || user?.email}</p>
                <button onClick={logout} className="text-[11px] text-dark-400 hover:text-accent transition">Sign out</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden lg:block border-t border-dark-600/50 p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-dark-300 hover:text-dark-200 hover:bg-dark-700/50 transition-all text-sm"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-dark-800 border border-dark-600 text-dark-200 hover:text-dark-50 transition-colors"
        id="mobile-menu-toggle"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-dark-800 border-r border-dark-600/50 transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1 text-dark-300 hover:text-dark-50"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-dark-800/95 backdrop-blur-xl border-r border-dark-600/50 transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Spacer for desktop */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[260px]'}`} />
    </>
  );
}
