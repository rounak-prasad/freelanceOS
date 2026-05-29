/**
 * /api/state — the legacy single-blob app state, now AUTHENTICATED and stored
 * per-workspace in the database. This is the bridge that lets every existing
 * page keep working under real multi-tenancy while individual entities (clients,
 * invoices, …) are promoted to first-class tables. The frontend HttpAdapter
 * targets these endpoints with a Bearer token + X-Workspace-Id.
 */
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, resolveWorkspace } from '../lib/authMiddleware.js';
import { asyncHandler } from '../lib/validate.js';
import * as repo from '../db/repos.js';

const router = Router();
router.use(requireAuth, resolveWorkspace);

router.get('/', asyncHandler((req, res) => {
  res.json(repo.getAppState(getDb(), req.workspaceId));
}));

router.put('/', asyncHandler((req, res) => {
  repo.setAppState(getDb(), req.workspaceId, req.body);
  res.json({ ok: true });
}));

router.delete('/', asyncHandler((req, res) => {
  repo.clearAppState(getDb(), req.workspaceId);
  res.json({ ok: true });
}));

export default router;
