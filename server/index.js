/**
 * FreelanceOS API server.
 *
 * v2 "enterprise foundation": real authentication, a relational multi-tenant
 * database, and tenant-scoped Clients/Invoices APIs — alongside the original
 * key-bearing integrations (AI proxy, Razorpay payments, cross-border helpers).
 *
 * Dev/test runs on Node's built-in SQLite (zero install). Set DATABASE_URL to a
 * Postgres connection string for production (see server/db/index.js + SETUP.md).
 *
 * Run:  npm run server   (or  npm run dev:all  to run API + Vite together)
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import aiRouter from './routes/ai.js';
import paymentsRouter from './routes/payments.js';
import crossborderRouter from './routes/crossborder.js';
import authRouter from './routes/auth.js';
import clientsRouter from './routes/clients.js';
import invoicesRouter from './routes/invoices.js';
import stateRouter from './routes/state.js';
import membersRouter, { acceptRouter } from './routes/members.js';
import billingRouter, { webhookRouter as billingWebhookRouter } from './routes/billing.js';
import gstRouter from './routes/gst.js';
import accountRouter from './routes/account.js';
import adminRouter from './routes/admin.js';

import { getDb, initDb } from './db/index.js';
import { HttpError } from './lib/validate.js';
import { jwtSecret } from './lib/authMiddleware.js';
import { securityHeaders, enforceJsonObject } from './lib/security.js';
import { isEncryptionEnabled } from './lib/crypto.js';

dotenv.config();

// Open + migrate the database on boot (idempotent). Async (Phase 1b) so the
// same path works for SQLite (dev/test) and Postgres (prod, via DATABASE_URL).
await initDb();

const app = express();
app.set('trust proxy', 1); // so req.ip is correct behind a proxy/load balancer
app.disable('x-powered-by');
app.use(securityHeaders); // security headers on every response (Phase 3)

// Razorpay webhook needs the raw body for signature verification — capture it.
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
  limit: '2mb',
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(enforceJsonObject); // reject non-object JSON bodies on mutations

/* ---- Minimal in-memory rate limiter for auth (swap for Redis in prod) ---- */
const rl = new Map();
function rateLimit({ windowMs = 5 * 60 * 1000, max = 30 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const hit = rl.get(key) || { count: 0, reset: now + windowMs };
    if (now > hit.reset) { hit.count = 0; hit.reset = now + windowMs; }
    hit.count += 1;
    rl.set(key, hit);
    if (hit.count > max) {
      return res.status(429).json({ error: 'Too many requests — please slow down and try again shortly.' });
    }
    next();
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'freelanceos-api',
    version: '2.4.0',
    db: getDb().engine,
    encryptionAtRest: isEncryptionEnabled(),
    integrations: {
      ai: Boolean(process.env.ANTHROPIC_API_KEY),
      razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      billingWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      irp: Boolean(process.env.IRP_BASE_URL && process.env.IRP_API_KEY),
    },
    time: new Date().toISOString(),
  });
});

// Auth + tenant-scoped business APIs
app.use('/api/auth', rateLimit({ max: 30 }), authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/state', stateRouter);

// Teams (member management + invitations) and the invite-acceptance endpoint.
app.use('/api/team', membersRouter);
app.use('/api/invitations', acceptRouter);

// Billing: public, signature-verified webhook mounted BEFORE the authed router
// so it isn't gated by requireAuth.
app.use('/api/billing/webhook', billingWebhookRouter);
app.use('/api/billing', billingRouter);

// GST e-invoicing, e-way bill and GSTR-1 filing.
app.use('/api/gst', gstRouter);

// Account (DPDP/GDPR export + erasure) and workspace admin (audit log, backup).
app.use('/api/account', rateLimit({ max: 30 }), accountRouter);
app.use('/api/admin', adminRouter);

// Key-bearing integrations
app.use('/api/ai', aiRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/crossborder', crossborderRouter);

// Central error handler — maps HttpError.status, hides internals on 500.
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  // Honour a numeric `status` on plain errors (e.g. enforceJsonObject, agent 503).
  if (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600) {
    return res.status(err.status).json({ error: err.message || 'Request failed' });
  }
  console.error('[api] error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 8787;

// Only listen when run directly (not when imported by tests).
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`FreelanceOS API on http://localhost:${PORT}  (db: ${getDb().engine})`);
    if (jwtSecret() === 'dev-insecure-secret-change-me') {
      console.log('  ⚠  JWT_SECRET is unset — using an insecure dev secret. Set JWT_SECRET in production.');
    }
    if (!process.env.ANTHROPIC_API_KEY) console.log('  • AI: set ANTHROPIC_API_KEY to enable the assistant');
    if (!process.env.RAZORPAY_KEY_ID) console.log('  • Payments: set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to enable Razorpay');
  });
}

export default app;
