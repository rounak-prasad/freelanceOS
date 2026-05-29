/**
 * authMiddleware.js — Authentication + multi-tenant authorization.
 *
 *   requireAuth        → verifies the Bearer JWT, sets req.auth = {userId,email,wsid}
 *   resolveWorkspace   → resolves the active workspace (X-Workspace-Id header or
 *                        the token's wsid), VERIFIES membership, sets
 *                        req.workspaceId + req.role. This is the tenant guard:
 *                        every business query is scoped to req.workspaceId.
 *   requireRole(...)   → RBAC gate on top of a resolved workspace.
 */
import { getDb } from '../db/index.js';
import { verifyJwt } from './auth.js';
import { HttpError } from './validate.js';

export const jwtSecret = () => process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

export function requireAuth(req, _res, next) {
  try {
    const hdr = req.headers['authorization'] || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : null;
    if (!token) throw new HttpError(401, 'Authentication required');
    const payload = verifyJwt(token, jwtSecret());
    req.auth = { userId: payload.sub, email: payload.email, wsid: payload.wsid };
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, 'Invalid or expired token'));
  }
}

export function resolveWorkspace(req, _res, next) {
  try {
    const db = getDb();
    const wsId = req.headers['x-workspace-id'] || req.auth?.wsid;
    if (!wsId) throw new HttpError(400, 'No workspace selected');
    const m = db.get(
      'SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ?',
      [wsId, req.auth.userId]
    );
    if (!m) throw new HttpError(403, 'You are not a member of this workspace');
    req.workspaceId = wsId;
    req.role = m.role;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles) {
  return (req, _res, next) =>
    roles.includes(req.role) ? next() : next(new HttpError(403, 'Insufficient permissions'));
}

export default { requireAuth, resolveWorkspace, requireRole, jwtSecret };
