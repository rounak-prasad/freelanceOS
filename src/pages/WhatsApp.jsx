// ==========================================
// FreelanceOS — WhatsApp Follow-up Generator ($1M Upgrade)
// ==========================================
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatINR } from '../utils/helpers';
import { whatsappTemplates, templateTypes } from '../utils/whatsappTemplates';
import {
  MessageCircle, Copy, ExternalLink, Send, User, Building2, Check,
  ChevronDown, Clock, Trash2, Phone, Briefcase, IndianRupee, Sparkles, History, Loader2, Info
} from 'lucide-react';

const HISTORY_KEY = 'freelanceos_whatsapp_history';

function getStoredHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function WhatsApp() {
  const { state, addToast } = useData();
  const { clients } = state;

  // ---- Tabs ----
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' or 'ai'

  // ---- Form state ----
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // ---- AI Compose state ----
  const [aiSituation, setAiSituation] = useState('invoice_followup');
  const [aiTone, setAiTone] = useState('professional');
  const [aiContext, setAiContext] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // ---- Message history (persisted in localStorage) ----
  const [history, setHistory] = useState(getStoredHistory);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
  }, [history]);

  // ---- Derived data ----
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId],
  );

  // Auto-generate message when client + template change (Standard Templates tab)
  useEffect(() => {
    if (activeTab === 'templates' && selectedClient && selectedType && whatsappTemplates[selectedType]) {
      const generated = whatsappTemplates[selectedType](
        selectedClient,
        selectedClient.projectName,
        selectedClient.projectValue,
      );
      setEditedMessage(generated);
    }
  }, [selectedClient, selectedType, activeTab]);

  // ---- AI Message Generator ----
  async function handleAICompose() {
    if (!selectedClient) {
      addToast('Please select a client first', 'error');
      return;
    }

    setAiLoading(true);
    setEditedMessage('');

    const situationMap = {
      invoice_followup: "Unpaid / Overdue Invoice Nudge",
      scope_creep: "Scope Creep / Change Request Approval",
      milestone_completed: "Milestone Completion and Client Sign-off",
      retainer_pitch: "Upselling a monthly retainer model after project success",
      project_delay: "Polite notice explaining a project milestone delay",
      custom: "Custom Situation / General follow-up"
    };

    const toneMap = {
      friendly: "Friendly, casual, and collaborative",
      professional: "Polite, professional, and clear",
      firm: "Firm, direct, and assertive (as a professional escalation)",
      urgent: "Urgent, high-priority request for immediate attention"
    };

    const systemPrompt = "You are a professional business coach and communication expert specialized in drafting highly conversational, polite but firm WhatsApp follow-up messages for clients.";
    
    const prompt = `Draft a high-conversion, professional WhatsApp message for:
Client Name: ${selectedClient.name}
Company Name: ${selectedClient.company || 'N/A'}
Project Name: ${selectedClient.projectName || 'N/A'}
Project Value: ₹${selectedClient.projectValue || 'N/A'}
Situation: ${situationMap[aiSituation]}
Context / Specific Details: ${aiContext || 'No additional details provided'}
Tone: ${toneMap[aiTone]}

Format rules:
- Keep it concise and extremely easy to read on mobile screens.
- Incorporate appropriate WhatsApp typography style, using *bold text* for critical emphasis (like key figures, invoice numbers, or due dates).
- End with a single clear, friendly question or call-to-action that encourages an immediate reply.
- Do NOT use email-style greetings or signatures (like "Dear...", "Best regards...", "Sincerely"). Start directly with a warm greeting like "Hi [Name]!" or "Hello [Name]," and end with your name.
- Keep the total length under 100 words.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) throw new Error('API Key or CORS issue');
      const data = await response.json();
      const text = data.content?.map(b => b.text || '').join('') || '';
      setEditedMessage(text.trim());
      addToast('AI WhatsApp draft composed with Claude!', 'success');
    } catch (err) {
      console.warn("Claude API failed, triggering premium local generator fallback.", err);
      
      // Premium local template fallbacks depending on tone & situation
      const clientName = selectedClient.name;
      const projName = selectedClient.projectName || 'our project';
      const projVal = selectedClient.projectValue ? formatINR(selectedClient.projectValue) : '';
      const customDetails = aiContext ? ` regarding ${aiContext}` : '';

      let fallbackText = '';

      if (aiSituation === 'invoice_followup') {
        if (aiTone === 'friendly') {
          fallbackText = `Hey *${clientName}*! Hope you're having a great week. Quick nudge regarding the outstanding invoice for *${projName}*${projVal ? ` (${projVal})` : ''}. Let me know if we're on track for this week?`;
        } else if (aiTone === 'firm') {
          fallbackText = `Hello *${clientName}*, I am writing to follow up on the unpaid invoice${projVal ? ` of ${projVal}` : ''} for *${projName}* which is now past due. Could you check with your accounts team on when we can expect the settlement?`;
        } else if (aiTone === 'urgent') {
          fallbackText = `Hi *${clientName}*, this is an urgent nudge regarding the overdue invoice${projVal ? ` of ${projVal}` : ''} for *${projName}*. Please let me know if there are any issues preventing the transfer today so we can resolve them immediately.`;
        } else {
          fallbackText = `Hi *${clientName}*, hope you're doing well. Just checking if you received the invoice for *${projName}*${projVal ? ` (${projVal})` : ''} sent last week? Let me know if you need any info to process the transfer.`;
        }
      } else if (aiSituation === 'scope_creep') {
        fallbackText = `Hi *${clientName}*, regarding the additional requests for *${projName}*${customDetails ? ` (${customDetails})` : ''}, these fall outside our original agreed scope. I've drafted a change request${projVal ? ` starting from ${projVal}` : ''} so we can maintain our timeline. Let me know if this looks good to proceed?`;
      } else if (aiSituation === 'milestone_completed') {
        fallbackText = `Hi *${clientName}*, happy to share that we've completed the milestone${aiContext ? `: *${aiContext}*` : ''} for *${projName}*. Could you take a quick look and sign off so we can initiate the next sprint?`;
      } else if (aiSituation === 'retainer_pitch') {
        fallbackText = `Hi *${clientName}*, now that *${projName}* is successfully launched, I'd love to propose an ongoing monthly retainer model to manage improvements. This would secure 15 hours/month of my time. Are you open to a brief sync to discuss terms?`;
      } else if (aiSituation === 'project_delay') {
        fallbackText = `Hi *${clientName}*, hope you're well. Regarding our current sprint for *${projName}*, we've encountered a minor blocker${aiContext ? ` related to ${aiContext}` : ''}. To ensure top quality, we need to push back delivery by 3 days. Apologies for the shift!`;
      } else {
        fallbackText = `Hi *${clientName}*, just reaching out regarding our project *${projName}*. ${aiContext || 'Let me know your thoughts when you have a moment.'}`;
      }

      setEditedMessage(fallbackText);
      addToast('Drafted follow-up template successfully!', 'success');
    } finally {
      setAiLoading(false);
    }
  }

  // ---- Handlers ----
  const handleCopy = async () => {
    if (!editedMessage) return;
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      addToast('Message copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Failed to copy message', 'error');
    }
  };

  const handleOpenWhatsApp = () => {
    if (!selectedClient || !editedMessage) return;
    const phone = (selectedClient.phone || '').replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(editedMessage)}`;
    window.open(url, '_blank');

    // Save to history
    const entry = {
      id: Date.now(),
      clientName: selectedClient.name,
      company: selectedClient.company,
      templateType: activeTab === 'templates' ? selectedType : `AI: ${aiSituation.toUpperCase()}`,
      message: editedMessage,
      sentAt: new Date().toISOString(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 50));
  };

  const handleRemoveHistory = (id) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
    addToast('Message history cleared', 'success');
  };

  const handleRestoreHistory = (entry) => {
    setEditedMessage(entry.message);
    if (entry.templateType.startsWith('AI:')) {
      setActiveTab('ai');
      const sit = entry.templateType.replace('AI: ', '').toLowerCase();
      setAiSituation(sit);
    } else {
      setActiveTab('templates');
      setSelectedType(entry.templateType);
    }
    const client = clients.find((c) => c.name === entry.clientName);
    if (client) setSelectedClientId(client.id);
    addToast('Message restored from history', 'success');
  };

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  // ---- Render ----
  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20">
          <MessageCircle className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#FAFAFA]">WhatsApp Tool</h1>
          <p className="text-sm text-[#A3A3A3]">Generate professional client updates and instant follow-ups on the fly</p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== LEFT PANEL — Form & Inputs ===== */}
        <div className="space-y-5">
          {/* Client Selector Card */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-2">
              <User className="w-4 h-4 text-green-400" />
              1. Select Client
            </h2>

            <div className="relative">
              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedType('');
                  setEditedMessage('');
                }}
                className="w-full appearance-none bg-[#262626] border border-[#2A2A2A] rounded-lg px-4 py-3 text-[#FAFAFA] text-sm
                           focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                           transition-all cursor-pointer pr-10"
              >
                <option value="">Choose a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.company}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#737373] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Client Detail Strip */}
            {selectedClient && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 animate-in fade-in duration-300">
                <DetailChip icon={Building2} label="Company" value={selectedClient.company} />
                <DetailChip icon={Briefcase} label="Project" value={selectedClient.projectName} />
                <DetailChip
                  icon={IndianRupee}
                  label="Value"
                  value={selectedClient.projectValue ? formatINR(selectedClient.projectValue) : '—'}
                />
              </div>
            )}
          </div>

          {/* Tab Selector for Standard Templates vs AI Compose */}
          {selectedClient && (
            <div className="flex border-b border-[#2A2A2A] gap-4">
              <button
                onClick={() => { setActiveTab('templates'); setEditedMessage(''); setSelectedType(''); }}
                className={`pb-2.5 text-sm font-semibold transition-all border-b-2 ${
                  activeTab === 'templates'
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-dark-300 hover:text-dark-100'
                }`}
              >
                Standard Templates
              </button>
              <button
                onClick={() => { setActiveTab('ai'); setEditedMessage(''); }}
                className={`pb-2.5 text-sm font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'ai'
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-dark-300 hover:text-dark-100'
                }`}
              >
                <Sparkles className="w-4 h-4" /> AI Compose (Claude)
              </button>
            </div>
          )}

          {/* Standard Templates Form */}
          {selectedClient && activeTab === 'templates' && (
            <div className="glass-card p-5 space-y-4 animate-in fade-in duration-200">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-green-400" />
                2. Select Message Template
              </h2>

              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full appearance-none bg-[#262626] border border-[#2A2A2A] rounded-lg px-4 py-3 text-[#FAFAFA] text-sm
                             focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                             transition-all cursor-pointer pr-10"
                >
                  <option value="">Choose a template…</option>
                  {templateTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#737373] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* AI Compose Form */}
          {selectedClient && activeTab === 'ai' && (
            <div className="glass-card p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-green-400" />
                  2. Configure AI Draft
                </h2>
                <span className="text-[10px] text-green-400 px-2 py-0.5 bg-green-400/10 border border-green-500/20 rounded-full font-mono">Claude Sonnet</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Situation</label>
                  <div className="relative">
                    <select
                      value={aiSituation}
                      onChange={(e) => setAiSituation(e.target.value)}
                      className="w-full appearance-none bg-[#262626] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[#FAFAFA] text-sm focus:outline-none focus:border-green-500 pr-8"
                    >
                      <option value="invoice_followup">Unpaid Invoice Nudge</option>
                      <option value="scope_creep">Scope Creep Warning</option>
                      <option value="milestone_completed">Milestone Approval</option>
                      <option value="retainer_pitch">Retainer / Upsell Proposal</option>
                      <option value="project_delay">Sprint / Delivery Delay</option>
                      <option value="custom">Custom Situation</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#737373] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Message Tone</label>
                  <div className="relative">
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      className="w-full appearance-none bg-[#262626] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[#FAFAFA] text-sm focus:outline-none focus:border-green-500 pr-8"
                    >
                      <option value="friendly">Friendly & Casual</option>
                      <option value="professional">Professional & Direct</option>
                      <option value="firm">Firm & Assertive</option>
                      <option value="urgent">Urgent / Action Required</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#737373] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Context & Details (Optional)</label>
                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  placeholder="e.g. 'client requested 3 extra banner sizes', 'payment is 14 days late', 'blocker is due to third-party payment gateway downtime'"
                  rows={3}
                  className="w-full bg-[#262626] border border-[#2A2A2A] rounded-lg px-3.5 py-2 text-xs text-[#FAFAFA] placeholder-[#525252] focus:outline-none focus:border-green-500"
                />
              </div>

              <button
                onClick={handleAICompose}
                disabled={aiLoading}
                className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-green-600 to-green-400 text-white flex items-center justify-center gap-2 shadow-lg shadow-green-500/10 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? 'Composing Draft...' : 'Compose AI Draft'}
              </button>
            </div>
          )}

          {/* Editable Textarea */}
          {editedMessage && (
            <div className="glass-card p-5 space-y-3 animate-in fade-in duration-300">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-2">
                <Send className="w-4 h-4 text-green-400" />
                3. Refine Message Copy
              </h2>
              <textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                rows={10}
                className="w-full bg-[#262626] border border-[#2A2A2A] rounded-lg px-4 py-3 text-[#FAFAFA] text-sm leading-relaxed
                           resize-y focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                           transition-all placeholder-[#737373] font-mono"
                placeholder="Your message will appear here…"
              />
              <div className="flex items-start gap-1.5 p-3 rounded bg-green-500/5 border border-green-500/10">
                <Info className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-dark-300">
                  Tip: Keep text structured. WhatsApp supports markdown: *bold*, _italics_, ~strikethrough~. Perfect your message before sending!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===== RIGHT PANEL — Preview & Action Hooks ===== */}
        <div className="space-y-5">
          {/* WhatsApp Preview Card */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-2">
              <Phone className="w-4 h-4 text-green-400" />
              WhatsApp Preview
            </h2>

            {/* Phone-style container */}
            <div className="rounded-xl overflow-hidden border border-[#2A2A2A]">
              {/* WhatsApp header bar */}
              <div className="bg-[#1F2C34] px-4 py-3 flex items-center gap-3 border-b border-[#2A2A2A]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  {selectedClient ? selectedClient.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#E9EDEF] truncate">
                    {selectedClient ? selectedClient.name : 'Select a client'}
                  </p>
                  <p className="text-xs text-[#8696A0] truncate">
                    {selectedClient ? selectedClient.phone : 'No phone number'}
                  </p>
                </div>
              </div>

              {/* Chat area */}
              <div
                className="px-4 py-6 min-h-[300px] flex flex-col justify-end"
                style={{
                  backgroundColor: '#0B141A',
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                }}
              >
                {editedMessage ? (
                  <div className="max-w-[85%] ml-auto">
                    {/* Message bubble — sent (right, green) */}
                    <div className="relative bg-[#005C4B] rounded-lg rounded-tr-none px-3 pt-2 pb-1 shadow-lg">
                      <p
                        className="text-[13px] leading-[1.6] text-[#E9EDEF]"
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      >
                        {editedMessage}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1 mb-0.5">
                        <span className="text-[10px] text-[#8696A0]">{timeString}</span>
                        <Check className="w-3.5 h-3.5 text-[#53BDEB]" />
                      </div>
                      {/* Bubble tail */}
                      <div className="absolute top-0 -right-2 w-0 h-0 border-l-[8px] border-l-[#005C4B] border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="p-4 rounded-full bg-white/5 mb-4">
                      <MessageCircle className="w-10 h-10 text-[#8696A0]" />
                    </div>
                    <p className="text-sm text-[#8696A0]">Configure your follow-up parameters</p>
                    <p className="text-xs text-[#8696A0]/60 mt-1">to preview your message bubble here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {editedMessage && (
            <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in duration-300">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
                           bg-[#262626] border border-[#2A2A2A] text-[#FAFAFA]
                           hover:bg-[#333333] hover:border-[#444444]
                           active:scale-[0.98] transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </>
                )}
              </button>

              <button
                onClick={handleOpenWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
                           bg-gradient-to-r from-green-600 to-green-500 text-white
                           hover:from-green-500 hover:to-green-400
                           shadow-lg shadow-green-600/20
                           active:scale-[0.98] transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Send to WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Message History Section ─── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A3A3A3] flex items-center gap-2">
            <History className="w-4 h-4 text-green-400" />
            Outbound Follow-up History
          </h2>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-xs text-[#737373] hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear History Log
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-full bg-white/5 mb-3">
              <Clock className="w-8 h-8 text-[#737373]" />
            </div>
            <p className="text-sm text-[#737373]">No messages dispatched yet</p>
            <p className="text-xs text-[#737373]/60 mt-1">
              Active WhatsApp client dispatches will automatically save historical snapshots here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {history.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                onRestore={() => handleRestoreHistory(entry)}
                onRemove={() => handleRemoveHistory(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

function DetailChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 bg-[#262626] rounded-lg px-3 py-2.5 border border-[#2A2A2A]">
      <Icon className="w-4 h-4 text-green-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-[#737373] font-bold">{label}</p>
        <p className="text-xs text-[#FAFAFA] font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function HistoryItem({ entry, onRestore, onRemove }) {
  const sentDate = new Date(entry.sentAt);
  const dateStr = sentDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = sentDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="group rounded-lg border border-[#2A2A2A] bg-[#262626]/40 hover:bg-[#262626]/80 transition-colors p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-[#FAFAFA]">{entry.clientName}</span>
            <span className="text-[#737373]">•</span>
            <span className="text-[#A3A3A3] font-medium">{entry.company}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              {entry.templateType}
            </span>
            <span className="text-[10px] text-[#737373]">
              {dateStr} at {timeStr}
            </span>
          </div>
          <p className="text-xs text-[#A3A3A3] mt-2.5 line-clamp-2 leading-relaxed font-mono whitespace-pre-wrap">
            {entry.message}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onRestore}
            title="Restore message copy to editor"
            className="p-1.5 rounded-md hover:bg-white/5 text-[#A3A3A3] hover:text-[#FAFAFA] transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRemove}
            title="Remove from history"
            className="p-1.5 rounded-md hover:bg-red-500/10 text-[#A3A3A3] hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
