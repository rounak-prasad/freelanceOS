// Postgres adapter: the `?` → `$n` placeholder translation used by the pg query
// shim. Pure + engine-agnostic, so it runs without a Postgres instance and gives
// the production path direct coverage. Run: node tests/pg_adapter.test.mjs
import { sqlToPg } from '../server/db/index.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

console.log('— Postgres placeholder translation (sqlToPg) —');
ok('no placeholders unchanged', sqlToPg('SELECT 1') === 'SELECT 1');
ok('single ? → $1', sqlToPg('SELECT * FROM users WHERE id = ?') === 'SELECT * FROM users WHERE id = $1');
ok('multiple ? numbered in order', sqlToPg('INSERT INTO t (a,b,c) VALUES (?,?,?)') === 'INSERT INTO t (a,b,c) VALUES ($1,$2,$3)');
ok('mixed across clauses', sqlToPg('UPDATE t SET a=? WHERE b=? AND c=?') === 'UPDATE t SET a=$1 WHERE b=$2 AND c=$3');
ok('placeholder count preserved', (sqlToPg('? ? ? ? ?').match(/\$\d+/g) || []).length === 5);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
