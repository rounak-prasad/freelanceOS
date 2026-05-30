/**
 * repos.js — Data access for the foundation. EVERY business query is scoped by
 * workspace_id, so tenant isolation is enforced at the data layer (not just in
 * routes). Routes and tests both go through these functions.
 *
 * As of Phase 1b every function is `async` and `await`s its db calls (including
 * transaction callbacks). On SQLite the awaits are no-ops (synchronous engine);
 * on Postgres they resolve real promises — the SAME code runs on both. The SQL
 * and the function contracts are unchanged from the synchronous version.
 */
import crypto from 'node:crypto';
import { boolInt, orNull, HttpError } from '../lib/validate.js';
import { computeInvoice } from '../lib/invoiceService.js';

/* ───────────────────────── users / workspaces ───────────────────────── */

export async function insertUser(db, u) {
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [u.id, u.email, u.password_hash, orNull(u.name), u.created_at, u.updated_at]
  );
  return u;
}
export const findUserByEmail = async (db, email) =>
  db.get('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase()]);
export const findUserById = async (db, id) =>
  db.get('SELECT * FROM users WHERE id = ?', [id]);

export async function insertWorkspace(db, w) {
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO workspaces (id, name, owner_user_id, legal_name, gstin, pan, state_code, profession_key, has_lut, gst_registered, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [w.id, w.name, w.owner_user_id, orNull(w.legal_name), orNull(w.gstin), orNull(w.pan),
     orNull(w.state_code), orNull(w.profession_key), boolInt(w.has_lut), boolInt(w.gst_registered), now, now]
  );
  return getWorkspace(db, w.id);
}
export const getWorkspace = async (db, id) =>
  db.get('SELECT * FROM workspaces WHERE id = ?', [id]);

/** Update a workspace's tax profile (GSTIN, legal name, state, LUT, etc.). */
const WORKSPACE_COLS = {
  name: 'name', legalName: 'legal_name', gstin: 'gstin', pan: 'pan',
  stateCode: 'state_code', professionKey: 'profession_key',
  hasLut: 'has_lut', gstRegistered: 'gst_registered',
};
export async function updateWorkspace(db, wsId, patch = {}) {
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(WORKSPACE_COLS)) {
    if (patch[k] !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(col === 'has_lut' || col === 'gst_registered' ? boolInt(patch[k]) : orNull(patch[k]));
    }
  }
  if (!sets.length) return getWorkspace(db, wsId);
  sets.push('updated_at = ?'); vals.push(new Date().toISOString());
  vals.push(wsId);
  await db.run(`UPDATE workspaces SET ${sets.join(', ')} WHERE id = ?`, vals);
  return getWorkspace(db, wsId);
}

