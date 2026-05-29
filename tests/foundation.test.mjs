// Foundation test harness (no deps): auth, JWT, multi-tenant isolation, and
// authoritative server-side GST. Run: node tests/foundation.test.mjs
process.env.JWT_SECRET = 'test-secret-please-change';

import crypto from 'node:crypto';
import { createMemoryDb, _setDbForTests } from '../server/db/index.js';
import * as repo from '../server/db/repos.js';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../server/lib/auth.js';
import { requireAuth, resolveWorkspace, jwtSecret } from '../server/lib/authMiddleware.js';
import { computeInvoice } from '../server/lib/invoiceService.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } }

const db = createMemoryDb();
_setDbForTests(db); // so getDb() inside middleware uses this in-memory DB

function makeUser(email, name, wsOverrides = {}) {
  const now = new Date().toISOString();
  const user = { id: crypto.randomUUID(), email: email.toLowerCase(), password_hash: hashPassword('password123'), name, created_at: now, updated_at: now };
  const ws = { id: crypto.randomUUID(), name: `${name} WS`, owner_user_id: user.id, state_code: '29', has_lut: 1, gst_registered: 1, ...wsOverrides };
  db.tx((tx) => {
    repo.insertUser(tx, user);
    repo.insertWorkspace(tx, ws);
    repo.insertMembership(tx, { id: crypto.randomUUID(), workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now });
    repo.ensureAppState(tx, ws.id);
  });
  return { user, ws };
}

// Synchronously run a middleware and capture what it passed to next().
function runMw(mw, req) { let captured; mw(req, {}, (e) => { captured = e || null; }); return captured; }

console.log('— Password hashing (scrypt) —');
const A = makeUser('a@freelanceos.in', 'Asha');
ok('correct password verifies', verifyPassword('password123', A.user.password_hash) === true);
ok('wrong password rejected', verifyPassword('nope', A.user.password_hash) === false);
ok('hashes are salted (two hashes differ)', hashPassword('x') !== hashPassword('x'));

console.log('— JWT (HS256) —');
const tokenA = signJwt({ sub: A.user.id, email: A.user.email, wsid: A.ws.id }, jwtSecret());
ok('valid token round-trips', verifyJwt(tokenA, jwtSecret()).sub === A.user.id);
let threw = false; try { verifyJwt(tokenA, 'wrong-secret'); } catch { threw = true; } ok('wrong secret rejected', threw);
threw = false; const bad = tokenA.slice(0, -1) + (tokenA.endsWith('A') ? 'B' : 'A'); try { verifyJwt(bad, jwtSecret()); } catch { threw = true; } ok('tampered token rejected', threw);
threw = false; const expired = signJwt({ sub: A.user.id }, jwtSecret(), -10); try { verifyJwt(expired, jwtSecret()); } catch { threw = true; } ok('expired token rejected', threw);

console.log('— Multi-tenant isolation (the core enterprise guarantee) —');
const B = makeUser('b@freelanceos.in', 'Bharat');
const clientA = repo.createClient(db, A.ws.id, { name: 'Acme India', stateCode: '29' });
const invA = repo.createInvoice(db, A.ws.id, { clientId: clientA.id, items: [{ description: 'Dev work', quantity: 1, unitPriceMinor: 10000000 }] }); // ₹1,00,000
ok('tenant A sees its own client', !!repo.getClient(db, A.ws.id, clientA.id));
ok('tenant B CANNOT read A\'s client', repo.getClient(db, B.ws.id, clientA.id) === undefined);
ok('tenant B CANNOT read A\'s invoice', repo.getInvoice(db, B.ws.id, invA.id) === null);
ok('tenant B list is empty', repo.listInvoices(db, B.ws.id).length === 0);
ok('tenant A list has the invoice', repo.listInvoices(db, A.ws.id).length === 1);
ok('tenant B cannot delete A\'s invoice', repo.deleteInvoice(db, B.ws.id, invA.id) === false);
ok('invoice still there after B\'s delete attempt', !!repo.getInvoice(db, A.ws.id, invA.id));

console.log('— Per-tenant app_state isolation —');
repo.setAppState(db, A.ws.id, { secret: 'A-only' });
repo.setAppState(db, B.ws.id, { secret: 'B-only' });
ok('A state is A-only', repo.getAppState(db, A.ws.id).secret === 'A-only');
ok('B state is B-only', repo.getAppState(db, B.ws.id).secret === 'B-only');

console.log('— Authoritative server-side GST —');
// Domestic intra-state (client state == workspace state, not export): CGST+SGST 9%+9%
ok('domestic invoice → CGST 9,00,000 paise', invA.cgst_minor === 900000 && invA.sgst_minor === 900000, JSON.stringify(invA));
ok('domestic invoice → no IGST', invA.igst_minor === 0);
ok('domestic total = 1,18,000 (paise)', invA.total_minor === 11800000, String(invA.total_minor));
// Export of service WITH LUT → zero-rated
const clientExp = repo.createClient(db, A.ws.id, { name: 'US Corp', isExport: 1, country: 'US' });
const invExp = repo.createInvoice(db, A.ws.id, { clientId: clientExp.id, items: [{ description: 'Consulting', quantity: 1, unitPriceMinor: 10000000 }] });
ok('export+LUT → zero-rated flag', invExp.zero_rated === 1);
ok('export+LUT → no GST charged', invExp.cgst_minor === 0 && invExp.sgst_minor === 0 && invExp.igst_minor === 0 && invExp.total_minor === 10000000, JSON.stringify(invExp));
// computeInvoice direct: export WITHOUT LUT → IGST 18% (refundable)
const noLut = computeInvoice({ items: [{ description: 'x', quantity: 1, unitPriceMinor: 10000000 }], isExport: true, hasLUT: false });
ok('export no-LUT → IGST 18% (1,80,000 paise)', noLut.igstMinor === 1800000 && !noLut.zeroRated, JSON.stringify(noLut));

console.log('— Auth + tenant middleware guard —');
const okReq = { headers: { authorization: `Bearer ${tokenA}` } };
ok('requireAuth accepts valid token', runMw(requireAuth, okReq) === null && okReq.auth.userId === A.user.id);
const wsReq = { headers: { authorization: `Bearer ${tokenA}` }, auth: { userId: A.user.id, wsid: A.ws.id } };
ok('resolveWorkspace resolves own workspace', runMw(resolveWorkspace, wsReq) === null && wsReq.workspaceId === A.ws.id && wsReq.role === 'owner');
const crossReq = { headers: { 'x-workspace-id': B.ws.id }, auth: { userId: A.user.id, wsid: A.ws.id } };
const crossErr = runMw(resolveWorkspace, crossReq);
ok('resolveWorkspace BLOCKS cross-tenant access (403)', crossErr && crossErr.status === 403, JSON.stringify(crossErr && crossErr.message));
const badAuth = { headers: { authorization: 'Bearer garbage.token.here' } };
const badErr = runMw(requireAuth, badAuth);
ok('requireAuth rejects bad token (401)', badErr && badErr.status === 401);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
