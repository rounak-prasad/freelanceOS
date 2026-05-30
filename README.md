# FreelanceOS

**The money & compliance operating system for Indian freelancers.**

Every other tool — global (Bonsai, HoneyBook, FreshBooks) or Indian (Refrens,
Zoho, Skydo) — solves a slice. Indian freelancers stitch together 5–7 tools per
payment cycle and lose ₹5,000+ per $1,000 to friction no invoice ever shows.
FreelanceOS is built to be the first product that treats the Indian freelancer
as a one-person business operating inside India's own legal and financial
infrastructure — GST, TDS, FIRC, 44ADA, UPI and cross-border.

## Highlights

- 🧾 **GST invoicing done right** — including zero-rated export of services under LUT.
- 🛡️ **Compliance Guard** — proactive warnings for the 44ADA, Schedule FA, RCM and GST traps, read from your own data. No other tool does this.
- 🌐 **Cross-Border & FIRA** — FX-leakage calculator, foreign-account register, and a remittance + FIRA tracker with RBI purpose codes.
- 📈 **Cash-Flow Forecast** — feast-or-famine projection with advance-tax overlay and a "invoice ₹X by Y" answer.
- 💸 **Real payment rails** — Razorpay payment links/orders + a no-key UPI deep-link/QR on every invoice.
- 🤖 **AI assistant** — now via a secure server proxy (the old browser-side widget could never work).
- 🗂️ Plus the full suite: clients, projects, milestones, proposals, contracts, time tracking, expenses, reports.
- 🔐 **Enterprise foundation (v2)** — real accounts (scrypt + JWT), a relational
  multi-tenant database (workspace-scoped, audit-logged), and tenant-scoped
  Clients/Invoices APIs with server-side GST. Zero-config local mode still works.
- 👥 **Teams & RBAC (v2.1)** — invite teammates by email, owner/admin/member/viewer
  roles enforced on every API, last-owner protection, and a Team management screen.
- 💳 **Subscription billing (v2.1)** — Free / Pro / Team plans with live usage
  limits and feature gating, a Razorpay Subscriptions adapter + signed webhook,
  and a Billing & Plan screen. Runs in test mode until you add Razorpay keys.
- 🔑 **Account security (v2.1)** — email verification, password reset, and
  rotating refresh tokens (reuse-detection) on top of the existing auth.
- 🧱 **Versioned DB migrations (v2.1)** — ordered, tracked, idempotent migrations
  (`server/db/migrations/`) replace the single-schema boot; Postgres-ready.
- 🐘 **Postgres-ready data layer (v2.2)** — one fully-async data layer runs
  unchanged on zero-install SQLite (dev/test) and PostgreSQL (prod, via
  `DATABASE_URL`); the same test suite validates both engines.
- 🧾 **GST e-invoicing & GSTR-1 (v2.3)** — generate IRNs (NIC e-invoice JSON +
  signed QR) and e-way bills through an IRP/GSP adapter (deterministic sandbox
  without credentials), and export a filing-ready GSTR-1 JSON (b2b/b2cl/b2cs/exp).
- 🤖 **Agentic AI (v2.3)** — the assistant calls workspace-scoped tools over your
  real data (financials, overdue invoices, GST preview, compliance flags); gated
  to paid plans, mock-tested, and live with an Anthropic key.

## Tech

React 18 · Vite 6 · Tailwind · React Router · Recharts — with a backend-ready
data layer and an Express API server for key-bearing integrations.

## Run it

```bash
npm install
npm run dev          # app on localStorage + sample data, zero config
npm run dev:all      # also starts the API server (auth / teams / billing / AI / payments)
npm test             # 180 assertions: tax, multi-tenancy, migrations, teams, billing, auth, pg, e-invoice/GSTR-1, AI agent
```

See **[SETUP.md](./SETUP.md)** for architecture, environment variables and what
changed in this release.

> Tax/GST/TDS/FEMA logic is decision-support, not professional advice. Verify
> with a CA before filing. Rules are versioned in `src/config/taxRules.js`.
