/**
 * audit.js — Append-only audit trail. Every mutation calls writeAudit so an
 * enterprise admin can answer "who changed this, and when". Never throws into
 * the request path: auditing failures are logged, not surfaced to the user.
 */
import crypto from 'node:crypto';
import { orNull } from './validate.js';

export function writeAudit(db, { workspaceId = null, userId = null, action, entityType = null, entityId = null, ip = null, meta = null } = {}) {
  try {
    db.run(
      `INSERT INTO audit_log (id, workspace_id, user_id, action, entity_type, entity_id, ip, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), orNull(workspaceId), orNull(userId), String(action),
       orNull(entityType), orNull(entityId), orNull(ip),
       meta ? JSON.stringify(meta) : null, new Date().toISOString()]
    );
  } catch (e) {
    console.warn('[audit] failed to write entry:', e.message);
  }
}

export default { writeAudit };
