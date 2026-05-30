/**
 * db/index.js — Database access for the FreelanceOS enterprise foundation.
 *
 * ONE async query interface { run, get, all, exec, tx } backs both engines:
 *   • Dev/test : Node's built-in `node:sqlite` (DatabaseSync) — zero install.
 *   • Prod     : PostgreSQL via `pg`, selected by setting DATABASE_URL.
 *
 * As of Phase 1b the repo layer and routes `await` every db call, so the SAME
 * code runs unchanged on both engines: awaiting SQLite's synchronous return is a
 * no-op, while Postgres' promises resolve. `?` placeholders are translated to
 * `$n` for Postgres. All callers use parameterized SQL ONLY — never string
 * interpolation.
 *
 * Lifecycle: call `await initDb()` once at boot (server) or `await
 * createMemoryDb()` in tests; `getDb()` is then a synchronous accessor.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _db = null;

/* ---- node:sqlite adapter (synchronous engine, async-compatible surface) ---- */
function wrapSqlite(raw) {
  return {
    engine: 'sqlite',
    raw,
    run(sql, params = []) { return raw.prepare(sql).run(...params); },
    get(sql, params = []) { return raw.prepare(sql).get(...params); },
    all(sql, params = []) { return raw.prepare(sql).all(...params); },
    exec(sql) { return raw.exec(sql); },
    // `tx` is async so an async callback (… await tx.run(…) …) fully completes
    // BEFORE COMMIT. SQLite work runs synchronously; the awaits are no-ops here.
    async tx(fn) {
      raw.exec('BEGIN');
      try { const r = await fn(this); raw.exec('COMMIT'); return r; }
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

/** Translate `?` placeholders → Postgres `$1,$2,…`. Exported for unit tests. */
export function sqlToPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Postgres adapter (production). Loaded lazily so dev/test never needs `pg`.
 * Same { run, get, all, exec, tx } shape as the SQLite adapter — and now the
 * repo layer awaits all of them, so this is a live production path, not a stub.
 */
export async function createPostgresDb(connectionString) {
  const { default: pg } = await import('pg'); // optional dependency
  const pool = new pg.Pool({ connectionString, max: 10 });
  const api = {
    engine: 'postgres',
    pool,
    async run(sql, params = []) { const r = await pool.query(sqlToPg(sql), params); return { changes: r.rowCount }; },
    async get(sql, params = []) { const r = await pool.query(sqlToPg(sql), params); return r.rows[0] || undefined; },
    async all(sql, params = []) { const r = await pool.query(sqlToPg(sql), params); return r.rows; },
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

/** Open the engine selected by env (no migration yet). */
async function open() {
  if (process.env.DATABASE_URL) return createPostgresDb(process.env.DATABASE_URL);
  const file = process.env.SQLITE_PATH || path.join(__dirname, '..', '.data', 'freelanceos.sqlite');
  return openSqlite(file);
}

/** Open + migrate the process-wide handle. Call once at boot; idempotent. */
export async function initDb() {
  if (_db) return _db;
  _db = await open();
  await runMigrations(_db);
  return _db;
}

/** Apply all pending migrations (idempotent; tracked in schema_migrations). */
export async function initSchema(db) {
  await runMigrations(db);
  return db;
}

/** Synchronous accessor for the already-initialized handle. */
export function getDb() {
  if (!_db) throw new Error('Database not initialized — call `await initDb()` at boot (or `await createMemoryDb()` in tests).');
  return _db;
}

/** Fresh in-memory DB with migrations applied — for unit tests. */
export async function createMemoryDb() {
  const db = openSqlite(':memory:');
  await runMigrations(db);
  return db;
}

/** Test helper: inject a db as the process handle (so getDb() returns it). */
export function _setDbForTests(db) { _db = db; }

export default { getDb, initDb, initSchema, createMemoryDb, createPostgresDb, sqlToPg, _setDbForTests };
