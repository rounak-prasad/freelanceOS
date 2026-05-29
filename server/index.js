/**
 * FreelanceOS API server.
 *
 * Holds the integration code that CANNOT run in the browser because it needs
 * secret keys: the AI assistant proxy (Anthropic), payments (Razorpay) and
 * cross-border helpers. The Vite dev server proxies /api/* here (see
 * vite.config.js). In production, deploy this behind the same domain or set
 * VITE_API_BASE in the frontend.
 *
 * Every route degrades gracefully: with no keys configured it returns a clear
 * 503 so the UI can fall back (e.g. to UPI links or the canned AI reply)
 * instead of crashing.
 *
 * Run:  npm run server   (or  npm run dev:all  to run API + Vite together)
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import aiRouter from './routes/ai.js';
import paymentsRouter from './routes/payments.js';
import crossborderRouter from './routes/crossborder.js';
import { stateStore } from './lib/store.js';

dotenv.config();

const app = express();
// Razorpay webhook needs the raw body for signature verification — capture it.
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
  limit: '2mb',
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'freelanceos-api',
    integrations: {
      ai: Boolean(process.env.ANTHROPIC_API_KEY),
      razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    },
    time: new Date().toISOString(),
  });
});

// Optional persistence backend for the HTTP data adapter (VITE_DATA_BACKEND=http).
// File-backed by default; swap stateStore for a real DB in production.
app.get('/api/state', async (req, res) => {
  res.json((await stateStore.get(req.query.userId || 'default')) || {});
});
app.put('/api/state', async (req, res) => {
  await stateStore.set(req.query.userId || 'default', req.body);
  res.json({ ok: true });
});
app.delete('/api/state', async (req, res) => {
  await stateStore.clear(req.query.userId || 'default');
  res.json({ ok: true });
});

app.use('/api/ai', aiRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/crossborder', crossborderRouter);

app.use((err, _req, res, _next) => {
  console.error('[api] error:', err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`FreelanceOS API on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log('  • AI: set ANTHROPIC_API_KEY to enable the assistant');
  if (!process.env.RAZORPAY_KEY_ID) console.log('  • Payments: set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to enable Razorpay');
});

export default app;
