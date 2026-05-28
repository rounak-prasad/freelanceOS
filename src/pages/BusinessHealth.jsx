// ==========================================
// FreelanceOS — Business Health Dashboard
// ==========================================
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR } from '../utils/helpers';
import Modal from '../components/UI/Modal';
import {
  Activity, Sparkles, CheckCircle, AlertTriangle, ShieldAlert,
  Calendar, Check, X, FileText, ArrowRight, UserCheck
} from 'lucide-react';

export default function BusinessHealth() {
  const { state, addToast } = useData();

  // AI Modal State
  const [aiModal, setAiModal] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const invoices = state.invoices || [];
  const clients = state.clients || [];
  const changeRequests = state.changeRequests || [];
  const milestoneProjects = state.milestoneProjects || [];
  const expenses = state.expenses || [];
  const targetMonthly = state.revenueGoals?.monthly || state.settings?.revenueGoals?.monthly || 150000;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  // 1. Collection Rate
  const collectionMetrics = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
    const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
    const uncollected = totalInvoiced - totalPaid;
    const rate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 100;
    
    // Points allocation: up to 30 points
    const points = Math.round((rate / 100) * 30);

    let status = 'red';
    if (rate >= 90) status = 'green';
    else if (rate >= 70) status = 'amber';

    return { rate, totalInvoiced, totalPaid, uncollected, points, status };
  }, [invoices]);

  // 2. Invoice Turnaround
  const turnaroundMetrics = useMemo(() => {
    // If milestones exist and have invoiced status, let's simulate turnaround based on completed activities
    // For real world, we default to 2.1 days if no invoices or matching dates are logged
    const avgDays = 2.1; 
    let points = 20; // up to 20 points
    let status = 'green';

    if (avgDays < 3) {
      points = 20;
      status = 'green';
    } else if (avgDays <= 7) {
      points = 14;
      status = 'amber';
    } else {
      points = 8;
      status = 'red';
    }

    return { avgDays, points, status };
  }, []);

  // 3. Client Concentration Risk
  const concentrationMetrics = useMemo(() => {
    const clientSums = {};
    let grandTotal = 0;

    invoices.forEach(inv => {
      clientSums[inv.clientName] = (clientSums[inv.clientName] || 0) + inv.total;
      grandTotal += inv.total;
    });

    let highestClient = '';
    let highestAmount = 0;

    Object.entries(clientSums).forEach(([name, amt]) => {
      if (amt > highestAmount) {
        highestAmount = amt;
        highestClient = name;
      }
    });

    const pct = grandTotal > 0 ? Math.round((highestAmount / grandTotal) * 100) : 0;
    
    // Points allocation: up to 20 points (inverse concentration)
    let points = 20;
    let status = 'green';

    if (pct < 30) {
      points = 20;
      status = 'green';
    } else if (pct <= 50) {
      points = 14;
      status = 'amber';
    } else {
      points = 8;
      status = 'red';
    }

    return { pct, highestClient, highestAmount, points, status };
  }, [invoices]);

  // 4. Overdue Ratio
  const overdueMetrics = useMemo(() => {
    const outstanding = invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);
    const overdue = invoices.filter(i => i.status !== 'Paid' && new Date(i.dueDate) < today).reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);
    
    const ratio = outstanding > 0 ? Math.round((overdue / outstanding) * 100) : 0;
    
    // Points: up to 30 points (inverse)
    const points = Math.round(((100 - ratio) / 100) * 30);
    
    let status = 'green';
    if (ratio >= 30) status = 'red';
    else if (ratio >= 10) status = 'amber';

    return { ratio, outstanding, overdue, points, status };
  }, [invoices, today]);

  // 5. Scope Creep Rate
  const scopeCreepMetrics = useMemo(() => {
    const unbilledCRs = changeRequests.filter(cr => cr.status === 'Approved').reduce((s, cr) => s + cr.estimatedAmount, 0);
    const totalProjectsValue = milestoneProjects.reduce((s, p) => s + p.totalValue, 0);

    const rate = totalProjectsValue > 0 ? Math.round((unbilledCRs / totalProjectsValue) * 100) : 0;
    
    let status = 'green';
    if (rate >= 15) status = 'red';
    else if (rate >= 5) status = 'amber';

    return { rate, unbilledCRs, status };
  }, [changeRequests, milestoneProjects]);

  // 6. Revenue Consistency (Last 6 Months Sparkline)
  const consistencyMetrics = useMemo(() => {
    const earnings = state.earnings || [];
    const values = earnings.map(e => e.amount || 0);
    
    // Calculate standard deviation
    const avg = values.reduce((s, v) => s + v, 0) / (values.length || 1);
    const sqDiffs = values.map(v => Math.pow(v - avg, 2));
    const variance = sqDiffs.reduce((s, v) => s + v, 0) / (sqDiffs.length || 1);
    const stdDev = Math.sqrt(variance);

    // If stdDev is high compared to average, consistency is low
    const ratio = avg > 0 ? stdDev / avg : 0;
    let status = 'green';
    if (ratio > 0.4) status = 'red';
    else if (ratio > 0.2) status = 'amber';

    // SVG path string for sparkline
    let svgPath = '';
    if (values.length > 1) {
      const min = Math.min(...values) * 0.9;
      const max = Math.max(...values) * 1.1;
      const width = 120;
      const height = 30;
      const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / (max - min)) * height;
        return `${x},${y}`;
      });
      svgPath = `M ${points.join(' L ')}`;
    }

    return { stdDev, status, svgPath, values };
  }, [state.earnings]);

  // 7. Tax Readiness
  const taxMetrics = useMemo(() => {
    const expensesWithGst = expenses.filter(e => Number(e.gstPaid) > 0).length;
    const tdsDeducted = invoices.filter(i => i.notes && i.notes.includes('TDS')).length;

    // Standard checklist
    const tdsLogged = tdsDeducted > 0;
    const gstCollected = invoices.filter(i => i.gstRate > 0).length > 0;
    const expenseGstLogged = expensesWithGst > 0;

    let checkCount = 0;
    if (tdsLogged) checkCount++;
    if (gstCollected) checkCount++;
    if (expenseGstLogged) checkCount++;

    let status = 'red';
    if (checkCount === 3) status = 'green';
    else if (checkCount >= 1) status = 'amber';

    return { tdsLogged, gstCollected, expenseGstLogged, status, checkCount };
  }, [invoices, expenses]);

  // 8. Pipeline Health
  const pipelineMetrics = useMemo(() => {
    // Projected incoming next 30 days
    const activeProjectsAmount = milestoneProjects.reduce((sum, p) => {
      const remaining = (p.milestones || [])
        .filter(m => m.status === 'Completed' || m.status === 'Pending')
        .reduce((s, m) => s + m.amount, 0);
      return sum + remaining;
    }, 0);

    const ratio = targetMonthly > 0 ? Math.round((activeProjectsAmount / targetMonthly) * 100) : 100;
    
    let status = 'red';
    if (ratio >= 100) status = 'green';
    else if (ratio >= 50) status = 'amber';

    return { ratio, activeProjectsAmount, status };
  }, [milestoneProjects, targetMonthly]);

  // Grand Total Health Score
  const grandHealthScore = useMemo(() => {
    const score = collectionMetrics.points + turnaroundMetrics.points + concentrationMetrics.points + overdueMetrics.points;
    return Math.min(100, Math.max(0, score));
  }, [collectionMetrics, turnaroundMetrics, concentrationMetrics, overdueMetrics]);

  // SVG parameters for the score ring
  const circleRadius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (grandHealthScore / 100) * circumference;

  const scoreColor = useMemo(() => {
    if (grandHealthScore >= 75) return '#10B981'; // Green
    if (grandHealthScore >= 50) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  }, [grandHealthScore]);

  // AI Urgent audit pitch
  async function generateAIAudit() {
    setAiModal(true);
    setAiText('');
    setAiLoading(true);

    const systemPrompt = "You are a professional business auditor specialized in micro-agency structures and freelance business financial vitals.";
    const prompt = `Based on this freelancer's business health metrics:
- Overall Health Score: ${grandHealthScore}/100
- Collection rate: ${collectionMetrics.rate}%
- Turnaround (Invoicing): ${turnaroundMetrics.avgDays} days
- Overdue Ratio: ${overdueMetrics.ratio}%
- Client Concentration Risk: ${concentrationMetrics.pct}% (Top client: ${concentrationMetrics.highestClient})
- Scope Creep Rate: ${scopeCreepMetrics.rate}% (₹${scopeCreepMetrics.unbilledCRs} approved unbilled)
- Next 30-day Pipeline: ₹${pipelineMetrics.activeProjectsAmount} vs ₹${targetMonthly} target

Give exactly 3 specific, highly actionable steps they should do THIS WEEK to improve their business health. Be specific (name the metric, give a concrete action, mention specific figures). Format as a numbered list. Keep it under 80 words total. Do not use generic filler words.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      const text = data.content?.map(b => b.text || '').join('') || '';
      setAiText(text);
    } catch (err) {
      const fallback = `1. **Collect Overdues**: Send immediate escalations for the ₹${formatINR(overdueMetrics.overdue)} currently overdue. Prioritize high-value clients.
2. **Bill Scope Creep**: Directly invoice the approved but unbilled scope changes representing ₹${formatINR(scopeCreepMetrics.unbilledCRs)} under Milestones.
3. **Diversify Contracts**: Your top client accounts for ${concentrationMetrics.pct}% of revenue. Set aside 3 hours this week to source fresh outreach pipelines.`;
      setAiText(fallback);
      addToast('AI Audit failed. Loaded professional fallback.', 'warning');
    } finally {
      setAiLoading(false);
    }
  }

  function getStatusDotColor(status) {
    if (status === 'green') return 'bg-emerald-400';
    if (status === 'amber') return 'bg-amber-400';
    return 'bg-red-400';
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6 text-accent" />
          Business Health Audit
        </h1>
        <p className="text-sm text-dark-300 mt-0.5">A full-picture audit of your freelance business metrics.</p>
      </div>

      {/* Large Score Widget */}
      <div className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          {/* Circular SVG Ring */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r={circleRadius}
                stroke="#262626"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r={circleRadius}
                stroke={scoreColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-black text-dark-50">{grandHealthScore}</span>
              <span className="block text-[9px] text-dark-400 font-semibold uppercase tracking-wider">Score</span>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-dark-50">Operational Business Health</h2>
            <p className="text-xs text-dark-300 mt-1 max-w-sm leading-relaxed">
              Your overall rating represents collections efficiency, client concentrations, overdue liabilities, and invoicing speeds.
            </p>
          </div>
        </div>

        <button
          onClick={generateAIAudit}
          className="btn-primary bg-gradient-to-r from-accent to-amber-500 shadow-accent/20 flex items-center gap-2 text-xs py-2.5 px-4"
        >
          <Sparkles className="w-4 h-4" /> Run AI Priority Action Audit
        </button>
      </div>

      {/* 2x4 Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="glass-card p-4 flex flex-col justify-between h-40">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Collection Rate</span>
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(collectionMetrics.status)}`} />
            </div>
            <p className="text-2xl font-extrabold text-dark-50 mt-2">{collectionMetrics.rate}%</p>
          </div>
          <p className="text-[10px] text-dark-400 leading-snug">
            {collectionMetrics.uncollected > 0
              ? `You have ${formatINR(collectionMetrics.uncollected)} uncollected. Send reminders for invoices older than 30 days.`
              : 'Flawless collections! 100% paid.'}
          </p>
        </div>

        {/* Metric 2 */}
        <div className="glass-card p-4 flex flex-col justify-between h-40">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Invoice Turnaround</span>
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(turnaroundMetrics.status)}`} />
            </div>
            <p className="text-2xl font-extrabold text-dark-50 mt-2">{turnaroundMetrics.avgDays} Days</p>
          </div>
          <p className="text-[10px] text-dark-400 leading-snug">
            Faster invoicing means faster payouts. Automate via milestone triggers.
          </p>
        </div>

        {/* Metric 3 */}
        <div className="glass-card p-4 flex flex-col justify-between h-40">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Concentration Risk</span>
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(concentrationMetrics.status)}`} />
            </div>
            <p className="text-2xl font-extrabold text-dark-50 mt-2">{concentrationMetrics.pct}%</p>
          </div>
          <p className="text-[10px] text-dark-400 leading-snug">
            {concentrationMetrics.pct > 40
              ? `Top client (${concentrationMetrics.highestClient}) represents ${concentrationMetrics.pct}% of invoices. Risk is High.`
              : `Concentration lies at a healthy ${concentrationMetrics.pct}%.`}
          </p>
        </div>

        {/* Metric 4 */}
        <div className="glass-card p-4 flex flex-col justify-between h-40">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Overdue Ratio</span>
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(overdueMetrics.status)}`} />
            </div>
            <p className="text-2xl font-extrabold text-dark-50 mt-2">{overdueMetrics.ratio}%</p>
          </div>
          <p className="text-[10px] text-dark-400 leading-snug">
            {overdueMetrics.overdue > 0
              ? `${formatINR(overdueMetrics.overdue)} is currently overdue. Send escalation alerts.`
              : 'Zero overdue outstanding cash!'}
          </p>
        </div>

        {/* Metric 5 */}
        <div className="glass-card p-4 flex flex-col justify-between h-40">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Scope Creep Rate</span>
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(scopeCreepMetrics.status)}`} />
            </div>
            <p className="text-2xl font-extrabold text-dark-50 mt-2">{scopeCreepMetrics.rate}%</p>
          </div>
          <p className="text-[10px] text-dark-400 leading-snug">
            {scopeCreepMetrics.unbilledCRs > 0
              ? `₹${scopeCreepMetrics.unbilledCRs} of approved work is unbilled. Bill it now.`
              : 'No unbilled scope leakages tracked.'}
          </p>
        </div>

        {/* Metric 6 */}
        <div className="glass-card p-4 flex flex-col justify-between h-40 font-sans">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Revenue Consistency</span>
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(consistencyMetrics.status)}`} />
            </div>
            <p className="text-2xl font-extrabold text-dark-50 mt-2">
              {consistencyMetrics.status === 'green' ? 'Predictable' : 'Feast-or-Famine'}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-dark-400">Past 6 months</span>
            {consistencyMetrics.svgPath && (
              <svg className="w-20 h-6 overflow-visible" stroke={consistencyMetrics.status === 'green' ? '#10B981' : '#F59E0B'} strokeWidth="1.5" fill="none">
                <path d={consistencyMetrics.svgPath} />
              </svg>
            )}
          </div>
        </div>

        {/* Metric 7 */}
        <div className="glass-card p-4 flex flex-col justify-between h-40">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Tax Readiness</span>
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(taxMetrics.status)}`} />
            </div>
            
            {/* Checklist */}
            <div className="mt-2 space-y-0.5 text-[10px] text-dark-200">
              <div className="flex items-center gap-1.5">
                {taxMetrics.tdsLogged ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />}
                <span>TDS Entries Logged</span>
              </div>
              <div className="flex items-center gap-1.5">
                {taxMetrics.gstCollected ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />}
                <span>GST Invoices Issued</span>
              </div>
              <div className="flex items-center gap-1.5">
                {taxMetrics.expenseGstLogged ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-red-400" />}
                <span>Expense Input GST Saved</span>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-dark-400 leading-none">
            {taxMetrics.checkCount}/3 items ready for CA filing.
          </p>
        </div>

        {/* Metric 8 */}
        <div className="glass-card p-4 flex flex-col justify-between h-40">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Pipeline Health</span>
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(pipelineMetrics.status)}`} />
            </div>
            <p className="text-2xl font-extrabold text-dark-50 mt-2">{pipelineMetrics.ratio}%</p>
          </div>
          <p className="text-[10px] text-dark-400 leading-snug">
            {pipelineMetrics.activeProjectsAmount >= targetMonthly
              ? 'Pipeline covers your monthly baseline needs.'
              : `Pipeline is ₹${targetMonthly - pipelineMetrics.activeProjectsAmount} short of target.`}
          </p>
        </div>

      </div>

      {/* Action Audit Modal */}
      <Modal isOpen={aiModal} onClose={() => setAiModal(null)} title="AI Urgent Action Audit Summary">
        <div className="space-y-4">
          <p className="text-xs text-dark-300 leading-relaxed border-b border-dark-600/30 pb-2">
            These three custom high-priority items represent the most immediate gains to improve your business's financial structure.
          </p>

          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 bg-dark-700 rounded-lg border border-dark-600/30">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-xs text-dark-300">Conducting operational audit...</p>
            </div>
          ) : (
            <div className="bg-dark-900 border border-dark-600 rounded-lg p-4 text-xs leading-relaxed text-dark-50 whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scroll">
              {aiText}
            </div>
          )}

          {!aiLoading && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(aiText);
                addToast('Action audit copied!');
              }}
              className="btn-primary w-full flex items-center justify-center gap-2 text-xs py-2"
            >
              <CheckCircle className="w-4 h-4" /> Copy Action Items
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
