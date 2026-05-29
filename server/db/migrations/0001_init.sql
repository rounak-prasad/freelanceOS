-- ─────────────────────────────────────────────────────────────────────────
-- 0001_init — FreelanceOS relational schema (v2 "enterprise foundation").
--
-- This is the baseline migration: it reproduces the original schema exactly so
-- existing databases (which already have these tables from the pre-migrations
-- boot path) are a no-op, while fresh databases get the full foundation.
--
-- Dialect: SQLite (Node built-in `node:sqlite`) for dev/test — zero install.
-- Production target: PostgreSQL. The schema is deliberately dialect-neutral:
--   • IDs are UUID strings (crypto.randomUUID) — no SERIAL/AUTOINCREMENT drift.
--   • Timestamps are ISO-8601 TEXT — portable across engines.
--   • Money is stored as INTEGER MINOR UNITS (paise) — no floating-point error.
-- To run on Postgres: INTEGER→BIGINT for *_minor, REAL→DOUBLE PRECISION, and
-- the `?` placeholders are translated to `$n` in db/index.js. See SETUP.md.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- A workspace is the TENANT boundary: one freelancer's business (and, later,
-- their team). All business data is scoped to a workspace_id.
CREATE TABLE IF NOT EXISTS workspaces (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  owner_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_name     TEXT,
  gstin          TEXT,
  pan            TEXT,
  state_code     TEXT,           -- GST state code of the supplier (e.g. '29')
  profession_key TEXT,           -- drives the 44ADA eligibility guardrail
  has_lut        INTEGER NOT NULL DEFAULT 0,  -- filed Letter of Undertaking?
  gst_registered INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- Membership = user ↔ workspace with a role (RBAC). Owner is created on signup.
CREATE TABLE IF NOT EXISTS memberships (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'owner',   -- owner|admin|member|viewer
  created_at   TEXT NOT NULL,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  company      TEXT,
  gstin        TEXT,
  state_code   TEXT,
  country      TEXT NOT NULL DEFAULT 'IN',
  is_export    INTEGER NOT NULL DEFAULT 0,   -- foreign client → export of service
  notes        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_ws ON clients(workspace_id);

CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id       TEXT REFERENCES clients(id) ON DELETE SET NULL,
  number          TEXT NOT NULL,
  issue_date      TEXT,
  due_date        TEXT,
  currency        TEXT NOT NULL DEFAULT 'INR',
  fx_rate         REAL NOT NULL DEFAULT 1,    -- currency → INR at issue time
  is_export       INTEGER NOT NULL DEFAULT 0,
  same_state      INTEGER NOT NULL DEFAULT 1,
  place_of_supply TEXT,
  gst_rate        REAL NOT NULL DEFAULT 0.18,
  subtotal_minor  INTEGER NOT NULL DEFAULT 0,
  cgst_minor      INTEGER NOT NULL DEFAULT 0,
  sgst_minor      INTEGER NOT NULL DEFAULT 0,
  igst_minor      INTEGER NOT NULL DEFAULT 0,
  total_minor     INTEGER NOT NULL DEFAULT 0,
  zero_rated      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft|sent|paid|overdue|cancelled
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (workspace_id, number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_ws ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id               TEXT PRIMARY KEY,
  invoice_id       TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  quantity         REAL NOT NULL DEFAULT 1,
  unit_price_minor INTEGER NOT NULL DEFAULT 0,
  amount_minor     INTEGER NOT NULL DEFAULT 0,
  position         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);

-- Bridge table: the existing single-blob app state, now stored per-workspace in
-- the DB behind auth. Lets every legacy page keep working under real
-- multi-tenancy while entities are migrated to first-class tables one by one.
CREATE TABLE IF NOT EXISTS app_state (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  data         TEXT NOT NULL DEFAULT '{}',
  updated_at   TEXT NOT NULL
);

-- Append-only audit trail (enterprise requirement: who did what, when).
CREATE TABLE IF NOT EXISTS audit_log (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT,
  user_id      TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  ip           TEXT,
  meta         TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_ws ON audit_log(workspace_id, created_at);
