/**
 * AI assistant proxy — fixes the broken client-side widget.
 *
 * The old AIChatWidget called api.anthropic.com directly from the browser with
 * no auth headers, so it ALWAYS failed (401/CORS) and fell back to a canned
 * reply. Worse, any real key would have been exposed to users. This server
 * route holds the key safely and adds the required headers.
 *
 * POST /api/ai/chat  { messages:[{role,content}], system?:string }
 */
import { Router } from 'express';

const router = Router();
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';

router.post('/chat', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: 'AI not configured',
      hint: 'Set ANTHROPIC_API_KEY in the server environment to enable the assistant.',
    });
  }

  const { messages = [], system = '' } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] required' });
  }

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 600),
        system: system || 'You are the FreelanceOS assistant for Indian freelancers. Be concise, practical and India-aware (GST, TDS, 44ADA, FIRA).',
        messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })),
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || 'Anthropic request failed' });
    }
    const text = Array.isArray(data.content) ? data.content.map((c) => c.text || '').join('\n').trim() : '';
    res.json({ text, model: MODEL, usage: data.usage });
  } catch (e) {
    res.status(502).json({ error: 'Upstream AI error: ' + e.message });
  }
});

export default router;
