// Teams + RBAC: invitations lifecycle, acceptance guards, last-owner protection,
// and tenant isolation of invites. Run: node tests/teams.test.mjs
process.env.JWT_SECRET = 'test-secret-please-change';

import crypto from 'node:crypto';
import { createMemoryDb, _setDbForTests } from '../server/db/index.js';
import * as repo from '../server/db/repos.js';
import { sha256, randomToken, hashPassword } from '../server/lib/auth.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

const db = await createMemoryDb();
_setDbForTests(db);

async function makeUser(email, name) {
  const now = new Date().toISOString();
  const user = { id: crypto.randomUUID(), email: email.toLowerCase(), password_hash: hashPassword('password123'), name, created_at: now, updated_at: now };
  const ws = { id: crypto.randomUUID(), name: `${name} WS`, owner_user_id: user.id };
  await db.tx(async (tx) => {
    await repo.insertUser(tx, user);
    await repo.insertWorkspace(tx, ws);
    await repo.insertMembership(tx, { id: crypto.randomUUID(), workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now });
    await repo.ensureAppState(tx, ws.id);
  });
  return { user, ws };
}

console.log('— Invitation: create → accept → membership —');
const owner = await makeUser('owner@x.in', 'Owner');
const invitee = await makeUser('teammate@x.in', 'Teammate');
const raw = randomToken();
const inv = await repo.createInvitation(db, owner.ws.id, { email: 'teammate@x.in', role: 'member', tokenHash: sha256(raw), invitedBy: owner.user.id });
ok('invite created pending', inv.status === 'pending' && inv.role === 'member');
ok('invite found by token hash', (await repo.findInvitationByTokenHash(db, sha256(raw)))?.id === inv.id);
const acc = await repo.acceptInvitation(db, { tokenHash: sha256(raw), userId: invitee.user.id, userEmail: 'teammate@x.in' });
ok('accept joins the inviting workspace as member', acc.workspaceId === owner.ws.id && acc.role === 'member');
ok('invitee is now a member', !!(await repo.getMembership(db, owner.ws.id, invitee.user.id)));
ok('member count is 2', (await repo.countMembers(db, owner.ws.id)) === 2);
ok('member list joins user email', (await repo.listMembers(db, owner.ws.id)).some((m) => m.email === 'teammate@x.in'));

console.log('— Invitation guards —');
let threw = false;
try { await repo.acceptInvitation(db, { tokenHash: sha256(raw), userId: invitee.user.id, userEmail: 'teammate@x.in' }); } catch (e) { threw = e.status === 409; }
ok('a used invite cannot be reused (409)', threw);

const raw2 = randomToken();
await repo.createInvitation(db, owner.ws.id, { email: 'someone@x.in', role: 'member', tokenHash: sha256(raw2) });
threw = false;
try { await repo.acceptInvitation(db, { tokenHash: sha256(raw2), userId: invitee.user.id, userEmail: 'wrong@x.in' }); } catch (e) { threw = e.status === 403; }
ok('invite is bound to its email (403 on mismatch)', threw);

const raw3 = randomToken();
await repo.createInvitation(db, owner.ws.id, { email: 'late@x.in', tokenHash: sha256(raw3), ttlHours: -1 });
threw = false;
try { await repo.acceptInvitation(db, { tokenHash: sha256(raw3), userId: invitee.user.id, userEmail: 'late@x.in' }); } catch (e) { threw = e.status === 410; }
ok('an expired invite is rejected (410)', threw);

console.log('— Revocation —');
const raw4 = randomToken();
const inv4 = await repo.createInvitation(db, owner.ws.id, { email: 'revoke@x.in', tokenHash: sha256(raw4) });
ok('revoke a pending invite', (await repo.revokeInvitation(db, owner.ws.id, inv4.id)) === true);
threw = false;
try { await repo.acceptInvitation(db, { tokenHash: sha256(raw4), userId: invitee.user.id, userEmail: 'revoke@x.in' }); } catch (e) { threw = e.status === 409; }
ok('a revoked invite cannot be accepted', threw);

console.log('— RBAC: last-owner protection —');
threw = false;
try { await repo.removeMember(db, owner.ws.id, owner.user.id); } catch (e) { threw = e.status === 400; }
ok('cannot remove the last owner', threw);
threw = false;
try { await repo.updateMemberRole(db, owner.ws.id, owner.user.id, 'member'); } catch (e) { threw = e.status === 400; }
ok('cannot demote the last owner', threw);
await repo.updateMemberRole(db, owner.ws.id, invitee.user.id, 'owner');
ok('a second owner can be promoted', (await repo.countOwners(db, owner.ws.id)) === 2);
ok('original owner demotable once a second owner exists', (await repo.updateMemberRole(db, owner.ws.id, owner.user.id, 'admin')).role === 'admin');
ok('member removable (not last owner)', (await repo.removeMember(db, owner.ws.id, owner.user.id)) === true);

console.log('— Tenant isolation of invites —');
const other = await makeUser('other@x.in', 'Other');
ok('invites do not leak across tenants', (await repo.listInvitations(db, other.ws.id)).length === 0);
ok('owner workspace still has its invites', (await repo.listInvitations(db, owner.ws.id)).length >= 1);

console.log('— Workspace tax profile —');
const wsu = await repo.updateWorkspace(db, owner.ws.id, { gstin: '29ABCDE1234F1Z5', legalName: 'Owner LLP', stateCode: '29', hasLut: true, gstRegistered: true });
ok('tax profile saved (gstin/state/flags)', wsu.gstin === '29ABCDE1234F1Z5' && wsu.state_code === '29' && wsu.has_lut === 1 && wsu.gst_registered === 1);
ok('partial update preserves other fields', (await repo.updateWorkspace(db, owner.ws.id, { legalName: 'Owner Studio' })).gstin === '29ABCDE1234F1Z5');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
