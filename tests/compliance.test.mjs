// Compliance: per-tenant backup export/restore, audit-log viewer, and DPDP/GDPR
// account erasure (FK cascade). Run: node tests/compliance.test.mjs
process.env.JWT_SECRET = 'test-secret-please-change';

import crypto from 'node:crypto';
import { createMemoryDb, _setDbForTests } from '../server/db/index.js';
import * as repo from '../server/db/repos.js';
import { hashPassword } from '../server/lib/auth.js';
import { writeAudit } from '../server/lib/audit.js';
import { exportWorkspace, restoreWorkspace } from '../server/lib/backup.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

const db = await createMemoryDb();
_setDbForTests(db);

async function makeWs(name) {
  const now = new Date().toISOString();
  const user = { id: crypto.randomUUID(), email: `${name}@x.in`, password_hash: hashPassword('password123'), name, created_at: now, updated_at: now };
  const ws = { id: crypto.randomUUID(), name: `${name} WS`, owner_user_id: user.id };
  await db.tx(async (tx) => {
    await repo.insertUser(tx, user);
    await repo.insertWorkspace(tx, ws);
    await repo.insertMembership(tx, { id: crypto.randomUUID(), workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now });
  });
  return { user, ws };
}

console.log('— Backup export + restore —');
const A = await makeWs('alpha');
const c1 = await repo.createClient(db, A.ws.id, { name: 'Acme', stateCode: '29' });
await repo.createInvoice(db, A.ws.id, { clientId: c1.id, number: 'INV-0001', status: 'sent', items: [{ description: 'Dev', quantity: 1, unitPriceMinor: 10000000, hsnSac: '998314', unit: 'OTH' }] });
await repo.setAppState(db, A.ws.id, { settings: { bankName: 'HDFC' } });

const backup = await exportWorkspace(db, A.ws.id);
ok('backup has clients + invoices + appState', backup.clients.length === 1 && backup.invoices.length === 1 && backup.appState.settings.bankName === 'HDFC');
ok('backup invoice keeps items + HSN', backup.invoices[0].items[0].hsn_sac === '998314');

const B = await makeWs('beta');
const rr = await restoreWorkspace(db, B.ws.id, backup);
ok('restore reports counts', rr.restored.clients === 1 && rr.restored.invoices === 1);
const bInv = await repo.listInvoices(db, B.ws.id);
ok('restored invoice: same number + recomputed total', bInv.length === 1 && bInv[0].number === 'INV-0001' && bInv[0].total_minor === 11800000);
ok('restored client present', (await repo.listClients(db, B.ws.id)).length === 1);
ok('restored appState', (await repo.getAppState(db, B.ws.id)).settings.bankName === 'HDFC');
ok('restore is tenant-scoped (A unchanged)', (await repo.listInvoices(db, A.ws.id)).length === 1);

console.log('— Audit-log viewer —');
await writeAudit(db, { workspaceId: A.ws.id, userId: A.user.id, action: 'client.create', entityType: 'client', entityId: 'x' });
await writeAudit(db, { workspaceId: A.ws.id, userId: A.user.id, action: 'invoice.create' });
await writeAudit(db, { workspaceId: B.ws.id, userId: B.user.id, action: 'client.create' });
const entries = await repo.listAuditLog(db, A.ws.id, { limit: 50 });
ok('entries returned for the workspace', entries.length >= 2);
ok('audit is workspace-scoped', entries.every((e) => e.workspace_id === A.ws.id));
const filtered = await repo.listAuditLog(db, A.ws.id, { action: 'invoice' });
ok('action prefix filter works', filtered.length === 1 && filtered[0].action === 'invoice.create');
ok('count matches', (await repo.countAuditLog(db, A.ws.id)) >= 2);

console.log('— Account erasure (DPDP right to be forgotten) —');
const C = await makeWs('gamma');
await repo.insertMembership(db, { id: crypto.randomUUID(), workspace_id: C.ws.id, user_id: A.user.id, role: 'member', created_at: new Date().toISOString() });
ok('A is a member of C before erasure', !!(await repo.getMembership(db, C.ws.id, A.user.id)));
ok('erasure deletes the user', (await repo.deleteUser(db, A.user.id)) === true);
ok('user is gone', (await repo.findUserById(db, A.user.id)) === undefined);
ok('owned workspace + its data cascade-deleted', (await repo.getWorkspace(db, A.ws.id)) === undefined && (await repo.listClients(db, A.ws.id)).length === 0);
ok('membership in other workspace removed', (await repo.getMembership(db, C.ws.id, A.user.id)) === undefined);
ok("other owner's workspace survives", !!(await repo.getWorkspace(db, C.ws.id)));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