export async function insertMembership(db, m) {
  await db.run(
    `INSERT INTO memberships (id, workspace_id, user_id, role, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [m.id, m.workspace_id, m.user_id, m.role || 'owner', m.created_at || new Date().toISOString()]
  );
  return m;
}
export const listWorkspacesForUser = async (db, userId) =>
  db.all(
    `SELECT w.id, w.name, m.role
       FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = ? ORDER BY m.created_at`,
    [userId]
  );

/* ───────────────────────────── clients ──────────────────────────────── */

const CLIENT_COLS = {
  name: 'name', email: 'email', phone: 'phone', company: 'company',
  gstin: 'gstin', stateCode: 'state_code', country: 'country',
  isExport: 'is_export', notes: 'notes',
};

export async function createClient(db, wsId, b = {}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO clients (id, workspace_id, name, email, phone, company, gstin, state_code, country, is_export, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, wsId, String(b.name), orNull(b.email), orNull(b.phone), orNull(b.company),
     orNull(b.gstin), orNull(b.stateCode), b.country || 'IN', boolInt(b.isExport), orNull(b.notes), now, now]
  );
  return getClient(db, wsId, id);
}
export const listClients = async (db, wsId) =>
  db.all('SELECT * FROM clients WHERE workspace_id = ? ORDER BY created_at DESC', [wsId]);
export const getClient = async (db, wsId, id) =>
  db.get('SELECT * FROM clients WHERE workspace_id = ? AND id = ?', [wsId, id]);

export async function updateClient(db, wsId, id, patch = {}) {
  if (!(await getClient(db, wsId, id))) return null;
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(CLIENT_COLS)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); vals.push(col === 'is_export' ? boolInt(patch[k]) : patch[k]); }
  }
  sets.push('updated_at = ?'); vals.push(new Date().toISOString());
  vals.push(wsId, id);
  await db.run(`UPDATE clients SET ${sets.join(', ')} WHERE workspace_id = ? AND id = ?`, vals);
  return getClient(db, wsId, id);
}
export async function deleteClient(db, wsId, id) {
  const r = await db.run('DELETE FROM clients WHERE workspace_id = ? AND id = ?', [wsId, id]);
  return (r.changes || 0) > 0;
}

/* ───────────────────────────── invoices ─────────────────────────────── */

export async function nextInvoiceNumber(db, wsId) {
  const row = await db.get('SELECT COUNT(*) AS n FROM invoices WHERE workspace_id = ?', [wsId]);
  let n = (row?.n || 0) + 1, num;
  do { num = `INV-${String(n).padStart(4, '0')}`; n++; }
  while (await db.get('SELECT 1 AS x FROM invoices WHERE workspace_id = ? AND number = ?', [wsId, num]));
  return num;
}

export async function createInvoice(db, wsId, body = {}) {
  const ws = await getWorkspace(db, wsId);
  if (!ws) throw new Error('Workspace not found');
  const client = body.clientId ? await getClient(db, wsId, body.clientId) : null;

  const isExport = body.isExport ?? (client ? !!client.is_export : false);
  const hasLUT = !!ws.has_lut;
  let sameState;
  if (body.sameState !== undefined) sameState = !!body.sameState;
  else if (isExport) sameState = false;
  else if (client && client.state_code && ws.state_code) sameState = client.state_code === ws.state_code;
  else sameState = true;

  const comp = computeInvoice({ items: body.items || [], isExport, hasLUT, sameState, gstRate: body.gstRate });
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const number = body.number || await nextInvoiceNumber(db, wsId);

  await db.tx(async (tx) => {
    await tx.run(
      `INSERT INTO invoices (id, workspace_id, client_id, number, issue_date, due_date, currency, fx_rate,
         is_export, same_state, place_of_supply, gst_rate, subtotal_minor, cgst_minor, sgst_minor, igst_minor,
         total_minor, zero_rated, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, wsId, orNull(body.clientId), number, orNull(body.issueDate || now.slice(0, 10)), orNull(body.dueDate),
       body.currency || 'INR', Number(body.fxRate) || 1, boolInt(isExport), boolInt(sameState),
       orNull(body.placeOfSupply), comp.gstRate, comp.subtotalMinor, comp.cgstMinor, comp.sgstMinor,
       comp.igstMinor, comp.totalMinor, boolInt(comp.zeroRated), body.status || 'draft', orNull(body.notes), now, now]
    );
    for (const l of comp.lines) {
      await tx.run(
        `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price_minor, amount_minor, position, hsn_sac, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), id, l.description, l.quantity, l.unitPriceMinor, l.amountMinor, l.position, orNull(l.hsnSac), orNull(l.unit)]
      );
    }
  });
  return getInvoice(db, wsId, id);
}

export const listInvoices = async (db, wsId) =>
  db.all('SELECT * FROM invoices WHERE workspace_id = ? ORDER BY created_at DESC', [wsId]);

export async function getInvoice(db, wsId, id) {
  const inv = await db.get('SELECT * FROM invoices WHERE workspace_id = ? AND id = ?', [wsId, id]);
  if (!inv) return null;
  inv.items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position', [id]);
  return inv;
}

export async function updateInvoice(db, wsId, id, patch = {}) {
  const existing = await getInvoice(db, wsId, id);
  if (!existing) return null;
  const now = new Date().toISOString();

  if (Array.isArray(patch.items)) {
    const ws = await getWorkspace(db, wsId);
    const comp = computeInvoice({
      items: patch.items,
      isExport: !!existing.is_export,
      hasLUT: !!ws?.has_lut,
      sameState: !!existing.same_state,
      gstRate: patch.gstRate ?? existing.gst_rate,
    });
    await db.tx(async (tx) => {
      await tx.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
      for (const l of comp.lines) {
        await tx.run(
          `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price_minor, amount_minor, position, hsn_sac, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), id, l.description, l.quantity, l.unitPriceMinor, l.amountMinor, l.position, orNull(l.hsnSac), orNull(l.unit)]
        );
      }
      await tx.run(
        `UPDATE invoices SET subtotal_minor=?, cgst_minor=?, sgst_minor=?, igst_minor=?, total_minor=?,
           zero_rated=?, gst_rate=?, status=?, notes=?, issue_date=?, due_date=?, updated_at=?
         WHERE workspace_id=? AND id=?`,
        [comp.subtotalMinor, comp.cgstMinor, comp.sgstMinor, comp.igstMinor, comp.totalMinor,
         boolInt(comp.zeroRated), comp.gstRate, patch.status ?? existing.status, orNull(patch.notes ?? existing.notes),
         orNull(patch.issueDate ?? existing.issue_date), orNull(patch.dueDate ?? existing.due_date), now, wsId, id]
      );
    });
  } else {
    await db.run(
      `UPDATE invoices SET status=?, notes=?, issue_date=?, due_date=?, updated_at=? WHERE workspace_id=? AND id=?`,
      [patch.status ?? existing.status, orNull(patch.notes ?? existing.notes),
       orNull(patch.issueDate ?? existing.issue_date), orNull(patch.dueDate ?? existing.due_date), now, wsId, id]
    );
  }
  return getInvoice(db, wsId, id);
}

