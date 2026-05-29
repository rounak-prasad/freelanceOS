/**
 * persistence.js — Backend-ready data-access layer for FreelanceOS.
 *
 * The app used to call localStorage directly inside DataContext, which capped it
 * at "personal prototype" (no accounts, no sync, no security). This module puts
 * persistence behind a small adapter seam:
 *
 *   - LocalStorageAdapter (default): exactly today's behaviour — one JSON blob in
 *     the browser. Zero setup, works offline.
 *   - HttpAdapter: same shape, but reads/writes a real backend at /api/state.
 *     Flip VITE_DATA_BACKEND=http and point VITE_API_BASE at your server; the
 *     backend drops in with no further app changes.
 *
 * DataContext just calls loadState() / saveState() / clearState() and stays
 * agnostic about where the data lives.
 */

import APP_CONFIG, { apiUrl } from '../config/appConfig.js';
import { authHeaders } from './authClient.js';

export const STORAGE_KEY = 'freelanceos_data';

/* ---- Local (browser) adapter — current behaviour ---- */
const LocalStorageAdapter = {
  mode: 'local',
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[persistence] local load failed:', e);
      return null;
    }
  },
  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('[persistence] local save failed:', e);
      return false;
    }
  },
  async hydrate() {
    return this.load();
  },
  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  },
};

/* ---- HTTP adapter — talks to a future backend, caches in localStorage ---- */
let saveTimer = null;
const HttpAdapter = {
  mode: 'http',
  // Synchronous load returns the local cache so the UI renders instantly;
  // call hydrate() to refresh from the server.
  load() {
    return LocalStorageAdapter.load();
  },
  async hydrate() {
    try {
      const res = await fetch(apiUrl('/state'), { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error('state fetch ' + res.status);
      const data = await res.json();
      LocalStorageAdapter.save(data);
      return data;
    } catch (e) {
      console.warn('[persistence] http hydrate failed, using cache:', e);
      return LocalStorageAdapter.load();
    }
  },
  save(state) {
    LocalStorageAdapter.save(state); // optimistic local cache
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fetch(apiUrl('/state'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(state),
      }).catch((e) => console.warn('[persistence] http save failed (cached locally):', e));
    }, 800); // debounce network writes
    return true;
  },
  clear() {
    LocalStorageAdapter.clear();
    fetch(apiUrl('/state'), { method: 'DELETE', headers: { ...authHeaders() } }).catch(() => {});
  },
};

const adapter = APP_CONFIG.dataBackend === 'http' ? HttpAdapter : LocalStorageAdapter;

export const backendMode = adapter.mode;
export const loadState = () => adapter.load();
export const saveState = (state) => adapter.save(state);
export const hydrateState = () => adapter.hydrate();
export const clearState = () => adapter.clear();

export default { loadState, saveState, hydrateState, clearState, backendMode, STORAGE_KEY };
