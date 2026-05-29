# FreelanceOS — Setup & Architecture

FreelanceOS is the money & compliance operating system for Indian freelancers.
This release adds a backend-ready data layer, fixes the tax-engine correctness
bugs, and ships the India-compliance moat: proactive guardrails, a cross-border
+ FIRA tracker, real payment rails, and an irregular-income cash-flow forecast.

## Quick start (zero config)

```bash
npm install
npm run dev        # http://localhost:5173 — runs fully on localStorage + sample data
```

Nothing else is required to explore the product. The AI assistant, payments,
and auto-FIRA stay dormant until you add keys (below) — everything else works.

## Run the API server (AI, payments, cross-border)

The browser cannot safely hold secret keys, so those integrations live in a
small Express server under `server/`.

```bash
cp .env.example .env     # fill in the keys you have
npm run server           # API on http://localhost:8787
# or run BOTH together:
npm run dev:all
```

The Vite dev server proxies `/api/*` to the API automatically (see
`vite.config.js`). In production, host the API behind the same domain or set
`VITE_API_BASE`.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_DATA_BACKEND` | `local` (default) or `http` to use the API state store |
| `VITE_API_BASE` | API origin if not same-domain (e.g. `http://localhost:8787`) |
| `ANTHROPIC_API_KEY` | Enables the AI assistant (server proxy) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Payment Links & Orders |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies the paid-status webhook |
| `SKYDO_API_KEY` / `WISE_API_TOKEN` | Optional cross-border / auto-FIRA partners |

See `.env.example` for the full list.

## Architecture — the backend-ready data layer

Persistence is now behind an adapter seam (`src/services/persistence.js`):

- **LocalStorageAdapter** (default): today's behaviour — one JSON blob in the
  browser. Zero setup, offline-friendly.
- **HttpAdapter**: same shape, but reads/writes the API at `/api/state`
  (file-backed in dev via `server/lib/store.js`; swap for Postgres/Supabase in
  production). Flip `VITE_DATA_BACKEND=http` and the backend drops in with no
  app changes.

`DataContext` only calls `loadState()` / `saveState()` / `clearState()`.

## What changed in this release

**Correctness**
- GST: export of services under LUT is now **zero-rated** (was incorrectly
  charged a flat 18%). Per-client export flag drives the calculation.
- Advance tax: now uses the **slab engine** (`computeIncomeTax`) instead of a
  flat 30% of revenue.
- All tax rules live in one versioned, date-stamped module
  (`src/config/taxRules.js`) — update once a year, every screen stays correct.

**New — the India compliance moat**
- **Compliance Guard** (`/guardrails`): proactive warnings for 44ADA
  ineligibility, the Schedule FA trap, RCM on foreign SaaS, GST thresholds and
  advance-tax due dates — read from your own data.
- **Cross-Border & FIRA** (`/cross-border`): FX-leakage calculator across
  rails, foreign-account register (feeds Schedule FA), and a remittance + FIRA
  tracker with RBI purpose codes.
- **Cash-Flow Forecast** (`/cash-flow`): feast-or-famine projection from
  invoices + retainers + weighted pipeline, with advance-tax overlay and a
  "how much to invoice by when" answer.

**Real integrations (env-wired)**
- AI assistant now calls a **server proxy** (`server/routes/ai.js`) with the key
  held safely — the old widget called Anthropic from the browser with no auth
  and always failed.
- **Razorpay** payment links / orders / webhook (`server/routes/payments.js`),
  plus a no-key **UPI deep-link / QR** helper on every invoice.

## Tests

```bash
node tests/logic.test.mjs   # 34 assertions over tax, GST, advance tax, guardrails, FX, cash-flow
```

## Disclaimer

Tax, GST, TDS, FEMA and FIRA logic is decision-support, **not** professional
advice, and is research-grade as of the date in `src/config/taxRules.js`
(`LAST_VERIFIED`). Confirm with a qualified CA before filing.