export async function deleteInvoice(db, wsId, id) {
  const r = await db.run('DELETE FROM invoices WHERE workspace_id = ? AND id = ?', [wsId, id]);
  return (r.changes || 0) > 0;
}

/* ──────────────────── app_state (legacy blob, per tenant) ────────────── */

export async function ensureAppState(db, wsId) {
  if (!(await db.get('SELECT 1 AS x FROM app_state WHERE workspace_id = ?', [wsId]))) {
    await db.run('INSERT INTO app_state (workspace_id, data, updated_at) VALUES (?, ?, ?)', [wsId, '{}', new Date().toISOString()]);
  }
}
export async function getAppState(db, wsId) {
  const r = await db.get('SELECT data FROM app_state WHERE workspace_id = ?', [wsId]);
  if (!r) return {};
  try { return JSON.parse(r.data || '{}'); } catch { return {}; }
}
export async function setAppState(db, wsId, data) {
  const json = JSON.stringify(data ?? {});
  const now = new Date().toISOString();
  if (await db.get('SELECT 1 AS x FROM app_state WHERE workspace_id = ?', [wsId])) {
    await db.run('UPDATE app_state SET data = ?, updated_at = ? WHERE workspace_id = ?', [json, now, wsId]);
  } else {
    await db.run('INSERT INTO app_state (workspace_id, data, updated_at) VALUES (?, ?, ?)', [wsId, json, now]);
  }
  return true;
}
export async function clearAppState(db, wsId) {
  await db.run('DELETE FROM app_state WHERE workspace_id = ?', [wsId]);
  return true;
}

/* ═══════════════════════ Phase 1a: teams / billing / auth ═══════════════════
 * All functions below are tenant-scoped (workspace_id) where the data is a
 * tenant's, and follow the same async data-access contract as above.
 * ──────────────────────────────────────────────────────────────────────── */

/* ─────────────────────── memberships (team management) ───────────────────── */

export const getMembership = async (db, wsId, userId) =>
  db.get('SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ?', [wsId, userId]);

export const listMembers = async (db, wsId) =>
  db.all(
    `SELECT m.id, m.user_id, m.role, m.created_at, u.email, u.name, u.email_verified
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = ? ORDER BY m.created_at`,
    [wsId]
  );

