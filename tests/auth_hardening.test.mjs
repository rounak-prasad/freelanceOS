// Auth hardening: email-verification + password-reset tokens (single-use,
// expiring) and refresh-token rotation/revocation. Run: node tests/auth_hardening.test.mjs
process.env.JWT_SECRET = 'test-secret-please-change';

import crypto from 'node:crypto';
import { createMemoryDb, _setDbForTests } from '../server/db/index.js';
import * as repo from '../server/db/repos.js';
import { hashPassword, verifyPassword, sha256, randomToken } from '../server/lib/auth.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

const db = createMemoryDb();
_setDbForTests(db);

function makeUser(email) {
  const now = new Date().toISOString();
  const user = { id: crypto.randomUUID(), email, password_hash: hashPassword('password123'), name: email, created_at: now, updated_at: now };
  db.tx((tx) => repo.insertUser(tx, user));
  return user;
}

console.log('— Email verification tokens —');
const A = makeUser('a@x.in');
ok('user starts unverified', repo.findUserById(db, A.id).email_verified === 0);
const vraw = randomToken();
repo.createEmailToken(db, { userId: A.id, kind: 'verify', tokenHash: sha256(vraw), ttlHours: 48 });
ok('cannot consume a verify token as a reset token', repo.consumeEmailToken(db, { tokenHash: sha256(vraw), kind: 'reset' }) === null);
const consumed = repo.consumeEmailToken(db, { tokenHash: sha256(vraw), kind: 'verify' });
ok('verify token consumes and returns the user', consumed && consumed.user_id === A.id);
ok('verify token is single-use', repo.consumeEmailToken(db, { tokenHash: sha256(vraw), kind: 'verify' }) === null);
repo.setEmailVerified(db, A.id, 1);
ok('user is now verified', repo.findUserById(db, A.id).email_verified === 1);

const eraw = randomToken();
repo.createEmailToken(db, { userId: A.id, kind: 'verify', tokenHash: sha256(eraw), ttlHours: -1 });
ok('an expired token is rejected', repo.consumeEmailToken(db, { tokenHash: sha256(eraw), kind: 'verify' }) === null);

console.log('— Password reset —');
const oldHash = repo.findUserById(db, A.id).password_hash;
const rraw = randomToken();
repo.createEmailToken(db, { userId: A.id, kind: 'reset', tokenHash: sha256(rraw), ttlHours: 1 });
const rrow = repo.consumeEmailToken(db, { tokenHash: sha256(rraw), kind: 'reset' });
ok('reset token valid + single-use', !!rrow && repo.consumeEmailToken(db, { tokenHash: sha256(rraw), kind: 'reset' }) === null);
repo.updateUserPassword(db, A.id, hashPassword('newpassword123'));
const after = repo.findUserById(db, A.id);
ok('password hash changed', after.password_hash !== oldHash);
ok('new password verifies', verifyPassword('newpassword123', after.password_hash) === true);
ok('old password rejected', verifyPassword('password123', after.password_hash) === false);

console.log('— Refresh-token rotation —');
const t1 = randomToken();
repo.createRefreshToken(db, { userId: A.id, tokenHash: sha256(t1), ttlDays: 30 });
const t2 = randomToken();
const rot = repo.rotateRefreshToken(db, { oldHash: sha256(t1), newHash: sha256(t2), ttlDays: 30 });
ok('rotation returns the user + a new id', rot.userId === A.id && !!rot.newId);
ok('old token is revoked after rotation', repo.findRefreshToken(db, sha256(t1)).revoked_at !== null);
ok('replaced_by links old → new', repo.findRefreshToken(db, sha256(t1)).replaced_by === rot.newId);
ok('new token is active', repo.findRefreshToken(db, sha256(t2)).revoked_at === null);

const reuse = repo.rotateRefreshToken(db, { oldHash: sha256(t1), newHash: sha256(randomToken()) });
ok('reusing a revoked token is flagged (theft signal)', reuse.error === 'revoked' && reuse.userId === A.id);
ok('unknown token → not_found', repo.rotateRefreshToken(db, { oldHash: 'deadbeef', newHash: 'x' }).error === 'not_found');

repo.revokeAllRefreshTokensForUser(db, A.id);
ok('revoke-all kills the active token', repo.findRefreshToken(db, sha256(t2)).revoked_at !== null);

const expRaw = randomToken();
repo.createRefreshToken(db, { userId: A.id, tokenHash: sha256(expRaw), ttlDays: -1 });
ok('expired refresh token cannot rotate', repo.rotateRefreshToken(db, { oldHash: sha256(expRaw), newHash: sha256(randomToken()) }).error === 'expired');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
