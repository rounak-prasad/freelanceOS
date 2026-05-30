// Security: field encryption (AES-256-GCM), app_state encrypted at rest,
// security headers, and the JSON-object body guard. Run: node tests/security.test.mjs
process.env.JWT_SECRET = 'test-secret-please-change';
process.env.DATA_ENCRYPTION_KEY = 'unit-test-encryption-key'; // enables encryption for this process

import crypto from 'node:crypto';
import { encryptString, decryptString, isEncryptionEnabled, isEncrypted } from '../server/lib/crypto.js';
import { securityHeaders, enforceJsonObject } from '../server/lib/security.js';
import { createMemoryDb, _setDbForTests } from '../server/db/index.js';
import * as repo from '../server/db/repos.js';
import { hashPassword } from '../server/lib/auth.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

console.log('— Field encryption (AES-256-GCM) —');
ok('encryption enabled when key is set', isEncryptionEnabled() === true);
const ct = encryptString('bank account 1234567890');
ok('ciphertext is prefixed and not plaintext', isEncrypted(ct) && !ct.includes('1234567890'));
ok('round-trips to original', decryptString(ct) === 'bank account 1234567890');
ok('random IV → two encryptions differ', encryptString('x') !== encryptString('x'));
const [p0, p1] = ct.split('.');
let threw = false; try { decryptString(`${p0}.${p1}.${Buffer.from('tampered').toString('base64url')}`); } catch { threw = true; }
ok('tampered ciphertext throws (GCM auth)', threw);
ok('legacy plaintext decrypts as-is', decryptString('plain legacy value') === 'plain legacy value');

console.log('— app_state encrypted at rest —');
const db = await createMemoryDb();
_setDbForTests(db);
const now = new Date().toISOString();
const user = { id: crypto.randomUUID(), email: 'a@x.in', password_hash: hashPassword('password123'), name: 'A', created_at: now, updated_at: now };
const ws = { id: crypto.randomUUID(), name: 'A WS', owner_user_id: user.id };
await db.tx(async (tx) => {
  await repo.insertUser(tx, user);
  await repo.insertWorkspace(tx, ws);
  await repo.insertMembership(tx, { id: crypto.randomUUID(), workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now });
});
await repo.setAppState(db, ws.id, { bank: { acc: '998877665544', upi: 'a@upi' } });
const rawRow = await db.get('SELECT data FROM app_state WHERE workspace_id = ?', [ws.id]);
ok('stored blob is encrypted (no plaintext acct in DB)', isEncrypted(rawRow.data) && !rawRow.data.includes('998877665544'));
ok('reads back decrypted', (await repo.getAppState(db, ws.id)).bank.acc === '998877665544');

console.log('— Security headers —');
const mockRes = () => { const h = {}; return { headers: h, setHeader: (k, v) => { h[k] = v; } }; };
let res = mockRes(); let called = false;
securityHeaders({ headers: {}, secure: false }, res, () => { called = true; });
ok('calls next()', called);
ok('nosniff + DENY + locked CSP', res.headers['X-Content-Type-Options'] === 'nosniff' && res.headers['X-Frame-Options'] === 'DENY' && /frame-ancestors 'none'/.test(res.headers['Content-Security-Policy']));
ok('no HSTS over http', !res.headers['Strict-Transport-Security']);
res = mockRes();
securityHeaders({ headers: { 'x-forwarded-proto': 'https' } }, res, () => {});
ok('HSTS set over https', /max-age=\d+/.test(res.headers['Strict-Transport-Security'] || ''));

console.log('— JSON object body guard —');
const runMw = (mw, req) => { let e; mw(req, {}, (err) => { e = err || null; }); return e; };
ok('array body on POST rejected (400)', runMw(enforceJsonObject, { method: 'POST', body: [1, 2] })?.status === 400);
ok('object body on POST allowed', runMw(enforceJsonObject, { method: 'POST', body: { a: 1 } }) === null);
ok('GET is ignored', runMw(enforceJsonObject, { method: 'GET' }) === null);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
