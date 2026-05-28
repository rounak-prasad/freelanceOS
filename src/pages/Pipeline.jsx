// ==========================================
// FreelanceOS — Cash Flow Pipeline Page
// ==========================================
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR, formatDate, generateId } from '../utils/helpers';
import {
  Workflow, ChevronRight, TrendingUp, AlertTriangle,
  MessageCircle, Sparkles, Sliders, Calendar, ArrowRight
} from 'lucide-react';

export default function Pipeline() {
  const { state, addToast } = useData();
  
  // What-If Scenario State
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfValue, setWhatIfValue] = useState('150000');
  const [whatIfProb, setWhatIfProb] = useState(70); // probability percentage
  const [whatIfTargetCol, setWhatIfTargetCol] = useState('1'); // Column target: 1 = This Month, 2 = Next Month, 3 = In 60-90 Days

  const invoices = state.invoices || [];
  const recurring = state.recurringSchedules || [];
  const milestones = state.milestoneProjects || [];
  const quarterlyGoal = state.revenueGoals?.quarterly || state.settings?.revenueGoals?.quarterly || 450000;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  function getDaysFromToday(dateStr) {
    if (!dateStr) return 15; // default center
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    const diffTime = d - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Aggregate expected income cards
  const pipelineCards = useMemo(() => {
    const cards = [];

    // 1. Unpaid/Sent Invoices
    invoices.forEach(inv => {
      if (inv.status !== 'Paid') {
        const outstanding = inv.total - (inv.amountPaid || 0);
        if (outstanding > 0) {
          const days = getDaysFromToday(inv.dueDate);
          cards.push({
            id: `inv-${inv.id}`,
            clientName: inv.clientName,
            title: `Invoice ${inv.invoiceNumber}`,
            amount: outstanding,
            dueDate: inv.dueDate,
            daysDue: days,
            type: 'Invoice',
            typeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
          });
        }
      }
    });

    // 2. Completed but Uninvoiced Milestones
    milestones.forEach(project => {
      (project.milestones || []).forEach(ms => {
        if (ms.status === 'Completed') {
          const days = getDaysFromToday(ms.dueDate);
          cards.push({
            id: `ms-${ms.id}`,
            clientName: project.clientName,
            title: `Milestone: ${ms.name}`,
            amount: ms.amount,
            dueDate: ms.dueDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
            daysDue: days,
            type: 'Milestone',
            typeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          });
        }
      });
    });

    // 3. Projected Recurring Schedules (look ahead up to 90 days)
    recurring.forEach(s => {
      if (s.isActive && s.nextDueDate) {
        let currentDueDate = new Date(s.nextDueDate);
        
        // Loop and project up to 3 cycles (monthly is 3 months, weekly is up to 12)
        // For simplicity, we project the next 3 occurrences max to prevent card clutter
        for (let i = 0; i < 3; i++) {
          const dateStr = currentDueDate.toISOString().split('T')[0];
          const days = getDaysFromToday(dateStr);
          
          if (days <= 90) {
            cards.push({
              id: `rec-${s.id}-${i}`,
              clientName: s.clientName,
              title: s.description,
              amount: s.amount,
              dueDate: dateStr,
              daysDue: days,
              type: 'Recurring',
              typeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            });
          }

          // Advance date for next iteration
          if (s.frequency === 'weekly') {
            currentDueDate.setDate(currentDueDate.getDate() + 7);
          } else if (s.frequency === 'biweekly') {
            currentDueDate.setDate(currentDueDate.getDate() + 14);
          } else {
            currentDueDate.setMonth(currentDueDate.getMonth() + 1);
          }
        }
      }
    });

    return cards;
  }, [invoices, recurring, milestones, today]);

  // Distribute cards into Kanban columns
  const column1 = useMemo(() => {
    // Column 1: This Month (0 - 30 days, or already overdue)
    return pipelineCards.filter(c => c.daysDue <= 30);
  }, [pipelineCards]);

  const column2 = useMemo(() => {
    // Column 2: Next Month (31 - 60 days)
    return pipelineCards.filter(c => c.daysDue >= 31 && c.daysDue <= 60);
  }, [pipelineCards]);

  const column3 = useMemo(() => {
    // Column 3: In 60 - 90 Days (61 - 90 days)
    return pipelineCards.filter(c => c.daysDue >= 61 && c.daysDue <= 90);
  }, [pipelineCards]);

  // Aggregate totals
  const col1Total = useMemo(() => column1.reduce((s, c) => s + c.amount, 0), [column1]);
  const col2Total = useMemo(() => column2.reduce((s, c) => s + c.amount, 0), [column2]);
  const col3Total = useMemo(() => column3.reduce((s, c) => s + c.amount, 0), [column3]);

  // Add the "What-If" ghost card expected value
  const whatIfValNum = Number(whatIfValue) || 0;
  const whatIfExpected = Math.round(whatIfValNum * (whatIfProb / 100));

  const col1TotalWithGhost = col1Total + (whatIfOpen && whatIfTargetCol === '1' ? whatIfExpected : 0);
  const col2TotalWithGhost = col2Total + (whatIfOpen && whatIfTargetCol === '2' ? whatIfExpected : 0);
  const col3TotalWithGhost = col3Total + (whatIfOpen && whatIfTargetCol === '3' ? whatIfExpected : 0);

  const grand90DayTotal = col1TotalWithGhost + col2TotalWithGhost + col3TotalWithGhost;
  const goalProgressPct = Math.min(100, Math.round((grand90DayTotal / quarterlyGoal) * 100));

  // Overdue Invoices Urgency list (Sorted by Amount * Age impact score)
  const overdueUrgencyList = useMemo(() => {
    const list = [];
    invoices.forEach(inv => {
      if (inv.status !== 'Paid') {
        const outstanding = inv.total - (inv.amountPaid || 0);
        if (outstanding > 0) {
          const daysOverdue = getDaysFromToday(inv.dueDate);
          // If daysOverdue is negative, it means it is overdue
          if (daysOverdue < 0) {
            const age = Math.abs(daysOverdue);
            list.push({
              ...inv,
              outstanding,
              age,
              impactScore: outstanding * age
            });
          }
        }
      }
    });
    return list.sort((a, b) => b.impactScore - a.impactScore);
  }, [invoices, today]);

  function triggerWhatsAppUrgent(inv) {
    const message = `Hi ${inv.clientName}, hope you are doing well. Just dropping a friendly reminder regarding Invoice ${inv.invoiceNumber} for ${formatINR(inv.outstanding)}, which is currently overdue by ${inv.age} days. Could you kindly look into this and let me know when payment is expected? Thank you.`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <Workflow className="w-6 h-6 text-accent" />
          Cash Flow Pipeline
        </h1>
        <p className="text-sm text-dark-300 mt-0.5">See exactly what money is coming in — and when.</p>
      </div>

      {/* Grand Total Bar */}
      <div className="glass-card p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs text-dark-300 font-semibold uppercase tracking-wider">Projected Next 90 Days</p>
            <h2 className="text-3xl font-extrabold text-gradient mt-1">{formatINR(grand90DayTotal)}</h2>
            <p className="text-xs text-dark-400 mt-1">
              Quarterly Goal: <span className="font-semibold text-dark-200">{formatINR(quarterlyGoal)}</span>
            </p>
          </div>
          
          <div className="flex-1 max-w-md w-full">
            <div className="flex justify-between text-xs text-dark-300 mb-1.5 font-medium">
              <span>Goal Progress</span>
              <span>{goalProgressPct}% achieved</span>
            </div>
            <div className="w-full h-3 rounded-full bg-dark-700 overflow-hidden relative border border-dark-600/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-500 transition-all duration-500"
                style={{ width: `${goalProgressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* "What If" Collapsible Scenario Panel */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setWhatIfOpen(!whatIfOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-sm font-semibold text-dark-100 hover:bg-dark-700/20 transition-colors focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent" />
            <span>Interactive "What-If" Pipeline Planner</span>
          </div>
          <span className="text-xs text-accent font-bold hover:underline">
            {whatIfOpen ? 'Collapse Scenario' : 'Enable Projection Scenario'}
          </span>
        </button>

        {whatIfOpen && (
          <div className="p-5 border-t border-dark-600/30 bg-[#141414]/30 space-y-4 animate-fade-in font-sans">
            <p className="text-xs text-dark-300 leading-relaxed">
              Simulate potential project wins to project pipeline cash flow at custom probabilities. This injects a "Ghost Card" into your Kanban board below.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="input-label">Project Value (₹)</label>
                <input
                  type="number"
                  value={whatIfValue}
                  onChange={(e) => setWhatIfValue(e.target.value)}
                  className="w-full bg-dark-900 border-dark-600"
                />
              </div>

              <div>
                <label className="input-label">Win Probability: {whatIfProb}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={whatIfProb}
                  onChange={(e) => setWhatIfProb(Number(e.target.value))}
                  className="w-full mt-2 accent-accent cursor-pointer"
                />
              </div>

              <div>
                <label className="input-label">Target Period</label>
                <div className="relative">
                  <select
                    value={whatIfTargetCol}
                    onChange={(e) => setWhatIfTargetCol(e.target.value)}
                    className="w-full appearance-none bg-dark-900 border-dark-600"
                  >
                    <option value="1">This Month (0-30 days)</option>
                    <option value="2">Next Month (31-60 days)</option>
                    <option value="3">In 60-90 Days (61-90 days)</option>
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 rotate-90 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="p-3 bg-accent/5 border border-accent/15 rounded-lg flex items-center justify-between text-xs">
              <span className="text-dark-200">Expected Value Added:</span>
              <span className="font-extrabold text-accent text-sm">+{formatINR(whatIfExpected)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3-Column Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Column 1 */}
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-center bg-dark-800 border border-dark-600/40 p-3 rounded-lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-dark-100">This Month (0-30d)</span>
            <span className="font-bold text-sm text-dark-50">{formatINR(col1TotalWithGhost)}</span>
          </div>
          <div className="flex-1 space-y-3 max-h-[500px] overflow-y-auto custom-scroll pr-1">
            {whatIfOpen && whatIfTargetCol === '1' && (
              <div className="glass-card p-4 border border-dashed border-accent/50 bg-accent/5 shadow-lg shadow-accent/5">
                <div className="flex justify-between text-xs text-accent font-bold mb-2">
                  <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 animate-spin" /> Ghost Deal</span>
                  <span>{whatIfProb}% Win Chance</span>
                </div>
                <h4 className="text-xs font-bold text-dark-50">Simulation Win Target</h4>
                <div className="flex justify-between items-end mt-4">
                  <span className="text-[10px] text-dark-400">Total Value: {formatINR(whatIfValNum)}</span>
                  <span className="text-sm font-bold text-accent">{formatINR(whatIfExpected)}</span>
                </div>
              </div>
            )}
            
            {column1.length === 0 && (!whatIfOpen || whatIfTargetCol !== '1') ? (
              <div className="text-center py-8 text-xs text-dark-400 italic">No expected income this month</div>
            ) : (
              column1.map(card => (
                <div key={card.id} className="glass-card p-4 hover:border-dark-400/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`badge border text-[10px] px-2 py-0.5 ${card.typeClass}`}>
                      {card.type}
                    </span>
                    <span className={`text-[10px] whitespace-nowrap font-medium ${card.daysDue < 0 ? 'text-red-400 font-semibold' : 'text-dark-300'}`}>
                      {card.daysDue < 0 ? `${Math.abs(card.daysDue)}d overdue` : `Due in ${card.daysDue}d`}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-dark-100 line-clamp-1">{card.title}</h4>
                  <p className="text-[11px] text-dark-300 mt-1">{card.clientName}</p>
                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-dark-600/20">
                    <span className="text-[10px] text-dark-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-dark-400" />
                      {new Date(card.dueDate).toLocaleDateString('en-IN')}
                    </span>
                    <span className="text-sm font-bold text-dark-50">{formatINR(card.amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2 */}
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-center bg-dark-800 border border-dark-600/40 p-3 rounded-lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-dark-100">Next Month (31-60d)</span>
            <span className="font-bold text-sm text-dark-50">{formatINR(col2TotalWithGhost)}</span>
          </div>
          <div className="flex-1 space-y-3 max-h-[500px] overflow-y-auto custom-scroll pr-1">
            {whatIfOpen && whatIfTargetCol === '2' && (
              <div className="glass-card p-4 border border-dashed border-accent/50 bg-accent/5 shadow-lg shadow-accent/5">
                <div className="flex justify-between text-xs text-accent font-bold mb-2">
                  <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 animate-spin" /> Ghost Deal</span>
                  <span>{whatIfProb}% Win Chance</span>
                </div>
                <h4 className="text-xs font-bold text-dark-50">Simulation Win Target</h4>
                <div className="flex justify-between items-end mt-4">
                  <span className="text-[10px] text-dark-400">Total Value: {formatINR(whatIfValNum)}</span>
                  <span className="text-sm font-bold text-accent">{formatINR(whatIfExpected)}</span>
                </div>
              </div>
            )}
            
            {column2.length === 0 && (!whatIfOpen || whatIfTargetCol !== '2') ? (
              <div className="text-center py-8 text-xs text-dark-400 italic">No expected income next month</div>
            ) : (
              column2.map(card => (
                <div key={card.id} className="glass-card p-4 hover:border-dark-400/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`badge border text-[10px] px-2 py-0.5 ${card.typeClass}`}>
                      {card.type}
                    </span>
                    <span className="text-[10px] text-dark-300 whitespace-nowrap font-medium">
                      Due in {card.daysDue}d
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-dark-100 line-clamp-1">{card.title}</h4>
                  <p className="text-[11px] text-dark-300 mt-1">{card.clientName}</p>
                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-dark-600/20">
                    <span className="text-[10px] text-dark-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-dark-400" />
                      {new Date(card.dueDate).toLocaleDateString('en-IN')}
                    </span>
                    <span className="text-sm font-bold text-dark-50">{formatINR(card.amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3 */}
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-center bg-dark-800 border border-dark-600/40 p-3 rounded-lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-dark-100">In 60-90 Days (61-90d)</span>
            <span className="font-bold text-sm text-dark-50">{formatINR(col3TotalWithGhost)}</span>
          </div>
          <div className="flex-1 space-y-3 max-h-[500px] overflow-y-auto custom-scroll pr-1">
            {whatIfOpen && whatIfTargetCol === '3' && (
              <div className="glass-card p-4 border border-dashed border-accent/50 bg-accent/5 shadow-lg shadow-accent/5">
                <div className="flex justify-between text-xs text-accent font-bold mb-2">
                  <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 animate-spin" /> Ghost Deal</span>
                  <span>{whatIfProb}% Win Chance</span>
                </div>
                <h4 className="text-xs font-bold text-dark-50">Simulation Win Target</h4>
                <div className="flex justify-between items-end mt-4">
                  <span className="text-[10px] text-dark-400">Total Value: {formatINR(whatIfValNum)}</span>
                  <span className="text-sm font-bold text-accent">{formatINR(whatIfExpected)}</span>
                </div>
              </div>
            )}
            
            {column3.length === 0 && (!whatIfOpen || whatIfTargetCol !== '3') ? (
              <div className="text-center py-8 text-xs text-dark-400 italic">No expected income in 60-90 days</div>
            ) : (
              column3.map(card => (
                <div key={card.id} className="glass-card p-4 hover:border-dark-400/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`badge border text-[10px] px-2 py-0.5 ${card.typeClass}`}>
                      {card.type}
                    </span>
                    <span className="text-[10px] text-dark-300 whitespace-nowrap font-medium">
                      Due in {card.daysDue}d
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-dark-100 line-clamp-1">{card.title}</h4>
                  <p className="text-[11px] text-dark-300 mt-1">{card.clientName}</p>
                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-dark-600/20">
                    <span className="text-[10px] text-dark-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-dark-400" />
                      {new Date(card.dueDate).toLocaleDateString('en-IN')}
                    </span>
                    <span className="text-sm font-bold text-dark-50">{formatINR(card.amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Unpaid Invoice Urgency Section */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-600/30 bg-dark-900/10 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-sm font-semibold text-dark-50">High-Impact Collections (Urgency Priority)</h3>
        </div>
        {overdueUrgencyList.length === 0 ? (
          <div className="p-8 text-center text-dark-400 text-xs">
            🎉 Great job! No overdue invoices currently outstanding.
          </div>
        ) : (
          <div className="overflow-x-auto font-sans">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600/20 text-xs">
                  <th className="px-4 py-3 text-left table-header">Invoice #</th>
                  <th className="px-4 py-3 text-left table-header">Client Name</th>
                  <th className="px-4 py-3 text-right table-header">Days Overdue</th>
                  <th className="px-4 py-3 text-right table-header">Outstanding Amount</th>
                  <th className="px-4 py-3 text-right table-header">Impact Score</th>
                  <th className="px-4 py-3 text-right table-header">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600/10">
                {overdueUrgencyList.map(inv => (
                  <tr key={inv.id} className="hover:bg-dark-700/20 transition-all text-xs">
                    <td className="px-4 py-3 font-semibold text-dark-50">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-dark-200">{inv.clientName}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-400">{inv.age} days</td>
                    <td className="px-4 py-3 text-right font-semibold text-dark-50">{formatINR(inv.outstanding)}</td>
                    <td className="px-4 py-3 text-right text-dark-400 font-mono">
                      {(inv.impactScore / 1000).toFixed(0)}k pts
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => triggerWhatsAppUrgent(inv)}
                        className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-green-500 shadow-green-500/10 border-none text-white rounded hover:opacity-90 transition-all font-semibold inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Send Reminder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