export const countMembers = async (db, wsId) =>
  (await db.get('SELECT COUNT(*) AS n FROM memberships WHERE workspace_id = ?', [wsId]))?.n || 0;

export const countOwners = async (db, wsId) =>
  (await db.get("SELECT COUNT(*) AS n FROM memberships WHERE workspace_id = ? AND role = 'owner'", [wsId]))?.n || 0;

export async function updateMemberRole(db, wsId, userId, role) {
  const m = await getMembership(db, wsId, userId);
  if (!m) return null;
  if (m.role === 'owner' && role !== 'owner' && (await countOwners(db, wsId)) <= 1) {
    throw new HttpError(400, 'Cannot change the role of the last owner — promote another owner first');
  }
  await db.run('UPDATE memberships SET role = ? WHERE workspace_id = ? AND user_id = ?', [role, wsId, userId]);
  return getMembership(db, wsId, userId);
}

export async function removeMember(db, wsId, userId) {
  const m = await getMembership(db, wsId, userId);
  if (!m) return false;
  if (m.role === 'owner' && (await countOwners(db, wsId)) <= 1) {
    throw new HttpError(400, 'Cannot remove the last owner of a workspace');
  }
  const r = await db.run('DELETE FROM memberships WHERE workspace_id = ? AND user_id = ?', [wsId, userId]);
  return (r.changes || 0) > 0;
}

/* ────────────────────────────── invitations ─────────────────────────────── */

export async function createInvitation(db, wsId, { email, role = 'member', tokenHash, invitedBy = null, ttlHours = 168 }) {
  const id = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + ttlHours * 3600 * 1000);
  await db.run(
    `INSERT INTO invitations (id, workspace_id, email, role, token_hash, status, invited_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [id, wsId, String(email).toLowerCase(), role, tokenHash, orNull(invitedBy), now.toISOString(), expires.toISOString()]
  );
  return getInvitation(db, wsId, id);
}

export const getInvitation = async (db, wsId, id) =>
  db.get('SELECT * FROM invitations WHERE workspace_id = ? AND id = ?', [wsId, id]);
export const listInvitations = async (db, wsId) =>
  db.all('SELECT * FROM invitations WHERE workspace_id = ? ORDER BY created_at DESC', [wsId]);
export const countPendingInvitations = async (db, wsId) =>
  (await db.get("SELECT COUNT(*) AS n FROM invitations WHERE workspace_id = ? AND status = 'pending'", [wsId]))?.n || 0;
export const findPendingInvitation = async (db, wsId, email) =>
  db.get("SELECT * FROM invitations WHERE workspace_id = ? AND email = ? AND status = 'pending'", [wsId, String(email).toLowerCase()]);
export const findInvitationByTokenHash = async (db, tokenHash) =>
  db.get('SELECT * FROM invitations WHERE token_hash = ?', [tokenHash]);

export async function revokeInvitation(db, wsId, id) {
  const r = await db.run(
    "UPDATE invitations SET status = 'revoked' WHERE workspace_id = ? AND id = ? AND status = 'pending'",
    [wsId, id]
  );
  return (r.changes || 0) > 0;
}

/** Accept an invite for an authenticated user. Creates the membership and marks
 *  the invite accepted, atomically. Throws HttpError on any invalid state. */
export async function acceptInvitation(db, { tokenHash, userId, userEmail }) {
  const inv = await findInvitationByTokenHash(db, tokenHash);
  if (!inv) throw new HttpError(404, 'Invitation not found');
  if (inv.status !== 'pending') throw new HttpError(409, 'This invitation has already been used or revoked');
  if (new Date(inv.expires_at) < new Date()) {
    await db.run("UPDATE invitations SET status = 'revoked' WHERE id = ?", [inv.id]);
    throw new HttpError(410, 'This invitation has expired');
  }
  if (userEmail && String(userEmail).toLowerCase() !== inv.email) {
    throw new HttpError(403, 'This invitation was sent to a different email address');
  }
  const existing = await getMembership(db, inv.workspace_id, userId);
  const now = new Date().toISOString();
  await db.tx(async (tx) => {
    if (!existing) {
      await insertMembership(tx, { id: crypto.randomUUID(), workspace_id: inv.workspace_id, user_id: userId, role: inv.role, created_at: now });
    }
    await tx.run("UPDATE invitations SET status = 'accepted', accepted_at = ? WHERE id = ?", [now, inv.id]);
  });
  return { workspaceId: inv.workspace_id, role: inv.role, alreadyMember: !!existing };
}

/* ───────────────────────────── subscriptions ────────────────────────────── */

const FREE_SUBSCRIPTION = (wsId) => ({
  workspace_id: wsId, plan: 'free', status: 'active', provider: null,
  provider_subscription_id: null, provider_customer_id: null, seats: 1, current_period_end: null,
});

/** Absence of a row == the Free plan (we never force a write on read). */
export async function getSubscription(db, wsId) {
  return (await db.get('SELECT * FROM subscriptions WHERE workspace_id = ?', [wsId])) || FREE_SUBSCRIPTION(wsId);
}

export async function upsertSubscription(db, wsId, patch = {}) {
  const now = new Date().toISOString();
  const cur = await db.get('SELECT * FROM subscriptions WHERE workspace_id = ?', [wsId]);
  const next = { ...(cur || FREE_SUBSCRIPTION(wsId)), ...patch };
  if (cur) {
    await db.run(
      `UPDATE subscriptions SET plan=?, status=?, provider=?, provider_subscription_id=?,
         provider_customer_id=?, seats=?, current_period_end=?, updated_at=? WHERE workspace_id=?`,
      [next.plan, next.status, orNull(next.provider), orNull(next.provider_subscription_id),
       orNull(next.provider_customer_id), next.seats ?? 1, orNull(next.current_period_end), now, wsId]
    );
  } else {
    await db.run(
      `INSERT INTO subscriptions (workspace_id, plan, status, provider, provider_subscription_id,
         provider_customer_id, seats, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [wsId, next.plan, next.status, orNull(next.provider), orNull(next.provider_subscription_id),
       orNull(next.provider_customer_id), next.seats ?? 1, orNull(next.current_period_end), now, now]
    );
  }
  return db.get('SELECT * FROM subscriptions WHERE workspace_id = ?', [wsId]);
}

