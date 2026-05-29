/**
 * repos.js — Data access for the foundation. EVERY business query is scoped by
 * workspace_id, so tenant isolation is enforced at the data layer (not just in
 * routes). Routes and tests both go through these functions.
 *
 * Synchronous (node:sqlite). When moving to Postgres, add `await` — the SQL and
 * the function contracts do not change.
 */
import crypto from 'node:crypto';
import { boolInt, orNull } from '../lib/validate.js';
import { computeInvoice } from '../lib/invoiceService.js';

/* ───────────────────────── users / workspaces ───────────────────────── */

export function insertUser(db, u) {
  db.run(
    `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [u.id, u.email, u.password_hash, orNull(u.name), u.created_at, u.updated_at]
  );
  return u;
}
export const findUserByEmail = (db, email) =>
  db.get('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase()]);
export const findUserById = (db, id) =>
  db.get('SELECT * FROM users WHERE id = ?', [id]);

export function insertWorkspace(db, w) {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO workspaces (id, name, owner_user_id, legal_name, gstin, pan, state_code, profession_key, has_lut, gst_registered, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [w.id, w.name, w.owner_user_id, orNull(w.legal_name), orNull(w.gstin), orNull(w.pan),
     orNull(w.state_code), orNull(w.profession_key), boolInt(w.has_lut), boolInt(w.gst_registered), now, now]
  );
  return getWorkspace(db, w.id);
}
export const getWorkspace = (db, id) =>
  db.get('SELECT * FROM workspaces WHERE id = ?', [id]);

export function insertMembership(db, m) {
  db.run(
    `INSERT INTO memberships (id, workspace_id, user_id, role, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [m.id, m.workspace_id, m.user_id, m.role || 'owner', m.created_at || new Date().toISOString()]
  );
  return m;
}
export const listWorkspacesForUser = (db, userId) =>
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

export function createClient(db, wsId, b = {}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO clients (id, workspace_id, name, email, phone, company, gstin, state_code, country, is_export, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, wsId, String(b.name), orNull(b.email), orNull(b.phone), orNull(b.company),
     orNull(b.gstin), orNull(b.stateCode), b.country || 'IN', boolInt(b.isExport), orNull(b.notes), now, now]
  );
  return getClient(db, wsId, id);
}
export const listClients = (db, wsId) =>
  db.all('SELECT * FROM clients WHERE workspace_id = ? ORDER BY created_at DESC', [wsId]);
export const getClient = (db, wsId, id) =>
  db.get('SELECT * FROM clients WHERE workspace_id = ? AND id = ?', [wsId, id]);

export function updateClient(db, wsId, id, patch = {}) {
  if (!getClient(db, wsId, id)) return null;
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(CLIENT_COLS)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); vals.push(col === 'is_export' ? boolInt(patch[k]) : patch[k]); }
  }
  sets.push('updated_at = ?'); vals.push(new Date().toISOString());
  vals.push(wsId, id);
  db.run(`UPDATE clients SET ${sets.join(', ')} WHERE workspace_id = ? AND id = ?`, vals);
  return getClient(db, wsId, id);
}
export function deleteClient(db, wsId, id) {
  const r = db.run('DELETE FROM clients WHERE workspace_id = ? AND id = ?', [wsId, id]);
  return (r.changes || 0) > 0;
}

/* ───────────────────────────── invoices ─────────────────────────────── */

export function nextInvoiceNumber(db, wsId) {
  const row = db.get('SELECT COUNT(*) AS n FROM invoices WHERE workspace_id = ?', [wsId]);
  let n = (row?.n || 0) + 1, num;
  do { num = `INV-${String(n).padStart(4, '0')}`; n++; }
  while (db.get('SELECT 1 AS x FROM invoices WHERE workspace_id = ? AND number = ?', [wsId, num]));
  return num;
}

export function createInvoice(db, wsId, body = {}) {
  const ws = getWorkspace(db, wsId);
  if (!ws) throw new Error('Workspace not found');
  const client = body.clientId ? getClient(db, wsId, body.clientId) : null;

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
  const number = body.number || nextInvoiceNumber(db, wsId);

  db.tx((tx) => {
    tx.run(
      `INSERT INTO invoices (id, workspace_id, client_id, number, issue_date, due_date, currency, fx_rate,
         is_export, same_state, place_of_supply, gst_rate, subtotal_minor, cgst_minor, sgst_minor, igst_minor,
         total_minor, zero_rated, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, wsId, orNull(body.clientId), number, orNull(body.issueDate || now.slice(0, 10)), orNull(body.dueDate),
       body.currency || 'INR', Number(body.fxRate) || 1, boolInt(isExport), boolInt(sameState),
       orNull(body.placeOfSupply), comp.gstRate, comp.subtotalMinor, comp.cgstMinor, comp.sgstMinor,
       comp.igstMinor, comp.totalMinor, boolInt(comp.zeroRated), body.status || 'draft', orNull(body.notes), now, now]
    );
    comp.lines.forEach((l) => {
      tx.run(
        `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price_minor, amount_minor, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), id, l.description, l.quantity, l.unitPriceMinor, l.amountMinor, l.position]
      );
    });
  });
  return getInvoice(db, wsId, id);
}

