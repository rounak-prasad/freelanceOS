// ==========================================
// FreelanceOS — Rate & Profitability Calculator
// ==========================================
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR } from '../utils/helpers';
import Modal from '../components/UI/Modal';
import {
  Calculator, Sparkles, AlertTriangle, Copy, CheckCircle, ChevronDown, Loader2
} from 'lucide-react';

const MARKET_RATES = {
  'Web Development': {
    '0-1': { min: 500, max: 1000, currency: '₹/hr' },
    '1-3': { min: 1000, max: 2500, currency: '₹/hr' },
    '3-5': { min: 2500, max: 5000, currency: '₹/hr' },
    '5+': { min: 5000, max: 15000, currency: '₹/hr' },
  },
  'UI/UX Design': {
    '0-1': { min: 600, max: 1200, currency: '₹/hr' },
    '1-3': { min: 1200, max: 3000, currency: '₹/hr' },
    '3-5': { min: 3000, max: 6000, currency: '₹/hr' },
    '5+': { min: 6000, max: 18000, currency: '₹/hr' },
  },
  'Content Writing': {
    '0-1': { min: 1, max: 3, currency: '₹/word' },
    '1-3': { min: 3, max: 8, currency: '₹/word' },
    '3-5': { min: 8, max: 20, currency: '₹/word' },
    '5+': { min: 20, max: 50, currency: '₹/word' },
  },
  'Digital Marketing': {
    '0-1': { min: 10000, max: 20000, currency: '₹/month' },
    '1-3': { min: 20000, max: 50000, currency: '₹/month' },
    '3-5': { min: 50000, max: 120000, currency: '₹/month' },
    '5+': { min: 120000, max: 300000, currency: '₹/month' },
  },
  'Video Editing': {
    '0-1': { min: 8000, max: 15000, currency: '₹/project' },
    '1-3': { min: 15000, max: 35000, currency: '₹/project' },
    '3-5': { min: 35000, max: 75000, currency: '₹/project' },
    '5+': { min: 75000, max: 200000, currency: '₹/project' },
  },
  SEO: {
    '0-1': { min: 8000, max: 18000, currency: '₹/month' },
    '1-3': { min: 18000, max: 40000, currency: '₹/month' },
    '3-5': { min: 40000, max: 80000, currency: '₹/month' },
    '5+': { min: 80000, max: 200000, currency: '₹/month' },
  },
  'Mobile App Dev': {
    '0-1': { min: 600, max: 1200, currency: '₹/hr' },
    '1-3': { min: 1200, max: 3000, currency: '₹/hr' },
    '3-5': { min: 3000, max: 6000, currency: '₹/hr' },
    '5+': { min: 6000, max: 20000, currency: '₹/hr' },
  },
  'Data Analysis': {
    '0-1': { min: 500, max: 1000, currency: '₹/hr' },
    '1-3': { min: 1000, max: 2500, currency: '₹/hr' },
    '3-5': { min: 2500, max: 5500, currency: '₹/hr' },
    '5+': { min: 5500, max: 15000, currency: '₹/hr' },
  },
};

