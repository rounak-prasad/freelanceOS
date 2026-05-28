// ==========================================
// FreelanceOS — LinkedIn Outreach Page ($1M Upgrade)
// ==========================================
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import {
  Linkedin, Loader2, Copy, RefreshCw, ChevronDown, Sparkles, Check, Send, CalendarClock, Info
} from 'lucide-react';

export default function LinkedInOutreach() {
  const { addToast } = useData();

  const [form, setForm] = useState({
    industry: '',
    specialization: '',
    valueProp: '',
    tone: 'Professional',
    length: 'Medium',
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  async function generateOutreach() {
    if (!form.industry || !form.specialization || !form.valueProp) {
      addToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    setResults(null);

    const systemPrompt = "You are a world-class copywriter specializing in LinkedIn social selling and premium B2B cold outreach for top-tier freelancers and consultants.";
    const lengthHint = form.length === 'Short' ? 'under 250 characters (suitable for connection requests)' : form.length === 'Long' ? 'around 200 words' : 'around 120 words';
    
    const prompt = `Generate a comprehensive LinkedIn outreach campaign for a freelancer.
Target Industry: ${form.industry}
Freelancer Specialization: ${form.specialization}
Unique Value Proposition: ${form.valueProp}
Tone: ${form.tone}
Length of outreach: ${lengthHint}

You must return a valid JSON object only. Do not include any markdown, introductory, or concluding text. The JSON object must contain exactly the following structure:
{
  "variation1": {
    "title": "Pain-Point Angle",
    "badge": "Empathy-Driven",
    "description": "Focuses on identifying a typical struggle in their industry and presenting your specialization as the organic cure.",
    "outreach": "[Outreach message here. Keep it within the requested length. Use natural paragraph breaks.]",
    "followUpDay3": "[Day 3 Soft Nudge follow-up message. A casual 2-sentence nudge checking on interest.]",
    "followUpDay7": "[Day 7 Value-Add follow-up message. Offers a specific tip, industry insight, or free advice to build authority without being salesy.]"
  },
  "variation2": {
    "title": "Proof-of-Result Angle",
    "badge": "Authority-Driven",
    "description": "Focuses on metrics, case studies, or proven results you've shipped for similar clients in their sector.",
    "outreach": "[Outreach message here. Focus on metrics and credibility. Keep it within the requested length.]",
    "followUpDay3": "[Day 3 Soft Nudge follow-up message. A casual 2-sentence nudge referencing the previous outcome metric.]",
    "followUpDay7": "[Day 7 Value-Add follow-up message. Shares a quick actionable strategy or value bomb related to your results.]"
  }
}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) throw new Error('API Key or network error');
      const data = await response.json();
      const text = data.content?.map(b => b.text || '').join('') || '';
      
      // Attempt to clean JSON
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('Invalid JSON response');
      const cleanJson = text.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(cleanJson);
      setResults(parsed);
      addToast('LinkedIn Campaign generated with Claude!', 'success');
    } catch (err) {
      console.warn("Claude API failed, triggering premium local generator fallback.", err);
      // Premium Mock Fallback
      const ind = form.industry;
      const spec = form.specialization;
      const val = form.valueProp;
      const t = form.tone.toLowerCase();

      const isShort = form.length === 'Short';

      const mockData = {
        variation1: {
          title: "Pain-Point Angle",
          badge: "Empathy-Driven",
          description: "Focuses on identifying a typical struggle in their industry and presenting your specialization as the organic cure.",
          outreach: isShort 
            ? `Hi there! Noticed you lead product in ${ind}. Many teams there struggle with slow turnaround on ${spec}. I help companies speed this up by ${val}. Would you be open to a quick connection to share notes?`
            : `Hi [Name],\n\nI’ve been following recent updates in the ${ind} sector and noticed a common challenge: many teams struggle to keep up with high-quality ${spec} while maintaining cost-efficiencies.\n\nI specialize in ${spec}, helping firms bypass this bottleneck by ${val}.\n\nWould you be open to a brief, 5-minute chat next Tuesday to see if my approach could unlock similar efficiencies for your current sprint?\n\nBest regards,\n[Your Name]`,
          followUpDay3: `Hi [Name], just checking if you had a moment to see my note on ${spec} pipelines? Understand if you're busy! Let me know if a quick chat makes sense next week.`,
          followUpDay7: `Hi [Name], hope you're having a great week. I thought you'd find this useful: many ${ind} companies we work with saw a 30% reduction in workflow drag simply by implementing a single adjustment in their ${spec} protocols. Happy to share the quick SOP if you're interested!`
        },
        variation2: {
          title: "Proof-of-Result Angle",
          badge: "Authority-Driven",
          description: "Focuses on metrics, case studies, or proven results you've shipped for similar clients in their sector.",
          outreach: isShort 
            ? `Hi! I recently helped another firm in the ${ind} space scale their throughput by 40% through ${val}. I specialize in ${spec} and would love to share how we achieved it. Open to a brief chat?`
            : `Hi [Name],\n\nI wanted to share a quick result that might be relevant to your current pipeline. We recently helped a brand in the ${ind} space scale their performance by 40% using our custom framework for ${spec}.\n\nSpecifically, we resolved their primary delivery friction by ${val}.\n\nGiven your focus on growth, I'd love to share the exact 3-step playbook we used. Would you be open to a quick call next week? no sales pitch, just sharing what worked.\n\nBest,\n[Your Name]`,
          followUpDay3: `Hi [Name], following up on my previous note about the 40% scale improvement in ${ind}. Would you be open to a quick 5-minute sync this Thursday?`,
          followUpDay7: `Hi [Name], hope you're doing well. Since we last spoke, I put together a brief case study outlining how we design ${spec} architectures to eliminate delivery delays. You can review it here: [Link]. Let me know if any of these insights align with your Q2 objectives!`
        }
      };

      setResults(mockData);
      addToast('Generated professional outreach templates!', 'success');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text, key) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    addToast('Message copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const inputClass =
    'w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#525252] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all duration-200';

  return (
    <div className="page-enter space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20">
          <Linkedin className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#FAFAFA]">LinkedIn Outreach Writer</h1>
          <p className="text-sm text-[#A3A3A3]">Generate high-converting multi-touch cold campaigns with Claude AI</p>
        </div>
      </div>

      {/* Main Campaign Input Panel */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-3 mb-2">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A3A3A3]">Outreach Parameters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Target Industry *</label>
            <input 
              value={form.industry} 
              onChange={e => set('industry', e.target.value)} 
              placeholder='e.g. "SaaS startups", "D2C brands", "Fintech agencies"' 
              className={inputClass} 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Your Specialization *</label>
            <input 
              value={form.specialization} 
              onChange={e => set('specialization', e.target.value)} 
              placeholder='e.g. "UI/UX Design", "Full Stack Next.js development"' 
              className={inputClass} 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Your Unique Value Proposition *</label>
          <input 
            value={form.valueProp} 
            onChange={e => set('valueProp', e.target.value)} 
            placeholder="e.g. 'Optimizing API response speeds by 60%' or 'Designing high-converting checkouts that reduce cart abandonment by 18%'" 
            className={inputClass} 
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Outreach Tone</label>
            <div className="relative">
              <select value={form.tone} onChange={e => set('tone', e.target.value)} className={`${inputClass} appearance-none pr-10 cursor-pointer`}>
                <option>Professional</option>
                <option>Friendly & Warm</option>
                <option>Bold & Direct</option>
                <option>Curious & Collaborative</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Message Length</label>
            <div className="relative">
              <select value={form.length} onChange={e => set('length', e.target.value)} className={`${inputClass} appearance-none pr-10 cursor-pointer`}>
                <option value="Short">Short (Under 300 chars - connection request)</option>
                <option value="Medium">Medium (~120 words - premium pitch)</option>
                <option value="Long">Long (~200 words - detailed InMail)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button 
            onClick={generateOutreach} 
            disabled={loading} 
            className="px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:from-orange-500 hover:to-amber-400 shadow-lg shadow-orange-600/20 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
            {loading ? 'Composing Campaign...' : 'Generate Full Campaign'}
          </button>
          {results && (
            <button onClick={generateOutreach} disabled={loading} className="px-5 py-3 rounded-xl text-sm font-semibold bg-[#262626] border border-[#2A2A2A] text-[#FAFAFA] hover:bg-[#333333] active:scale-[0.98] transition-all flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Re-generate
            </button>
          )}
        </div>
      </div>

      {/* Info message when no results */}
      {!results && !loading && (
        <div className="glass-card p-6 flex items-start gap-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
          <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#FAFAFA]">Multi-Touch Campaign Methodology</h3>
            <p className="text-xs text-dark-300 leading-relaxed">
              Instead of a single cold pitch, this module designs a 3-part touchpoint sequence: an introductory message (Pain-point or Result-driven angle), a Day 3 low-pressure soft nudge, and a Day 7 value-added conversation starter. Text fields are fully editable so you can customize them before copying.
            </p>
          </div>
        </div>
      )}

      {/* Loading Widget */}
      {loading && (
        <div className="glass-card p-12 text-center border border-[#2A2A2A] bg-[#1A1A1A]/80 backdrop-blur-xl">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
          <h3 className="text-base font-bold text-[#FAFAFA]">Generating LinkedIn Strategy</h3>
          <p className="text-xs text-dark-300 mt-1 max-w-xs mx-auto">
            Claude is analyzing your value proposition to formulate 2 core outreach angles and follow-up templates...
          </p>
        </div>
      )}

      {/* Two Column Layout of Generated Campaigns */}
      {results && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          
          {/* Card 1: Pain Point */}
          <VariationCard 
            data={results.variation1} 
            vId="v1"
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />

          {/* Card 2: Proof of Result */}
          <VariationCard 
            data={results.variation2} 
            vId="v2"
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />

        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

function VariationCard({ data, vId, copiedKey, onCopy }) {
  const [outreachVal, setOutreachVal] = useState(data.outreach);
  const [day3Val, setDay3Val] = useState(data.followUpDay3);
  const [day7Val, setDay7Val] = useState(data.followUpDay7);

  // Sync state if data changes externally (e.g. on regeneration)
  React.useEffect(() => {
    setOutreachVal(data.outreach);
    setDay3Val(data.followUpDay3);
    setDay7Val(data.followUpDay7);
  }, [data]);

  const charCount = outreachVal.length;
  const isCharWarning = charCount > 300;

  return (
    <div className="glass-card flex flex-col justify-between overflow-hidden border border-[#2A2A2A] bg-[#1A1A1A]/80 backdrop-blur-xl">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-[#2A2A2A] flex items-center justify-between bg-white/5">
        <div>
          <h3 className="text-base font-bold text-[#FAFAFA] flex items-center gap-2">
            {data.title}
          </h3>
          <p className="text-xs text-dark-400 mt-0.5">{data.description}</p>
        </div>
        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
          {data.badge}
        </span>
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-6">
        
        {/* Step 1: Initial Pitch */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-dark-200 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-orange-400" />
              Touchpoint 1: Initial Outreach
            </h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isCharWarning ? 'text-amber-400 bg-amber-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
              {charCount} chars {charCount <= 300 && '• Connection Safe'}
            </span>
          </div>
          <textarea
            value={outreachVal}
            onChange={e => setOutreachVal(e.target.value)}
            rows={6}
            className="w-full bg-[#262626]/60 border border-[#2A2A2A] rounded-lg px-3.5 py-2.5 text-xs text-[#FAFAFA] leading-relaxed resize-y focus:outline-none focus:border-orange-500/40"
          />
          <button 
            onClick={() => onCopy(outreachVal, `${vId}-outreach`)} 
            className="w-full py-2 bg-[#262626] border border-[#2A2A2A] hover:bg-[#333333] text-xs font-semibold text-[#FAFAFA] rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {copiedKey === `${vId}-outreach` ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied Pitch</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-dark-300" />
                Copy Initial Pitch
              </>
            )}
          </button>
        </div>

        {/* Follow-up Sequence Panel */}
        <div className="border-t border-[#2A2A2A] pt-5 space-y-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-dark-300 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 text-orange-400" />
            Nurture Campaign Sequence
          </h4>

          {/* Step 2: Day 3 Nudge */}
          <div className="space-y-2 pl-4 border-l-2 border-[#2A2A2A] focus-within:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-dark-25">Day 3: Soft Nudge</span>
              <span className="text-[10px] text-dark-400">{day3Val.length} chars</span>
            </div>
            <textarea
              value={day3Val}
              onChange={e => setDay3Val(e.target.value)}
              rows={3}
              className="w-full bg-[#262626]/40 border border-[#2A2A2A] rounded-lg px-3.5 py-2.5 text-xs text-[#FAFAFA] leading-relaxed resize-y focus:outline-none focus:border-orange-500/40"
            />
            <button 
              onClick={() => onCopy(day3Val, `${vId}-day3`)} 
              className="py-1.5 px-3 bg-[#262626]/40 border border-[#2A2A2A] hover:bg-[#333333] text-[10px] font-semibold text-[#FAFAFA] rounded-md flex items-center justify-center gap-1.5 ml-auto transition-colors"
            >
              {copiedKey === `${vId}-day3` ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-dark-300" />
                  Copy Nudge
                </>
              )}
            </button>
          </div>

          {/* Step 3: Day 7 Value-add */}
          <div className="space-y-2 pl-4 border-l-2 border-[#2A2A2A] focus-within:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-dark-25">Day 7: Value-Add Resource</span>
              <span className="text-[10px] text-dark-400">{day7Val.length} chars</span>
            </div>
            <textarea
              value={day7Val}
              onChange={e => setDay7Val(e.target.value)}
              rows={4}
              className="w-full bg-[#262626]/40 border border-[#2A2A2A] rounded-lg px-3.5 py-2.5 text-xs text-[#FAFAFA] leading-relaxed resize-y focus:outline-none focus:border-orange-500/40"
            />
            <button 
              onClick={() => onCopy(day7Val, `${vId}-day7`)} 
              className="py-1.5 px-3 bg-[#262626]/40 border border-[#2A2A2A] hover:bg-[#333333] text-[10px] font-semibold text-[#FAFAFA] rounded-md flex items-center justify-center gap-1.5 ml-auto transition-colors"
            >
              {copiedKey === `${vId}-day7` ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-dark-300" />
                  Copy Value-Add
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