export const findSubscriptionByProviderId = async (db, providerSubId) =>
  db.get('SELECT * FROM subscriptions WHERE provider_subscription_id = ?', [providerSubId]);

export async function insertBillingEvent(db, { workspaceId = null, provider = null, eventType, payload = null }) {
  await db.run(
    'INSERT INTO billing_events (id, workspace_id, provider, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [crypto.randomUUID(), orNull(workspaceId), orNull(provider), String(eventType), payload ? JSON.stringify(payload) : null, new Date().toISOString()]
  );
}

/* ───────────────────── usage counters (for plan limits) ──────────────────── */

export const countClients = async (db, wsId) =>
  (await db.get('SELECT COUNT(*) AS n FROM clients WHERE workspace_id = ?', [wsId]))?.n || 0;
export const countInvoicesSince = async (db, wsId, isoDate) =>
  (await db.get('SELECT COUNT(*) AS n FROM invoices WHERE workspace_id = ? AND created_at >= ?', [wsId, isoDate]))?.n || 0;

/* ─────────────── email tokens (verification + password reset) ────────────── */

export async function createEmailToken(db, { userId, kind, tokenHash, ttlHours = 24 }) {
  const id = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + ttlHours * 3600 * 1000);
  await db.run(
    'INSERT INTO email_tokens (id, user_id, kind, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, kind, tokenHash, now.toISOString(), expires.toISOString()]
  );
  return id;
}

