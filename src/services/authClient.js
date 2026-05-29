/**
 * authClient.js — Browser-side auth client + session storage.
 *
 * The JWT and the active workspace id live in localStorage. authHeaders() is the
 * single source other clients (apiClient, persistence) use to attach the Bearer
 * token + X-Workspace-Id to every API call, so the whole app is tenant-aware.
 */
import { apiUrl } from '../config/appConfig.js';

const TOKEN_KEY = 'freelanceos_token';
const WS_KEY = 'freelanceos_wsid';

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const getWorkspaceId = () => { try { return localStorage.getItem(WS_KEY); } catch { return null; } };

export function setSession(token, workspaceId) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (workspaceId) localStorage.setItem(WS_KEY, workspaceId);
  } catch { /* ignore quota/availability errors */ }
}
export function clearSession() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(WS_KEY); } catch { /* noop */ }
}

/** Headers attached to every authenticated request. */
export function authHeaders() {
  const h = {};
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  const w = getWorkspaceId();
  if (w) h['X-Workspace-Id'] = w;
  return h;
}

async function call(path, { method = 'POST', body } = {}) {
  const res = await fetch(apiUrl(`/auth${path}`), {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function register(payload) {
  const d = await call('/register', { body: payload });
  setSession(d.token, d.workspaces?.[0]?.id);
  return d;
}
export async function login(payload) {
  const d = await call('/login', { body: payload });
  setSession(d.token, d.workspaces?.[0]?.id);
  return d;
}
export async function me() {
  return call('/me', { method: 'GET' });
}
export function logout() { clearSession(); }

export default { getToken, getWorkspaceId, setSession, clearSession, authHeaders, register, login, me, logout };