export const listInvoices = (db, wsId) =>
  db.all('SELECT * FROM invoices WHERE workspace_id = ? ORDER BY created_at DESC', [wsId]);

export function getInvoice(db, wsId, id) {
  const inv = db.get('SELECT * FROM invoices WHERE workspace_id = ? AND id = ?', [wsId, id]);
  if (!inv) return null;
  inv.items = db.all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position', [id]);
  return inv;
}

export function updateInvoice(db, wsId, id, patch = {}) {
  const existing = getInvoice(db, wsId, id);
  if (!existing) return null;
  const now = new Date().toISOString();

  if (Array.isArray(patch.items)) {
    const ws = getWorkspace(db, wsId);
    const comp = computeInvoice({
      items: patch.items,
      isExport: !!existing.is_export,
      hasLUT: !!ws?.has_lut,
      sameState: !!existing.same_state,
      gstRate: patch.gstRate ?? existing.gst_rate,
    });
    db.tx((tx) => {
      tx.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
      comp.lines.forEach((l) => tx.run(
        `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price_minor, amount_minor, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), id, l.description, l.quantity, l.unitPriceMinor, l.amountMinor, l.position]
      ));
      tx.run(
        `UPDATE invoices SET subtotal_minor=?, cgst_minor=?, sgst_minor=?, igst_minor=?, total_minor=?,
           zero_rated=?, gst_rate=?, status=?, notes=?, issue_date=?, due_date=?, updated_at=?
         WHERE workspace_id=? AND id=?`,
        [comp.subtotalMinor, comp.cgstMinor, comp.sgstMinor, comp.igstMinor, comp.totalMinor,
         boolInt(comp.zeroRated), comp.gstRate, patch.status ?? existing.status, orNull(patch.notes ?? existing.notes),
         orNull(patch.issueDate ?? existing.issue_date), orNull(patch.dueDate ?? existing.due_date), now, wsId, id]
      );
    });
  } else {
    db.run(
      `UPDATE invoices SET status=?, notes=?, issue_date=?, due_date=?, updated_at=? WHERE workspace_id=? AND id=?`,
      [patch.status ?? existing.status, orNull(patch.notes ?? existing.notes),
       orNull(patch.issueDate ?? existing.issue_date), orNull(patch.dueDate ?? existing.due_date), now, wsId, id]
    );
  }
  return getInvoice(db, wsId, id);
}

export function deleteInvoice(db, wsId, id) {
  const r = db.run('DELETE FROM invoices WHERE workspace_id = ? AND id = ?', [wsId, id]);
  return (r.changes || 0) > 0;
}

/* ──────────────────── app_state (legacy blob, per tenant) ────────────── */

export function ensureAppState(db, wsId) {
  if (!db.get('SELECT 1 AS x FROM app_state WHERE workspace_id = ?', [wsId])) {
    db.run('INSERT INTO app_state (workspace_id, data, updated_at) VALUES (?, ?, ?)', [wsId, '{}', new Date().toISOString()]);
  }
}
export function getAppState(db, wsId) {
  const r = db.get('SELECT data FROM app_state WHERE workspace_id = ?', [wsId]);
  if (!r) return {};
  try { return JSON.parse(r.data || '{}'); } catch { return {}; }
}
export function setAppState(db, wsId, data) {
  const json = JSON.stringify(data ?? {});
  const now = new Date().toISOString();
  if (db.get('SELECT 1 AS x FROM app_state WHERE workspace_id = ?', [wsId])) {
    db.run('UPDATE app_state SET data = ?, updated_at = ? WHERE workspace_id = ?', [json, now, wsId]);
  } else {
    db.run('INSERT INTO app_state (workspace_id, data, updated_at) VALUES (?, ?, ?)', [wsId, json, now]);
  }
  return true;
}
export function clearAppState(db, wsId) {
  db.run('DELETE FROM app_state WHERE workspace_id = ?', [wsId]);
  return true;
}