/** Single-use consume: returns the row (incl. user_id) iff valid, else null. */
export async function consumeEmailToken(db, { tokenHash, kind }) {
  const row = await db.get('SELECT * FROM email_tokens WHERE token_hash = ? AND kind = ?', [tokenHash, kind]);
  if (!row || row.consumed_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  await db.run('UPDATE email_tokens SET consumed_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
  return row;
}

/* ──────────────────────── refresh tokens (rotation) ─────────────────────── */

export async function createRefreshToken(db, { userId, tokenHash, ttlDays = 30 }) {
  const id = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays * 86400 * 1000);
  await db.run(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    [id, userId, tokenHash, now.toISOString(), expires.toISOString()]
  );
  return id;
}

export const findRefreshToken = async (db, tokenHash) =>
  db.get('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);

export async function revokeRefreshToken(db, tokenHash) {
  const r = await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL',
    [new Date().toISOString(), tokenHash]);
  return (r.changes || 0) > 0;
}

/** Revoke every active refresh token for a user (e.g. after a password reset). */
export async function revokeAllRefreshTokensForUser(db, userId) {
  const r = await db.run('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
    [new Date().toISOString(), userId]);
  return r.changes || 0;
}

/** Validate + rotate a refresh token. On success revokes the old one, links it
 *  to its replacement (theft-detection), and returns { userId, newId }. */
export async function rotateRefreshToken(db, { oldHash, newHash, ttlDays = 30 }) {
  const row = await findRefreshToken(db, oldHash);
  if (!row) return { error: 'not_found' };
  if (row.revoked_at) return { error: 'revoked', userId: row.user_id };
  if (new Date(row.expires_at) < new Date()) return { error: 'expired', userId: row.user_id };
  let newId;
  await db.tx(async (tx) => {
    newId = crypto.randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + ttlDays * 86400 * 1000);
    await tx.run('INSERT INTO refresh_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      [newId, row.user_id, newHash, now.toISOString(), expires.toISOString()]);
    await tx.run('UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE id = ?',
      [now.toISOString(), newId, row.id]);
  });
  return { userId: row.user_id, newId };
}

/* ───────────────────────────── user mutations ───────────────────────────── */

export async function setEmailVerified(db, userId, val = 1) {
  await db.run('UPDATE users SET email_verified = ?, updated_at = ? WHERE id = ?',
    [boolInt(val), new Date().toISOString(), userId]);
}
export async function updateUserPassword(db, userId, passwordHash) {
  await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [passwordHash, new Date().toISOString(), userId]);
}

/* ═══════════════════════ Phase 2: e-invoicing / GSTR-1 ═══════════════════════ */

/** Persist the IRP result (IRN, ack, signed QR) on an invoice. */
export async function setInvoiceEInvoice(db, wsId, id, { irn, ackNo, ackDt, signedQr, status = 'generated' }) {
  await db.run(
    `UPDATE invoices SET irn=?, ack_no=?, ack_dt=?, signed_qr=?, einvoice_status=?, updated_at=?
       WHERE workspace_id=? AND id=?`,
    [orNull(irn), orNull(ackNo), orNull(ackDt), orNull(signedQr), status, new Date().toISOString(), wsId, id]
  );
  return getInvoice(db, wsId, id);
}

/** Persist the e-way bill number on an invoice. */
export async function setInvoiceEwayBill(db, wsId, id, { ewbNo }) {
  await db.run('UPDATE invoices SET ewb_no=?, updated_at=? WHERE workspace_id=? AND id=?',
    [orNull(ewbNo), new Date().toISOString(), wsId, id]);
  return getInvoice(db, wsId, id);
}

/**
 * Enriched invoices for a GSTR-1 period (joins the buyer's GSTIN/state). Excludes
 * drafts and cancelled invoices. issue_date is ISO 'YYYY-MM-DD'.
 */
export const listInvoicesForGstr1 = async (db, wsId, fromISO, toISO) =>
  db.all(
    `SELECT i.*, c.gstin AS client_gstin, c.state_code AS client_state_code,
            c.name AS client_name, c.country AS client_country
       FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.workspace_id = ? AND i.issue_date >= ? AND i.issue_date <= ?
        AND i.status != 'cancelled' AND i.status != 'draft'
      ORDER BY i.issue_date, i.number`,
    [wsId, fromISO, toISO]
  );
