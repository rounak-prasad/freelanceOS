/**
 * db/index.js — Database access for the FreelanceOS enterprise foundation.
 *
 * Dev/test: Node 24's built-in `node:sqlite` (DatabaseSync) — zero npm install,
 * file-backed (or in-memory for tests). Production: PostgreSQL via `pg`, wired
 * through the SAME tiny query interface { run, get, all, exec, tx } so the repo
 * layer and routes never change. `?` placeholders are translated to `$n` for
 * Postgres. Set DATABASE_URL=postgres://… to use it (driver loaded lazily).
 *
 * All callers use parameterized SQL ONLY — never string interpolation.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _db = null;

/* ---- node:sqlite adapter ---- */
function wrapSqlite(raw) {
  return {
    engine: 'sqlite',
    raw,
    run(sql, params = []) { return raw.prepare(sql).run(...params); },
    get(sql, params = []) { return raw.prepare(sql).get(...params); },
    all(sql, params = []) { return raw.prepare(sql).all(...params); },
    exec(sql) { return raw.exec(sql); },
    tx(fn) {
      raw.exec('BEGIN');
      try { const r = fn(this); raw.exec('COMMIT'); return r; }
      catch (e) { try { raw.exec('ROLLBACK'); } catch { /* noop */ } throw e; }
    },
  };
}

function openSqlite(file) {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL;');
  raw.exec('PRAGMA foreign_keys = ON;');
  return wrapSqlite(raw);
}

/**
 * Postgres adapter (production). Loaded lazily so dev/test never needs `pg`.
 * Translates `?` → `$1,$2,…`. Async under the hood; we expose the same shape
 * but callers in this foundation are synchronous (sqlite) — when you move to
 * Postgres, switch the repo layer to `await db.*`. Kept here to make the
 * production path concrete and reviewable, not to run in the sandbox.
 */
export async function createPostgresDb(connectionString) {
  const { default: pg } = await import('pg');           // optional dependency
  const pool = new pg.Pool({ connectionString, max: 10 });
  const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
  const api = {
    engine: 'postgres',
    pool,
    async run(sql, params = []) { const r = await pool.query(toPg(sql), params); return { changes: r.rowCount }; },
    async get(sql, params = []) { const r = await pool.query(toPg(sql), params); return r.rows[0] || undefined; },
    async all(sql, params = []) { const r = await pool.query(toPg(sql), params); return r.rows; },
    async exec(sql) { await pool.query(sql); },
    async tx(fn) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const r = await fn(api); await client.query('COMMIT'); return r; }
      catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    },
  };
  return api;
}

/** Get (and lazily open) the process-wide DB handle. */
export function getDb() {
  if (_db) return _db;
  const file = process.env.SQLITE_PATH || path.join(__dirname, '..', '.data', 'freelanceos.sqlite');
  _db = openSqlite(file);
  initSchema(_db);
  return _db;
}

/** Apply all pending migrations (idempotent; tracked in schema_migrations). */
export function initSchema(db = getDb()) {
  runMigrations(db);
  return db;
}

/** Fresh in-memory DB with schema applied — for unit tests. */
export function createMemoryDb() {
  const db = openSqlite(':memory:');
  initSchema(db);
  return db;
}

/** Test helper: reset the process handle (so tests can inject a memory db). */
export function _setDbForTests(db) { _db = db; }

export default { getDb, initSchema, createMemoryDb, createPostgresDb, _setDbForTests };
