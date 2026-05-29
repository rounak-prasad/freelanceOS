-- ─────────────────────────────────────────────────────────────────────────
-- 0002_phase1_teams_billing_auth — Phase 1a enterprise features.
--
-- Adds three pillars on top of the foundation, all tenant-scoped where relevant:
--   • Teams      : workspace invitations (membership management reuses 0001).
--   • Billing    : per-workspace subscription + plan/status/seats.
--   • Auth (hard): email verification + password-reset tokens, refresh-token
--                  rotation, and an email_verified flag on users.
--
-- Dialect-neutral (TEXT / INTEGER, ISO-8601 timestamps, UUID string ids) so the
-- same SQL applies on SQLite (dev/test) and PostgreSQL (prod).
-- ─────────────────────────────────────────────────────────────────────────

-- Has the user confirmed their email? (0/1). Existing rows default to 0.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- ── Teams: invitations ────────────────────────────────────────────────────
-- An invite is a pending membership: an email + role + a single-use token whose
-- SHA-256 hash is stored (the raw token is emailed, never persisted).
CREATE TABLE IF NOT EXISTS invitations (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member',  -- admin|member|viewer (never owner)
  token_hash   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|revoked
  invited_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  accepted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_invitations_ws ON invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token_hash);

-- ── Billing: one subscription row per workspace ─────────────────────────────
-- Absence of a row == the Free plan. provider_* are populated when a real
-- Razorpay subscription backs the plan; null in local/test mode.
CREATE TABLE IF NOT EXISTS subscriptions (
  workspace_id             TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan                     TEXT NOT NULL DEFAULT 'free',   -- free|pro|team
  status                   TEXT NOT NULL DEFAULT 'active', -- active|trialing|past_due|halted|cancelled
  provider                 TEXT,                           -- 'razorpay' | null
  provider_subscription_id TEXT,
  provider_customer_id     TEXT,
  seats                    INTEGER NOT NULL DEFAULT 1,
  current_period_end       TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);

-- Append-only billing event log (provider webhooks + local transitions).
CREATE TABLE IF NOT EXISTS billing_events (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  provider     TEXT,
  event_type   TEXT NOT NULL,
  payload      TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_events_ws ON billing_events(workspace_id, created_at);

-- ── Auth hardening: email + refresh tokens ──────────────────────────────────
-- Single-use, time-boxed tokens for email verification and password reset.
-- Only the SHA-256 hash is stored; the raw token goes out by email.
CREATE TABLE IF NOT EXISTS email_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,        -- verify|reset
  token_hash  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_lookup ON email_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, kind);

-- Rotating refresh tokens: long-lived, single-use; rotation revokes the old one
-- and links it to its replacement so token theft is detectable.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT,
  replaced_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_refresh_lookup ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