export default function RateCalculator() {
  const { addToast } = useData();

  // Section 1: MVR Inputs
  const [fixedExpenses, setFixedExpenses] = useState('20000');
  const [varExpenses, setVarExpenses] = useState('25000');
  const [savingsTarget, setSavingsTarget] = useState('30000');
  const [taxBuffer, setTaxBuffer] = useState('30'); // 44ADA Presumptive Tax Bracket
  const [billableHours, setBillableHours] = useState('120');

  // Section 2: Market Position Inputs
  const [skill, setSkill] = useState('Web Development');
  const [experience, setExperience] = useState('1-3');
  const [clientType, setClientType] = useState('Indian Startups');

  // AI Modal states
  const [aiModal, setAiModal] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Section 3: Project Profitability Inputs
  const [projValue, setProjValue] = useState('80000');
  const [projHours, setProjHours] = useState('25');
  const [projectMinRate, setProjectMinRate] = useState('');

  // Calculations for MVR
  const mvrMetrics = useMemo(() => {
    const fixed = Math.max(Number(fixedExpenses) || 0, 0);
    const variable = Math.max(Number(varExpenses) || 0, 0);
    const savings = Math.max(Number(savingsTarget) || 0, 0);
    const tax = Math.min(Math.max(Number(taxBuffer) || 0, 0), 95);
    const hours = Math.max(Number(billableHours) || 0, 1);

    const grossNeeded = (fixed + variable + savings) / (1 - tax / 100);
    const hourly = hours > 0 ? grossNeeded / hours : 0;
    const daily = hourly * 8;
    const project = hourly * 30; // standard 30-hour project

    return {
      grossNeeded,
      hourly: Math.round(hourly),
      daily: Math.round(daily),
      project: Math.round(project),
      tax,
      hours
    };
  }, [fixedExpenses, varExpenses, savingsTarget, taxBuffer, billableHours]);

  // Calculations for Market Position
  const marketBench = useMemo(() => {
    const rateData = MARKET_RATES[skill]?.[experience] || { min: 1000, max: 2500, currency: '₹/hr' };
    const median = (rateData.min + rateData.max) / 2;
    const isUndercharging = mvrMetrics.hourly < rateData.min;
    const underchargeBy = isUndercharging ? Math.round(rateData.min - mvrMetrics.hourly) : 0;

    // Calculate percentage position
    let percentage = 0;
    if (mvrMetrics.hourly >= rateData.max) percentage = 100;
    else if (mvrMetrics.hourly <= rateData.min) percentage = 0;
    else percentage = Math.round(((mvrMetrics.hourly - rateData.min) / (rateData.max - rateData.min)) * 100);

    return {
      min: rateData.min,
      max: rateData.max,
      median,
      currency: rateData.currency,
      isUndercharging,
      underchargeBy,
      percentage
    };
  }, [skill, experience, mvrMetrics.hourly]);

  // Calculations for Project Profitability
  const profitabilityMetrics = useMemo(() => {
    const value = Math.max(Number(projValue) || 0, 0);
    const hours = Math.max(Number(projHours) || 0, 1);
    const minimumHourly = Math.max(Number(projectMinRate) || mvrMetrics.hourly || 0, 0);
    const effectiveHourly = value / hours;
    
    // Profit margin vs MVR
    const margin = minimumHourly > 0 
      ? Math.round(((effectiveHourly - minimumHourly) / minimumHourly) * 100)
      : 0;

    const difference = Math.round(Math.abs(effectiveHourly - minimumHourly));
    const projectDifference = Math.round(Math.abs(effectiveHourly - minimumHourly) * hours);
    const isUnprofitable = effectiveHourly < minimumHourly;

    return {
      effectiveHourly: Math.round(effectiveHourly),
      minimumHourly: Math.round(minimumHourly),
      difference,
      projectDifference,
      margin,
      isUnprofitable
    };
  }, [projValue, projHours, projectMinRate, mvrMetrics.hourly]);

  // AI Justification fetch
  async function generateAIAdvice() {
    setAiModal(true);
    setAiText('');
    setAiLoading(true);

    const systemPrompt = "You are a pricing coach for Indian freelancers. Be specific, practical, and avoid generic advice.";
    const prompt = `Indian freelancer profile:
Skill: ${skill}
Experience: ${experience}
Client type: ${clientType}
Current minimum rate: ₹${mvrMetrics.hourly}/hr
Market range: ₹${marketBench.min}-₹${marketBench.max} ${marketBench.currency}

Give 3 specific things this freelancer can do in the next 90 days to justify
charging at the TOP of their market range. Be specific to Indian freelance market.
Not generic advice. Each tip max 25 words. Numbered list.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      const text = data.content?.map(b => b.text || '').join('') || '';
      setAiText(text);
    } catch (err) {
      const fallback = `### 3 Ways to Justify ₹${marketBench.max}/hr for ${skill}
1. **Case Study Framing**: Present your work as investment-to-revenue models rather than hour logs. Frame achievements around conversion improvements.
2. **Deep Niche Positioning**: Focus heavily on ${clientType} business flows, showing you solve business problems, not just execution tasks.
3. **Turnkey SLA Support**: Package your solutions with post-launch SLA support, which mitigates client operational risks.

### 3 Steps to Close Premium Deals in 6 Months
1. **Publish Value Assets**: Build interactive Figma tools, open-source npm assets, or high-value case studies relevant to ${skill}.
2. **Internationalize Outreach**: Source clients outside local margins to automatically secure USD/Euro premiums.
3. **Premium SOW Proposals**: Never quote simple line sums; construct highly detailed, multi-tier premium proposals representing high credibility.`;
      setAiText(fallback);
      addToast('AI generation failed. Try again.', 'error');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
          <Calculator className="w-6 h-6 text-accent" />
          Rate Calculator
        </h1>
        <p className="text-sm text-dark-300 mt-0.5">Know your worth. Stop leaving ₹ on the table.</p>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Section 1: Minimum Viable Rate (MVR) */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-base font-semibold text-dark-50 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            1. Minimum Viable Rate (MVR)
          </h3>
          <p className="text-xs text-dark-300">
            Calculate the baseline billing rate required to pay your bills, sustain savings, and cover presumptive business taxes.
          </p>

          <div className="grid grid-cols-2 gap-4 font-sans">
            <div>
              <label className="input-label">Fixed Expenses (₹/mo)</label>
              <input
                type="number"
                min="0"
                value={fixedExpenses}
                onChange={(e) => setFixedExpenses(e.target.value)}
                className="w-full bg-dark-900 border-dark-600"
              />
            </div>
            <div>
              <label className="input-label">Variable Expenses (₹/mo)</label>
              <input
                type="number"
                min="0"
                value={varExpenses}
                onChange={(e) => setVarExpenses(e.target.value)}
                className="w-full bg-dark-900 border-dark-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 font-sans">
            <div className="col-span-1">
              <label className="input-label">Savings (₹/mo)</label>
              <input
                type="number"
                min="0"
                value={savingsTarget}
                onChange={(e) => setSavingsTarget(e.target.value)}
                className="w-full bg-dark-900 border-dark-600"
              />
            </div>
            <div>
              <label className="input-label">Tax Buffer %</label>
              <input
                type="number"
                min="0"
                max="95"
                value={taxBuffer}
                onChange={(e) => setTaxBuffer(e.target.value)}
                className="w-full bg-dark-900 border-dark-600"
              />
            </div>
            <div>
              <label className="input-label">Billable Hrs/mo</label>
              <input
                type="number"
                min="1"
                value={billableHours}
                onChange={(e) => setBillableHours(e.target.value)}
                className="w-full bg-dark-900 border-dark-600"
              />
            </div>
          </div>

          {/* Results grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-600/10">
              <span className="text-[10px] text-dark-300 uppercase tracking-wider font-semibold">Gross Monthly Need</span>
              <p className="text-xl font-bold text-accent mt-0.5">{formatINR(mvrMetrics.grossNeeded)}</p>
            </div>
            <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-600/10">
              <span className="text-[10px] text-dark-300 uppercase tracking-wider font-semibold">Min Hourly Rate</span>
              <p className="text-xl font-bold text-accent mt-0.5">₹{mvrMetrics.hourly}/hr</p>
            </div>
            <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-600/10">
              <span className="text-[10px] text-dark-300 uppercase tracking-wider font-semibold">Min Daily Rate</span>
              <p className="text-xl font-bold text-accent mt-0.5">₹{mvrMetrics.daily}/day</p>
            </div>
            <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-600/10">
              <span className="text-[10px] text-dark-300 uppercase tracking-wider font-semibold">Min project rate (30h)</span>
              <p className="text-xl font-bold text-accent mt-0.5">{formatINR(mvrMetrics.project)}</p>
            </div>
          </div>
        </div>

        {/* Section 2: Market Position */}
        <div className="glass-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-dark-50 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              2. Market Rate Benchmarker
            </h3>
            <p className="text-xs text-dark-300 mb-3">
              Benchmark your minimum rate against real-world Indian freelance market ranges.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
              <div>
                <label className="input-label">Skill</label>
                <div className="relative">
                  <select value={skill} onChange={(e) => setSkill(e.target.value)} className="w-full appearance-none bg-dark-900 border-dark-600 text-xs">
                    {Object.keys(MARKET_RATES).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="input-label">Experience</label>
                <div className="relative">
                  <select value={experience} onChange={(e) => setExperience(e.target.value)} className="w-full appearance-none bg-dark-900 border-dark-600 text-xs">
                    <option value="0-1">0-1 year</option>
                    <option value="1-3">1-3 years</option>
                    <option value="3-5">3-5 years</option>
                    <option value="5+">5+ years</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="input-label">Target Client</label>
                <div className="relative">
                  <select value={clientType} onChange={(e) => setClientType(e.target.value)} className="w-full appearance-none bg-dark-900 border-dark-600 text-xs">
                    <option value="Indian Startups">Indian Startups</option>
                    <option value="Indian SMEs">Indian SMEs</option>
                    <option value="Indian Enterprises">Indian Enterprises</option>
                    <option value="International Clients (USD)">International (USD)</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Slider range display */}
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs text-dark-300 font-medium">
                <span>Market Range: {marketBench.min} - {marketBench.max} {marketBench.currency}</span>
                <span className="text-emerald-400">Median: {marketBench.median} {marketBench.currency}</span>
              </div>
              
              <div className="w-full h-2 rounded-full bg-dark-700 relative">
                {/* Visual indicator of "You are here" on the bar */}
                <div
                  className="absolute w-4 h-4 rounded-full bg-accent border-2 border-dark-50 -top-1 shadow-lg transform -translate-x-1/2 transition-all duration-300"
                  style={{ left: `${marketBench.percentage}%` }}
                  title={`Your MVR is ₹${mvrMetrics.hourly}/hr (${marketBench.percentage}% position)`}
                />
              </div>
              <div className="flex justify-between text-[9px] text-dark-400">
                <span>Entry (Min)</span>
                <span>Pro (Median)</span>
                <span>Expert (Max)</span>
              </div>
            </div>

            {/* Undercharging warnings */}
            {marketBench.isUndercharging && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 animate-pulse-glow">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-400 leading-relaxed font-medium">
                  ⚠️ <strong>Undercharging Alert:</strong> Your minimum rate is ₹{mvrMetrics.hourly}/hr, which is below the entry market benchmark for {skill}. You are undercharging by <strong>₹{marketBench.underchargeBy}/hr</strong>.
                </p>
              </div>
            )}
            
            {!marketBench.isUndercharging && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-400 leading-relaxed font-medium">
                  🎉 Your MVR is positioned healthy inside the expert freelance spectrum for {skill}.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={generateAIAdvice}
            disabled={aiLoading}
            className="btn-primary w-full bg-gradient-to-r from-emerald-600 to-teal-500 shadow-teal-500/10 border-none flex items-center justify-center gap-1.5 text-xs py-2.5 mt-4"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiLoading ? 'Generating...' : 'Get AI Rate Justification Pitch'}
          </button>
        </div>

      </div>

      {/* Section 3: Project Profitability Calculator */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-base font-semibold text-dark-50 tracking-tight flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          3. Project Profitability Calculator
        </h3>
        <p className="text-xs text-dark-300">
          Ensure any flat-rate project quote yields an effective hourly rate exceeding your calculated MVR.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
          <div>
            <label className="input-label">Project Scope Value (₹)</label>
            <input
              type="number"
              min="0"
              value={projValue}
              onChange={(e) => setProjValue(e.target.value)}
              className="w-full bg-dark-900 border-dark-600"
            />
          </div>
          <div>
            <label className="input-label">Estimated Delivery Hours</label>
            <input
              type="number"
              min="1"
              value={projHours}
              onChange={(e) => setProjHours(e.target.value)}
              className="w-full bg-dark-900 border-dark-600"
            />
          </div>
          <div>
            <label className="input-label">Your Minimum Hourly Rate (₹)</label>
            <input
              type="number"
              min="0"
              value={projectMinRate}
              onChange={(e) => setProjectMinRate(e.target.value)}
              placeholder={String(mvrMetrics.hourly)}
              className="w-full bg-dark-900 border-dark-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-dark-900/60 p-4 rounded-lg border border-dark-600/10">
            <span className="text-[10px] text-dark-300 uppercase tracking-wider font-semibold">Effective Hourly Rate</span>
            <p className="text-xl font-bold text-dark-50 mt-0.5">₹{profitabilityMetrics.effectiveHourly}/hr</p>
            <span className="text-[10px] text-dark-400 block mt-1">Based on flat price / total hours</span>
          </div>

          <div className="bg-dark-900/60 p-4 rounded-lg border border-dark-600/10">
            <span className="text-[10px] text-dark-300 uppercase tracking-wider font-semibold">Profit Margin vs MVR</span>
            <p className={`text-xl font-bold mt-0.5 ${profitabilityMetrics.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {profitabilityMetrics.margin >= 0 ? '+' : ''}{profitabilityMetrics.margin}%
            </p>
            <span className="text-[10px] text-dark-400 block mt-1">Relative to your ₹{profitabilityMetrics.minimumHourly}/hr minimum</span>
          </div>

          <div className="bg-dark-900/60 p-4 rounded-lg border border-dark-600/10 flex flex-col justify-center">
            {profitabilityMetrics.isUnprofitable ? (
              <div className="text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-xs text-red-400">Unprofitable Project</h5>
                  <p className="text-[10px] text-red-400/80 leading-snug mt-0.5">
                    You're earning ₹{profitabilityMetrics.effectiveHourly}/hr. Your minimum is ₹{profitabilityMetrics.minimumHourly}/hr. This project loses you ₹{profitabilityMetrics.projectDifference}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-emerald-400 flex items-start gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-xs text-emerald-400">Profitable Project</h5>
                  <p className="text-[10px] text-emerald-400/80 leading-snug mt-0.5">
                    This project pays ₹{profitabilityMetrics.effectiveHourly}/hr - ₹{profitabilityMetrics.difference}/hr above your minimum. Good deal.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Justification Pitch Modal */}
      <Modal isOpen={aiModal} onClose={() => setAiModal(null)} title="AI Pricing Position Pitch">
        <div className="space-y-4">
          <p className="text-xs text-dark-300 leading-relaxed">
            Use these custom arguments during negotiation with high-end clients to justify premium expert pricing models.
          </p>

          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 bg-dark-700 rounded-lg border border-dark-600/30">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-xs text-dark-300">Drafting rate advice...</p>
            </div>
          ) : (
            <div className="bg-dark-900 border border-dark-600 rounded-lg p-4 text-xs leading-relaxed text-dark-50 whitespace-pre-wrap max-h-[350px] overflow-y-auto custom-scroll">
              {aiText}
            </div>
          )}

          {!aiLoading && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(aiText);
                addToast('Rate advice copied!');
              }}
              className="btn-primary w-full flex items-center justify-center gap-2 text-xs py-2"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Justification Guide
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
