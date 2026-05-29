/**
 * Minimal file-backed state store so the HTTP data adapter
 * (VITE_DATA_BACKEND=http) works in development without a database.
 * Swap this for Postgres/Prisma/Supabase in production — the route contract
 * (get/set/clear by userId) stays identical.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.STATE_DIR || path.join(__dirname, '..', '.data');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}
const fileFor = (userId) => path.join(DATA_DIR, `${String(userId).replace(/[^a-z0-9_-]/gi, '_')}.json`);

export const stateStore = {
  async get(userId) {
    try {
      const raw = await fs.readFile(fileFor(userId), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  async set(userId, state) {
    await ensureDir();
    await fs.writeFile(fileFor(userId), JSON.stringify(state ?? {}, null, 2), 'utf8');
    return true;
  },
  async clear(userId) {
    try { await fs.unlink(fileFor(userId)); } catch { /* noop */ }
    return true;
  },
};

export default { stateStore };
