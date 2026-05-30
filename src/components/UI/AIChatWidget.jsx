// ==========================================
// FreelanceOS — Floating AI Data Assistant
// ==========================================
// NOTE: This widget now calls the FreelanceOS API proxy (/api/ai/chat) instead
// of hitting api.anthropic.com directly from the browser. The old approach sent
// no auth headers (so it ALWAYS failed and showed the fallback) and would have
// exposed any API key to users. The key now lives safely on the server
// (server/routes/ai.js). Set ANTHROPIC_API_KEY there to enable it.
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { formatINR, calculateGST, getCurrentFY } from '../../utils/helpers';
import { apiPost } from '../../services/apiClient';
import APP_CONFIG from '../../config/appConfig.js';
import { MessageSquare, Sparkles, Send, X, ArrowDown, Bot, Loader2 } from 'lucide-react';

export default function AIChatWidget() {
  const { state, addToast } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  function closeChat() {
    setIsOpen(false);
    setMessages([]);
    setInput('');
  }

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Pre-calculate all state aggregates to pass as rich context to Claude
  const richDataContext = useMemo(() => {
    if (!state) return {};

    const invoices = state.invoices || [];
    const clients = state.clients || [];
    const milestoneProjects = state.milestoneProjects || [];
    const recurring = state.recurringSchedules || [];
    const changeRequests = state.changeRequests || [];

    const totalClients = clients.length;
    const totalInvoices = invoices.length;

    // Earned
    const totalEarned = invoices
      .filter(i => i.status === 'Paid')
      .reduce((s, i) => s + (i.total || 0), 0);

    // Outstanding
    const totalOutstanding = invoices
      .filter(i => i.status !== 'Paid')
      .reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);

    // Overdue
    const today = new Date();
    today.setHours(0,0,0,0);
    const overdueAmount = invoices
      .filter(i => i.status !== 'Paid' && i.dueDate && new Date(i.dueDate) < today)
      .reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);

    // Active projects
    const activeMilestones = milestoneProjects.length;

    // Active retainers
    const activeRecurring = recurring.filter(r => r.isActive).length;

    // This month revenue
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const thisMonthRevenue = invoices
      .filter(i => {
        const idate = new Date(i.date);
        return idate.getMonth() === currentMonth && idate.getFullYear() === currentYear;
      })
      .reduce((s, i) => s + i.total, 0);

    // Top client
    const clientSums = {};
    invoices.forEach(inv => {
      clientSums[inv.clientName] = (clientSums[inv.clientName] || 0) + inv.total;
    });
    let topClientName = 'N/A';
    let topClientRevenue = 0;
    Object.entries(clientSums).forEach(([name, amt]) => {
      if (amt > topClientRevenue) {
        topClientRevenue = amt;
        topClientName = name;
      }
    });

    // Clients with overdue
    const overdueClients = [
      ...new Set(
        invoices
          .filter(i => i.status !== 'Paid' && i.dueDate && new Date(i.dueDate) < today)
          .map(i => i.clientName)
      )
    ];

    // Change Requests
    const pendingCRsCount = changeRequests.filter(cr => cr.status === 'Pending').length;
    const unbilledCRValue = changeRequests.filter(cr => cr.status === 'Approved').reduce((s, cr) => s + cr.estimatedAmount, 0);

    // Next recurring due
    const activeSchedules = recurring.filter(s => s.isActive && s.nextDueDate).sort((a,b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
    const nextRecurringDue = activeSchedules.length > 0
      ? `${activeSchedules[0].clientName} (₹${activeSchedules[0].amount} due on ${new Date(activeSchedules[0].nextDueDate).toLocaleDateString('en-IN')})`
      : 'None scheduled';

    // TDS
    const fy = getCurrentFY();
    const fyStart = new Date(fy.start, 3, 1);
    const recordedTDS = (state.tdsEntries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const estimatedTDS = invoices
      .filter(i => i.status === 'Paid' && new Date(i.date) >= fyStart && i.notes && i.notes.toLowerCase().includes('tds'))
      .reduce((s, i) => s + (i.total * 0.10), 0); // 10% TDS est
    const totalTDS = recordedTDS || estimatedTDS;

    return {
      totalClients,
      totalInvoices,
      totalEarned,
      totalOutstanding,
      overdueAmount,
      activeMilestones,
      activeRecurring,
      thisMonthRevenue,
      topClientName,
      topClientRevenue,
      overdueClients,
      pendingCRsCount,
      unbilledCRValue,
      nextRecurringDue,
      totalTDS,
      monthlyGoal: state.revenueGoals?.monthly || state.settings?.revenueGoals?.monthly || 150000
    };
  }, [state]);

  const promptChips = [
    { label: "Which client owes me the most?", value: "Which client owes me the most money currently? Provide exact amounts and invoice numbers." },
    { label: "Am I on track for my monthly goal?", value: "Am I on track to meet my monthly revenue goal? Tell me how much I have earned this month versus my target." },
    { label: "How much TDS will I lose this quarter?", value: "How much TDS will I lose this quarter? Use recorded TDS and invoice history where available." },
    { label: "What should I do this week to improve cash flow?", value: "What should I do this week to improve cash flow? Prioritize overdue invoices, retainers, and scope creep." },
    { label: "Which invoices should I follow up on today?", value: "Which invoices should I follow up on today? Include client names, invoice numbers, days overdue, and exact amounts." },
  ];

  async function handleSend(textToSend) {
    const text = textToSend || input;
    if (!text.trim()) return;

    // Append user message
    const userMessage = { id: Date.now(), role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const systemContext = `You are the AI assistant for FreelanceOS India.
You have access to this freelancer's real business data.

CURRENT DATA SUMMARY:
- Total clients: ${richDataContext.totalClients}
- Total invoices: ${richDataContext.totalInvoices}
- Total earned (paid invoices): ${formatINR(richDataContext.totalEarned)}
- Outstanding amount: ${formatINR(richDataContext.totalOutstanding)}
- Overdue amount: ${formatINR(richDataContext.overdueAmount)}
- Active milestone projects: ${richDataContext.activeMilestones}
- Active recurring schedules: ${richDataContext.activeRecurring}
- This month revenue: ${formatINR(richDataContext.thisMonthRevenue)} vs monthly goal of ${formatINR(richDataContext.monthlyGoal)}
- Top client by revenue: ${richDataContext.topClientName} (${formatINR(richDataContext.topClientRevenue)})
- Clients with overdue invoices: ${richDataContext.overdueClients?.join(', ') || 'None'}
- Pending change requests: ${richDataContext.pendingCRsCount}
- Unbilled approved CRs value: ${formatINR(richDataContext.unbilledCRValue)}
- Next recurring invoice due: ${richDataContext.nextRecurringDue}
- Tax: TDS deducted this FY (est): ${formatINR(richDataContext.totalTDS)}

Answer the user's question using this data. Be specific with numbers.
Be India-aware (GST, TDS, 44ADA, FIRA, advance tax).
Keep answers under 80 words unless the question requires more detail.
Respond in a helpful, direct tone. Use ₹ symbol for amounts.`;

    const chatHistory = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      // Cloud mode (authenticated): use the agentic endpoint — it reads THIS
      // workspace's data via secure server-side tools. Local mode keeps the
      // data-context /chat proxy.
      let textResponse;
      if (APP_CONFIG.requireAuth) {
        const data = await apiPost('/ai/agent', { message: text, history: chatHistory });
        textResponse = (data.text || '').trim();
      } else {
        const data = await apiPost('/ai/chat', {
          system: systemContext,
          messages: [...chatHistory, { role: 'user', content: text }],
        });
        textResponse = (data.text || '').trim();
      }
      textResponse = textResponse || "I couldn't generate a response just now. Try rephrasing your question.";
      const assistantMessage = { id: Date.now() + 1, role: 'assistant', content: textResponse };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const notConfigured = error && error.status === 503;
      const intro = notConfigured
        ? `The AI assistant isn't configured yet — add ANTHROPIC_API_KEY on the API server to switch it on. Meanwhile, from your live data: `
        : `I hit a connection issue reaching the assistant. From your live data: `;
      const fallbackResponse = `${intro}outstanding is **${formatINR(richDataContext.totalOutstanding)}** (with **${formatINR(richDataContext.overdueAmount)}** overdue), and you've earned **${formatINR(richDataContext.thisMonthRevenue)}** this month against a **${formatINR(richDataContext.monthlyGoal)}** target.`;
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: fallbackResponse }]);
      addToast(notConfigured ? 'AI not configured — showing a data snapshot.' : 'AI connection issue — showing a data snapshot.', 'warning');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => (isOpen ? closeChat() : setIsOpen(true))}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:shadow-accent/40 active:scale-95 transition-all duration-300 z-[9999] border border-white/10 no-print"
        title="Ask AI Data Assistant"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
      </button>

      {/* Sliding Panel */}
      {isOpen && (
        <div className="fixed bottom-22 right-6 w-[360px] h-[520px] bg-[#111111]/95 backdrop-blur-md border border-[#2A2A2A] rounded-xl shadow-2xl flex flex-col overflow-hidden z-[9999] animate-scale-in no-print font-sans">

          {/* Panel Header */}
          <div className="p-4 border-b border-dark-600/60 bg-dark-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-accent" />
              <div>
                <h3 className="text-xs font-bold text-dark-50">OS Financial Assistant</h3>
                <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Online • Realtime Vitals
                </span>
              </div>
            </div>
            <button onClick={closeChat} className="text-dark-400 hover:text-dark-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat History Panel */}
          <div className="flex-1 p-4 overflow-y-auto custom-scroll space-y-3.5 bg-dark-900/30">
            {messages.length === 0 && (
              <div className="space-y-4 py-4">
                <div className="text-center space-y-1">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                  </div>
                  <h4 className="text-xs font-bold text-dark-100">Ask anything about your business</h4>
                  <p className="text-[10px] text-dark-400 max-w-[220px] mx-auto leading-relaxed">
                    I have access to your live invoices, milestone projects, retainers, and Indian tax summaries.
                  </p>
                </div>

                {/* Prompt chips */}
                <div className="space-y-2 pt-2">
                  <span className="text-[9px] uppercase tracking-wider text-dark-400 font-bold block mb-1">Suggested Inquiries</span>
                  {promptChips.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(chip.value)}
                      className="w-full text-left p-2.5 bg-dark-850 hover:bg-dark-800 border border-dark-600/30 text-dark-200 hover:text-dark-50 text-[11px] rounded-lg transition-all focus:outline-none"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-accent text-white rounded-tr-none font-medium'
                      : 'bg-dark-800 border border-dark-600/40 text-dark-50 rounded-tl-none font-sans'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-dark-800 border border-dark-600/40 text-dark-400 rounded-xl rounded-tl-none p-3 text-xs flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  <span>Analyzing ledger registers...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-dark-600/60 bg-dark-950/20 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about goals, tax, overdues..."
              className="flex-1 bg-dark-900 border-dark-600/80 rounded-lg text-xs"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shadow hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}
    </>
  );
}
