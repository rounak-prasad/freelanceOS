#!/usr/bin/env node
/**
 * ops/backup.mjs — Automated, all-tenant database backup.
 *
 * Writes one JSON file per run containing every workspace's snapshot (via the
 * same exporter used for per-tenant backups). Schedule with cron, e.g. nightly:
 *
 *   0 2 * * *  cd /srv/freelanceos && node ops/backup.mjs >> /var/log/fos-backup.log 2>&1
 *
 * Honours DATABASE_URL (Postgres) / SQLITE_PATH like the server. Output goes to
 * BACKUP_DIR (default ./backups). Encrypted app_state is decrypted into the
 * backup, so store the output securely (or pipe to an encrypted bucket).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { initDb } from '../server/db/index.js';
import { exportWorkspace } from '../server/lib/backup.js';

const db = await initDb();
const rows = await db.all('SELECT id FROM workspaces ORDER BY created_at');
const workspaces = [];
for (const w of rows) workspaces.push(await exportWorkspace(db, w.id));

const dir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), count: workspaces.length, workspaces }, null, 2));
console.log(`[backup] wrote ${workspaces.length} workspace(s) → ${file}`);
process.exit(0);
