/**
 * agent.js — Agentic AI loop. The model is given workspace-scoped tools
 * (aiTools.js) and may call them to read the user's real data before answering.
 *
 * The model caller is injectable (`callModel`) so tests drive the loop with a
 * deterministic mock; production uses Anthropic's tool-use API behind
 * ANTHROPIC_API_KEY. All tool execution is scoped to the passed wsId, so the
 * agent can never read another tenant's data.
 */
import { TOOLS, runTool } from './aiTools.js';

const SYSTEM = `You are the FreelanceOS assistant for Indian freelancers. You can call tools to read THIS workspace's real data (invoices, clients, tax position). Be concise, practical and India-aware (GST, TDS, 44ADA, FIRA, advance tax). Use ₹ for amounts and cite concrete numbers from tool results. If a tool returns an error, say so plainly.`;

/** Real Anthropic tool-use caller → { stop_reason, content }. */
async function anthropicModel({ system, messages, tools }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { const e = new Error('AI not configured — set ANTHROPIC_API_KEY on the server'); e.status = 503; throw e; }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 800),
      system, messages, tools,
    }),
  });
  const data = await r.json();
  if (!r.ok) { const e = new Error(data?.error?.message || 'Anthropic request failed'); e.status = r.status; throw e; }
  return { stop_reason: data.stop_reason, content: data.content || [] };
}

/**
 * Run the agent loop until the model stops requesting tools (or maxRounds).
 * @returns {{text:string, toolsUsed:string[], rounds:number}}
 */
export async function runAgent({ db, wsId, message, history = [], callModel = anthropicModel, maxRounds = 5 }) {
  const messages = [...history, { role: 'user', content: String(message) }];
  const toolsUsed = [];
  let rounds = 0;

  while (rounds < maxRounds) {
    rounds++;
    const resp = await callModel({ system: SYSTEM, messages, tools: TOOLS });
    const content = resp.content || [];
    messages.push({ role: 'assistant', content });

    const toolUses = content.filter((b) => b && b.type === 'tool_use');
    if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const text = content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n').trim();
      return { text, toolsUsed, rounds };
    }

    const toolResults = [];
    for (const tu of toolUses) {
      toolsUsed.push(tu.name);
      let result;
      try { result = await runTool(db, wsId, tu.name, tu.input || {}); }
      catch (e) { result = { error: e.message }; }
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { text: "I couldn't finish that within the allowed number of steps — please narrow the question.", toolsUsed, rounds };
}

export default { runAgent };
