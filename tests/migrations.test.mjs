// Migrations: the runner applies all files once, is idempotent, and produces
// the expected tables/columns. Run: node tests/migrations.test.mjs
import { createMemoryDb } from '../server/db/index.js';
import { runMigrations, listMigrations } from '../server/db/migrate.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

console.log('— Migration runner —');
const db = createMemoryDb(); // createMemoryDb() already runs migrations on boot

const applied = db.all('SELECT id FROM schema_migrations ORDER BY id').map((r) => r.id);
ok('every migration file is recorded', applied.length === listMigrations().length && applied.length >= 2, JSON.stringify(applied));
ok('0001 + 0002 applied', applied.includes('0001_init.sql') && applied.includes('0002_phase1_teams_billing_auth.sql'));

const rerun = runMigrations(db);
ok('re-running applies nothing (idempotent)', rerun.ranNow.length === 0, JSON.stringify(rerun.ranNow));

console.log('— Schema shape —');
for (const t of ['users', 'workspaces', 'memberships', 'clients', 'invoices', 'invitations', 'subscriptions', 'billing_events', 'email_tokens', 'refresh_tokens', 'audit_log']) {
  const row = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [t]);
  ok(`table exists: ${t}`, !!row);
}
const userCols = db.all("PRAGMA table_info('users')").map((c) => c.name);
ok('users.email_verified column added by 0002', userCols.includes('email_verified'));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
