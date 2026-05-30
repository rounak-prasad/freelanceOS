/**
 * migrate.js — Tiny, dependency-free migration runner.
 *
 * Ordered, tracked migrations (the enterprise baseline for evolving a schema):
 *   • Migrations live in server/db/migrations/NNNN_name.sql, run in filename
 *     order (zero-padded numeric prefix).
 *   • Applied migrations are recorded in schema_migrations → each runs exactly
 *     once; idempotent across reboots and safe on a database created by the
 *     pre-migrations boot path (0001 is all CREATE IF NOT EXISTS, so it no-ops).
 *   • Each migration runs inside a transaction: a failure rolls back and is NOT
 *     recorded, so it retries on the next boot.
 *
 * Uses the same async { run, get, all, exec, tx } interface as the rest of the
 * data layer, so it applies unchanged to SQLite (dev/test) and Postgres (prod).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/** List migration filenames in apply order. */
export function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 0001_… < 0002_… lexicographically (zero-padded prefixes)
}

/**
 * Apply all pending migrations. Returns { ranNow, alreadyApplied } so callers
 * (boot logs, tests) can see what happened.
 */
export async function runMigrations(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);

  const rows = await db.all('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.id));
  const ranNow = [];

  for (const file of listMigrations()) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.tx(async (tx) => {
      await tx.exec(sql);
      await tx.run('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [file, new Date().toISOString()]);
    });
    ranNow.push(file);
  }

  return { ranNow, alreadyApplied: [...applied] };
}

export default { runMigrations, listMigrations };
