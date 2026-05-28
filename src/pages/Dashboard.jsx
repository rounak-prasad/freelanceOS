// ==========================================
// FreelanceOS — Dashboard (Home Page Upgrade)
// ==========================================
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IndianRupee, Clock, AlertTriangle, Users,
  FileText, UserPlus, Send, CheckCircle, MessageCircle,
  CalendarClock, Zap, Receipt, Timer, Wallet,
  ArrowRight, Target, TrendingUp, Sparkles, Calculator,
  ShieldAlert, ChevronRight, Calendar
} from 'lucide-react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { useData } from '../context/DataContext';
import StatCard from '../components/UI/StatCard';
import { formatINR, getRelativeTime, calculateGST, getCurrentFY } from '../utils/helpers';

// ---- Icon resolver for activity feed ----
const iconMap = {
  FileText, IndianRupee, UserPlus, Send, CheckCircle, MessageCircle,
  Clock, AlertTriangle, Users, CalendarClock, Zap, Receipt, Timer, Wallet, ShieldAlert
};

function resolveIcon(name) {
  return iconMap[name] || Zap;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInvoiceTotal(inv) {
  if (inv.total) return inv.total;
  const subtotal = (inv.lineItems || []).reduce((s, li) => s + li.quantity * li.rate, 0);
  const gst = calculateGST(subtotal, inv.gstRate || 18, inv.isInterState || false);
  return gst.total;
}

export default function Dashboard() {
  const { state } = useData();
  const navigate = useNavigate();

  const invoices = state.invoices || [];
  const clients = state.clients || [];
  const recurring = state.recurringSchedules || [];
  const milestoneProjects = state.milestoneProjects || [];
  const changeRequests = state.changeRequests || [];
  
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  // ---------- ROW 1: Money Health ----------
  const moneyStats = useMemo(() => {
    const fy = getCurrentFY();
    const fyStart = new Date(fy.start, 3, 1);
    const fyEnd = new Date(fy.end, 2, 31);

    // 1. Total Earned This FY (Paid Invoices in FY)
    const earnedThisFY = invoices
      .filter(inv => {
        const idate = new Date(inv.date);
        return inv.status === 'Paid' && idate >= fyStart && idate <= fyEnd;
      })
      .reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);

    // 2. Pending Payments (Unpaid, Sent invoices not yet overdue)
    const pendingPayments = invoices
      .filter(inv => {
        const idate = new Date(inv.dueDate);
        return inv.status !== 'Paid' && idate >= today;
      })
      .reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);

    // 3. Overdue Now (Sent/unpaid past due date)
    const overdueInvoices = invoices.filter(inv => {
      const idate = new Date(inv.dueDate);
      return inv.status !== 'Paid' && idate < today;
    });
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
    const overdueCount = overdueInvoices.length;

    // 4. Projected Next 30 Days (recurring + milestones next 30 days)
    const next30DaysLimit = new Date(Date.now() + 30 * 86400000);
    
    const milestone30Days = milestoneProjects.reduce((sum, p) => {
      const msAmount = (p.milestones || [])
        .filter(m => {
          if (!m.dueDate) return false;
          const md = new Date(m.dueDate);
          return m.status === 'Pending' && md >= today && md <= next30DaysLimit;
        })
        .reduce((s, m) => s + m.amount, 0);
      return sum + msAmount;
    }, 0);

    const recurring30Days = recurring
      .filter(s => {
        if (!s.isActive || !s.nextDueDate) return false;
        const rd = new Date(s.nextDueDate);
        return rd >= today && rd <= next30DaysLimit;
      })
      .reduce((sum, s) => sum + s.amount, 0);

    const projected30Days = milestone30Days + recurring30Days;

    return { earnedThisFY, pendingPayments, overdueAmount, overdueCount, projected30Days };
  }, [invoices, milestoneProjects, recurring, today]);

  // ---------- ROW 2: Business Vitals ----------
  const vitalsStats = useMemo(() => {
    // 1. Active Clients (Clients with unpaid invoices OR active milestone project)
    const activeClientsCount = clients.filter(c => {
      const hasUnpaidInvoice = invoices.some(inv => inv.clientName === c.name && inv.status !== 'Paid');
      const hasActiveProject = milestoneProjects.some(p => p.clientName === c.name && (p.milestones || []).some(m => m.status === 'Pending'));
      return hasUnpaidInvoice || hasActiveProject;
    }).length;

    // 2. Scope Creep This Month (Count of Pending change requests)
    const scopeCreepCount = changeRequests.filter(cr => cr.status === 'Pending').length;

    // 3. Avg Days to Payment (Avg paidDate - date)
    const paidInvoices = invoices.filter(inv => inv.status === 'Paid' && inv.paidDate);
    let avgDays = 0;
    if (paidInvoices.length > 0) {
      const sumDays = paidInvoices.reduce((sum, inv) => {
        const idate = new Date(inv.date);
        const pdate = new Date(inv.paidDate);
        return sum + Math.max(0, Math.ceil((pdate - idate) / (1000 * 60 * 60 * 24)));
      }, 0);
      avgDays = Math.round(sumDays / paidInvoices.length);
    } else {
      avgDays = 5; // fallback
    }

    // 4. TDS Deducted FY (running total from notes containing TDS or paid invoices)
    const fy = getCurrentFY();
    const fyStart = new Date(fy.start, 3, 1);
    const tdsDeducted = invoices
      .filter(inv => inv.status === 'Paid' && new Date(inv.date) >= fyStart && inv.notes && inv.notes.toLowerCase().includes('tds'))
      .reduce((s, inv) => s + (getInvoiceTotal(inv) * 0.10), 0); // Est 10% TDS

    return { activeClientsCount, scopeCreepCount, avgDays, tdsDeducted };
  }, [invoices, clients, milestoneProjects, changeRequests]);

  // ---------- Revenue Goals Progress ----------
  const revenueGoals = useMemo(() => {
    const goals = state.revenueGoals || state.settings?.revenueGoals || { monthly: 150000, quarterly: 450000, annual: 1800000 };
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const fy = getCurrentFY();

    // This month
    const monthRevenue = invoices
      .filter(inv => {
        const d = new Date(inv.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((s, inv) => s + getInvoiceTotal(inv), 0);

    // Quarter
    let qStart, qEnd;
    if (currentMonth >= 3 && currentMonth <= 5) {
      qStart = new Date(currentYear, 3, 1); qEnd = new Date(currentYear, 5, 30);
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      qStart = new Date(currentYear, 6, 1); qEnd = new Date(currentYear, 8, 30);
    } else if (currentMonth >= 9 && currentMonth <= 11) {
      qStart = new Date(currentYear, 9, 1); qEnd = new Date(currentYear, 11, 31);
    } else {
      qStart = new Date(currentYear, 0, 1); qEnd = new Date(currentYear, 2, 31);
    }
    const quarterRevenue = invoices
      .filter(inv => { const d = new Date(inv.date); return d >= qStart && d <= qEnd; })
      .reduce((s, inv) => s + getInvoiceTotal(inv), 0);

    // FY
    const fyStart = new Date(fy.start, 3, 1);
    const fyEnd = new Date(fy.end, 2, 31);
    const fyRevenue = invoices
      .filter(inv => { const d = new Date(inv.date); return d >= fyStart && d <= fyEnd; })
      .reduce((s, inv) => s + getInvoiceTotal(inv), 0);

    // Active project remaining value (Pipeline)
    const pipelineValue = milestoneProjects.reduce((sum, p) => {
      const remaining = (p.milestones || [])
        .filter(m => m.status === 'Completed' || m.status === 'Pending')
        .reduce((s, m) => s + m.amount, 0);
      return sum + remaining;
    }, 0);

    return {
      month: { earned: monthRevenue, target: goals.monthly, pct: goals.monthly > 0 ? Math.round((monthRevenue / goals.monthly) * 100) : 0 },
      quarter: { earned: quarterRevenue, target: goals.quarterly, pct: goals.quarterly > 0 ? Math.round((quarterRevenue / goals.quarterly) * 100) : 0 },
      fy: { earned: fyRevenue, target: goals.annual, pct: goals.annual > 0 ? Math.round((fyRevenue / goals.annual) * 100) : 0, label: fy.label },
      pipeline: { earned: pipelineValue },
    };
  }, [invoices, state.settings, milestoneProjects]);

  // ---------- Business Health Score (Dashboard Widget) ----------
  const healthScore = useMemo(() => {
    // 1. Collection Rate
    const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
    const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
    const colRate = totalInvoiced > 0 ? totalPaid / totalInvoiced : 1.0;
    const colPoints = Math.round(colRate * 30); // max 30

    // 2. Invoice Turnaround
    const turnaroundPoints = 20; // healthy baseline max 20

    // 3. Client Concentration
    const clientSums = {};
    invoices.forEach(inv => {
      clientSums[inv.clientName] = (clientSums[inv.clientName] || 0) + inv.total;
    });
    let highestAmount = 0;
    Object.values(clientSums).forEach(amt => {
      if (amt > highestAmount) highestAmount = amt;
    });
    const concPct = totalInvoiced > 0 ? highestAmount / totalInvoiced : 0;
    let concPoints = 20; // max 20
    if (concPct > 0.5) concPoints = 8;
    else if (concPct > 0.3) concPoints = 14;

    // 4. Overdue Ratio
    const outstanding = invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);
    const overdue = invoices.filter(i => i.status !== 'Paid' && new Date(i.dueDate) < today).reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);
    const overdueRatio = outstanding > 0 ? overdue / outstanding : 0;
    const overduePoints = Math.round((1 - overdueRatio) * 30); // max 30

    const score = colPoints + turnaroundPoints + concPoints + overduePoints;

    // Recommendations based on low parameters
    const tips = [];
    if (overdueRatio > 0.1) {
      tips.push(`Overdues represent ${Math.round(overdueRatio*100)}% of pending cash. Send firm alerts.`);
    }
    if (concPct > 0.4) {
      tips.push('Highest client accounts for >40% of revenue. Focus on source outreach.');
    }
    if (colRate < 0.9) {
      tips.push('Collection rate lies below 90%. Use milestone invoice generators.');
    }
    if (tips.length === 0) {
      tips.push('All vitals look solid. Keep up the consistent billing hygiene!');
    }

    return { score, tips };
  }, [invoices, today]);

  // SVG parameters for circle progress
  const circleRadius = 24;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (healthScore.score / 100) * circumference;

  const scoreColor = useMemo(() => {
    if (healthScore.score >= 75) return '#10B981'; // Green
    if (healthScore.score >= 50) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  }, [healthScore.score]);

  // ---------- Composed Cash Flow Chart Data ----------
  const composedChartData = useMemo(() => {
    const data = [];
    const now = new Date();
    
    // Past 3 months actual
    for (let i = 3; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short' });
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      
      const actual = invoices
        .filter(inv => {
          const idate = new Date(inv.date);
          return inv.status === 'Paid' && idate.getMonth() === monthIndex && idate.getFullYear() === year;
        })
        .reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
        
      data.push({
        name: monthLabel,
        actual,
        projected: null,
      });
    }

    // Current month (blend of actual + projected)
    const currentMonthLabel = now.toLocaleDateString('en-IN', { month: 'short' });
    const curActual = invoices
      .filter(inv => {
        const idate = new Date(inv.date);
        return inv.status === 'Paid' && idate.getMonth() === now.getMonth() && idate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);

    data.push({
      name: currentMonthLabel,
      actual: curActual,
      projected: curActual,
    });

    // Next 3 months projected
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short' });
      const monthIndex = d.getMonth();
      const year = d.getFullYear();

      // Projected recurring
      const recProj = recurring
        .filter(s => s.isActive)
        .reduce((sum, s) => sum + s.amount, 0);

      // Projected milestones due in this month
      const milestoneProj = milestoneProjects
        .reduce((sum, p) => {
          const msAmount = (p.milestones || [])
            .filter(m => {
              if (!m.dueDate) return false;
              const md = new Date(m.dueDate);
              return m.status === 'Pending' && md.getMonth() === monthIndex && md.getFullYear() === year;
            })
            .reduce((s, m) => s + m.amount, 0);
          return sum + msAmount;
        }, 0);

      data.push({
        name: monthLabel,
        actual: null,
        projected: recProj + milestoneProj,
      });
    }

    return data;
  }, [invoices, recurring, milestoneProjects]);

  // ---------- Advance Tax Countdown Widget calculations ----------
  const advanceTaxInfo = useMemo(() => {
    const fy = getCurrentFY();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Installment dates for the current FY
    const installments = [
      { label: "1st Installment", dateStr: `${fy.start}-06-15`, pct: 15, qLabel: "Q1" },
      { label: "2nd Installment", dateStr: `${fy.start}-09-15`, pct: 45, qLabel: "Q2" },
      { label: "3rd Installment", dateStr: `${fy.start}-12-15`, pct: 75, qLabel: "Q3" },
      { label: "4th Installment", dateStr: `${fy.end}-03-15`, pct: 100, qLabel: "Q4" },
    ];

    // Find the next upcoming installment date
    let upcoming = installments.find(inst => new Date(inst.dateStr) >= today);
    if (!upcoming) {
      upcoming = installments[3]; // default/fallback to last installment
    }

    // totalFYIncome = sum of paid invoices in the current FY
    const fyStart = new Date(fy.start, 3, 1);
    const fyEnd = new Date(fy.end, 2, 31);
    const paidInvoices = invoices.filter(inv => {
      const idate = new Date(inv.date);
      return inv.status === 'Paid' && idate >= fyStart && idate <= fyEnd;
    });
    
    const totalFYIncome = paidInvoices.reduce((sum, inv) => {
      const subtotal = (inv.lineItems || []).reduce((s, item) => s + item.quantity * item.rate, 0);
      return sum + subtotal;
    }, 0);

    // alreadyPaid = sum of TDS logged in paid invoices notes or in state.tdsEntries or expenses
    const tdsTotal = (state.tdsEntries || []).reduce((s, e) => s + e.amount, 0);
    const taxExpenses = (state.expenses || [])
      .filter(e => e.category === 'Tax' || e.category === 'Advance Tax' || e.description.toLowerCase().includes('advance tax'))
      .reduce((s, e) => s + e.amount, 0);
      
    const estimatedTds = invoices
      .filter(inv => inv.status === 'Paid' && new Date(inv.date) >= fyStart && inv.notes && inv.notes.toLowerCase().includes('tds'))
      .reduce((s, inv) => s + (getInvoiceTotal(inv) * 0.10), 0);
      
    const alreadyPaid = Math.max(tdsTotal + taxExpenses, estimatedTds);

    // Calculate due amount: (totalFYIncome * 0.3 * pct / 100) - alreadyPaid
    const liability = totalFYIncome * 0.3; // 30% of total FY Income
    const installmentDue = liability * (upcoming.pct / 100);
    const dueAmount = Math.max(0, Math.round(installmentDue - alreadyPaid));

    const diffTime = new Date(upcoming.dateStr) - today;
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // WhatsApp Link message
    const waMessage = `Hi, my advance tax calculation for ${upcoming.qLabel}: Total FY income so far ${formatINR(totalFYIncome)}, estimated liability ${formatINR(dueAmount)}. Please confirm the installment amount.`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

    return {
      ...upcoming,
      totalFYIncome,
      liability,
      alreadyPaid,
      dueAmount,
      daysRemaining,
      waUrl
    };
  }, [invoices, state.expenses, state.tdsEntries]);

  // ---------- Quick Actions ----------
  const quickActions = [
    { label: 'New Invoice', path: '/invoice', icon: Receipt, gradient: 'from-orange-500 to-amber-500' },
    { label: 'Scope Guard', path: '/scope-creep', icon: ShieldAlert, gradient: 'from-red-500 to-orange-500' },
    { label: 'Track Time', path: '/time-tracker', icon: Timer, gradient: 'from-purple-500 to-pink-500' },
    { label: 'Log Expense', path: '/expenses', icon: Wallet, gradient: 'from-green-500 to-emerald-500' },
  ];

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-dark-600/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            Dashboard
            <Sparkles className="w-6 h-6 text-accent opacity-80" />
          </h1>
          <p className="text-dark-400 mt-1">
            {getGreeting()},{' '}
            <span className="text-dark-200 font-semibold">
              {state.settings?.yourName || 'Freelancer'}
            </span>{' '}
            — here's your business vitals dashboard.
          </p>
        </div>
        <p className="text-xs text-dark-400 font-medium">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* ROW 1 — Money Health (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={IndianRupee}
          label="Total Earned This FY"
          value={formatINR(moneyStats.earnedThisFY)}
          color="green"
          subValue="FY paid invoices"
        />
        <div onClick={() => navigate('/invoice-history')} className="cursor-pointer">
          <StatCard
            icon={Clock}
            label="Pending Payments"
            value={formatINR(moneyStats.pendingPayments)}
            color="blue"
            subValue="Awaiting payment"
          />
        </div>
        <div onClick={() => navigate('/aging')} className="cursor-pointer">
          <div className="relative">
            {moneyStats.overdueCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse z-20">
                {moneyStats.overdueCount}
              </span>
            )}
            <StatCard
              icon={AlertTriangle}
              label="Overdue Now"
              value={formatINR(moneyStats.overdueAmount)}
              color="red"
              subValue={`${moneyStats.overdueCount} past due dates`}
            />
          </div>
        </div>
        <StatCard
          icon={TrendingUp}
          label="Projected Next 30 Days"
          value={formatINR(moneyStats.projected30Days)}
          color="teal"
          subValue="Expected income"
        />
      </div>

      {/* ROW 2 — Business Vitals (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Active Clients"
          value={vitalsStats.activeClientsCount}
          color="blue"
          subValue="Active invoice/projects"
        />
        <div onClick={() => navigate('/scope-creep')} className="cursor-pointer">
          <StatCard
            icon={ShieldAlert}
            label="Scope Creep Awaiting"
            value={vitalsStats.scopeCreepCount}
            color={vitalsStats.scopeCreepCount > 0 ? 'red' : 'gray'}
            subValue="Pending change approvals"
          />
        </div>
        <StatCard
          icon={Timer}
          label="Avg Days to Payment"
          value={`${vitalsStats.avgDays} days`}
          color="purple"
          subValue="Invoice collection avg"
        />
        <StatCard
          icon={Calculator}
          label="TDS Deducted FY"
          value={formatINR(vitalsStats.tdsDeducted)}
          color="teal"
          subValue="Total withheld taxes"
        />
      </div>

      {/* Main Grid: Revenue Goals & Circular Score Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Revenue Goals progress bar */}
        <div className="glass-card p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold text-dark-100">Revenue Goals & Forecast</h2>
            </div>
            <Link to="/goals" className="text-xs text-accent hover:text-amber-400 font-bold transition-colors">
              Goal Settings →
            </Link>
          </div>

          <div className="space-y-3.5 font-sans">
            {/* Monthly */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-dark-300">Month Goal: {formatINR(revenueGoals.month.target)}</span>
                <span className="text-dark-100">
                  {revenueGoals.month.earned >= revenueGoals.month.target 
                    ? `🎉 Target Crushed! (+${formatINR(revenueGoals.month.earned - revenueGoals.month.target)})`
                    : `Remaining: ${formatINR(revenueGoals.month.target - revenueGoals.month.earned)}`}
                </span>
              </div>
              <div className="relative w-full h-3.5 rounded-full bg-dark-700 overflow-hidden border border-dark-600/30">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${revenueGoals.month.pct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-accent to-amber-400'}`}
                  style={{ width: `${Math.min(revenueGoals.month.pct, 100)}%` }}
                />
              </div>
            </div>

            {/* Quarterly */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-dark-300">Quarterly Goal: {formatINR(revenueGoals.quarter.target)}</span>
                <span className="text-dark-100">
                  {revenueGoals.quarter.earned >= revenueGoals.quarter.target 
                    ? `🎉 (+${formatINR(revenueGoals.quarter.earned - revenueGoals.quarter.target)})`
                    : `Remaining: ${formatINR(revenueGoals.quarter.target - revenueGoals.quarter.earned)}`}
                </span>
              </div>
              <div className="relative w-full h-3.5 rounded-full bg-dark-700 overflow-hidden border border-dark-600/30">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${revenueGoals.quarter.pct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-accent to-amber-400'}`}
                  style={{ width: `${Math.min(revenueGoals.quarter.pct, 100)}%` }}
                />
              </div>
            </div>

            {/* FY */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-dark-300">{revenueGoals.fy.label} Goal: {formatINR(revenueGoals.fy.target)}</span>
                <span className="text-dark-100">
                  {revenueGoals.fy.earned >= revenueGoals.fy.target 
                    ? `🎉 (+${formatINR(revenueGoals.fy.earned - revenueGoals.fy.target)})`
                    : `Remaining: ${formatINR(revenueGoals.fy.target - revenueGoals.fy.earned)}`}
                </span>
              </div>
              <div className="relative w-full h-3.5 rounded-full bg-dark-700 overflow-hidden border border-dark-600/30">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${revenueGoals.fy.pct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-accent to-amber-400'}`}
                  style={{ width: `${Math.min(revenueGoals.fy.pct, 100)}%` }}
                />
              </div>
            </div>

            {/* Pipeline Row 4 */}
            <div className="pt-2 border-t border-dark-600/20">
              <div className="flex justify-between text-xs font-semibold text-dark-300">
                <span>Active Project Pipeline Remaining (Unbilled Scope)</span>
                <span className="text-accent font-extrabold">{formatINR(revenueGoals.pipeline.earned)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Vitals Score & Advance Tax Widget */}
        <div className="flex flex-col gap-4 h-full">
          {/* Circular Business Health score ring widget */}
          <div onClick={() => navigate('/health')} className="glass-card p-5 hover:border-accent/20 cursor-pointer transition-all flex flex-col justify-between flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-dark-200 uppercase tracking-wider">Business Vitals Health</span>
              <ChevronRight className="w-4 h-4 text-dark-400" />
            </div>

            <div className="flex items-center gap-4 py-2">
              <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r={circleRadius} stroke="#262626" strokeWidth={strokeWidth} fill="transparent" />
                  <circle
                    cx="32" cy="32" r={circleRadius} stroke={scoreColor} strokeWidth={strokeWidth} fill="transparent"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute font-black text-sm text-dark-50">{healthScore.score}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-dark-100">Operational Health Index</p>
                <p className="text-[10px] text-dark-400 mt-0.5">Calculated from 4 critical operational vitals.</p>
              </div>
            </div>

            <div className="border-t border-dark-600/30 pt-3 space-y-1.5">
              <span className="text-[9px] uppercase tracking-wider text-dark-400 font-bold">Top Improvement Tip</span>
              <p className="text-[11px] text-accent leading-snug font-medium">
                💡 {healthScore.tips[0]}
              </p>
            </div>
          </div>

          {/* Advance Tax Countdown Widget */}
          <div className="glass-card p-5 flex flex-col justify-between hover:border-accent/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-dark-200 uppercase tracking-wider">Advance Tax Alert</span>
              <Calendar className="w-4 h-4 text-accent" />
            </div>

            <div className="py-1">
              <p className="text-lg font-black text-dark-50">
                {formatINR(advanceTaxInfo.dueAmount)} due in {advanceTaxInfo.daysRemaining} days
              </p>
              <p className="text-xs text-dark-300 mt-1">
                {advanceTaxInfo.label} — {new Date(advanceTaxInfo.dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>

            <div className="border-t border-dark-600/30 pt-3 flex items-center justify-between gap-2">
              <div className="text-[10px] text-dark-400">
                FY Income: <span className="text-dark-200 font-semibold">{formatINR(advanceTaxInfo.totalFYIncome)}</span>
              </div>
              <a
                href={advanceTaxInfo.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/20 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Share with CA
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Composed Cash Flow Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="text-sm font-semibold text-dark-100">Composed Cash Flow Forecast (Actuals & Projections)</h2>
          </div>
          <span className="text-xs text-dark-400 font-medium">Past 3M vs Next 3M</span>
        </div>

        <div className="h-64 w-full font-sans">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={composedChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="actualAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="projAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 11 }} />
              <YAxis
                axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 11 }}
                tickFormatter={(v) => `₹${v/1000}k`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', borderRadius: '8px' }}
                labelStyle={{ color: '#FAFAFA', fontWeight: 'bold' }}
                formatter={(value, name) => [formatINR(value), name === 'actual' ? 'Actual Cash Inflow' : 'Projected Inflow']}
              />
              <ReferenceLine y={0} stroke="#404040" />
              {/* Actuals Line + Area */}
              <Area type="monotone" dataKey="actual" fill="url(#actualAreaGrad)" stroke="none" />
              <Line type="monotone" dataKey="actual" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 4, stroke: '#0D9488', fill: '#0F0F0F' }} name="actual" />
              
              {/* Projected Line + Area */}
              <Area type="monotone" dataKey="projected" fill="url(#projAreaGrad)" stroke="none" />
              <Line type="monotone" dataKey="projected" stroke="#D97706" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4, stroke: '#D97706', fill: '#0F0F0F' }} name="projected" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-column Activity & Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-dark-100 mb-4 flex items-center gap-2 border-b border-dark-600/20 pb-2.5">
            <Zap className="w-4 h-4 text-accent" />
            Recent Activity
          </h2>
          <div className="space-y-1">
            {(state.activities || []).slice(0, 6).map((act) => {
              const IconComp = resolveIcon(act.icon);
              return (
                <div key={act.id} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.02] transition-colors group">
                  <div className="mt-1.5 w-6 h-6 rounded bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                    <IconComp className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <p className="text-xs text-dark-200 leading-snug truncate">{act.message}</p>
                    <p className="text-[10px] text-dark-500 mt-0.5">{getRelativeTime(act.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-dark-100 mb-4 flex items-center gap-2 border-b border-dark-600/20 pb-2.5">
            <CalendarClock className="w-4 h-4 text-accent" />
            Upcoming Deliverable Targets
          </h2>
          <div className="space-y-1">
            {state.milestoneProjects?.flatMap(p => 
              (p.milestones || [])
                .filter(m => m.status === 'Pending' && m.dueDate)
                .map(m => {
                  const diff = Math.ceil((new Date(m.dueDate) - today) / 86400000);
                  return { ...m, projectName: p.name, clientName: p.clientName, daysLeft: diff };
                })
            )
            .sort((a,b) => a.daysLeft - b.daysLeft)
            .slice(0, 6)
            .map(item => {
              const urgencyColor = item.daysLeft <= 3 
                ? 'text-red-400 bg-red-500/10 border-red-500/20' 
                : item.daysLeft <= 7 
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                  : 'text-blue-400 bg-blue-500/10 border-blue-500/20';

              return (
                <div key={item.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-dark-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-dark-500 mt-0.5">{item.clientName} • {item.projectName}</p>
                  </div>
                  <span className={`shrink-0 ml-3 text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgencyColor}`}>
                    {item.daysLeft === 0 ? 'Today' : item.daysLeft === 1 ? 'Tomorrow' : `${item.daysLeft}d left`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((qa) => (
          <Link
            key={qa.path}
            to={qa.path}
            className="group glass-card p-4 flex items-center gap-3 hover:border-accent/30 transition-all duration-300 hover:-translate-y-0.5"
          >
            <div
              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${qa.gradient} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}
            >
              <qa.icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-100 group-hover:text-white transition-colors truncate">
                {qa.label}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-dark-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
