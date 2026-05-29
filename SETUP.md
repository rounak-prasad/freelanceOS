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

## v2 — Enterprise foundation (auth + multi-tenant database)

The prototype stored everything as a single JSON blob (localStorage, or one
file per user) with no accounts. v2 adds the foundation an enterprise product
needs, **without breaking the zero-config local experience**:

- **Authentication** — email/password with `scrypt` hashing and HS256 JWT
  sessions (`server/lib/auth.js`). No new dependencies; swap in
  `argon2`/`jsonwebtoken` later without touching call sites.
- **Relational, multi-tenant database** (`server/db/`) — real tables
  (`users`, `workspaces`, `memberships`, `clients`, `invoices`,
  `invoice_items`, `app_state`, `audit_log`). The **workspace** is the tenant
  boundary; every business query is scoped to `workspace_id` in the repo layer
  (`server/db/repos.js`), so one tenant can never read another's data.
- **Tenant-scoped REST APIs** — `/api/auth`, `/api/clients`, `/api/invoices`
  behind `requireAuth` + `resolveWorkspace`. GST is computed **server-side**
  via the shared tax engine (never trusted from the client).
- **Audit log + RBAC + auth rate-limiting** — the enterprise basics.
- Money is stored in **integer minor units (paise)** to avoid float drift.

### Enable it

```bash
cp .env.example .env
# set JWT_SECRET to a long random string
echo "VITE_DATA_BACKEND=http" >> .env   # turns on the DB backend + login
npm run dev:all
```

In local mode (default) auth is bypassed and the app runs exactly as before.
When `VITE_DATA_BACKEND=http` (or `VITE_REQUIRE_AUTH=true`), the app gates on a
real session and each workspace's data lives in the database.

### Dev database

Dev/test uses Node 24's built-in `node:sqlite` — **zero install**. The schema
auto-applies on boot (`server/db/schema.sql`, all `CREATE … IF NOT EXISTS`).
The file lives at `server/.data/freelanceos.sqlite` (override with `SQLITE_PATH`).

### Moving to Postgres (production)

The schema is deliberately dialect-neutral (UUID string ids, ISO-8601 text
timestamps, integer money). A Postgres adapter is included in
`server/db/index.js` (`createPostgresDb`) and translates `?` → `$n`. Because it
is async, the swap is: (1) set `DATABASE_URL`, (2) make the `repos.js` functions
and their callers `await` the db calls, (3) run `schema.sql` (INTEGER→BIGINT for
`*_minor`, REAL→DOUBLE PRECISION). The route/repo contracts do not change.

## Tests

```bash
npm test                       # runs both suites below
node tests/logic.test.mjs      # 34 assertions: tax, GST, advance tax, guardrails, FX, cash-flow
node tests/foundation.test.mjs # 26 assertions: password hashing, JWT, multi-tenant
                               # isolation, per-tenant state, server-side GST, auth guard
```

## Disclaimer

Tax, GST, TDS, FEMA and FIRA logic is decision-support, **not** professional
advice, and is research-grade as of the date in `src/config/taxRules.js`
(`LAST_VERIFIED`). Confirm with a qualified CA before filing.
