/**
 * apiClient.js — Thin fetch wrapper for the FreelanceOS API server
 * (AI proxy, payments, cross-border). Centralises base-URL resolution and
 * error handling so feature modules stay clean.
 */
import APP_CONFIG, { apiUrl } from '../config/appConfig.js';
import { authHeaders } from './authClient.js';

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && (data.error || data.message) ? (data.error || data.message) : `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function apiGet(path) {
  return parse(await fetch(apiUrl(path), { headers: { ...authHeaders() } }));
}

export async function apiPost(path, body) {
  return parse(
    await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body || {}),
    })
  );
}

export async function apiPatch(path, body) {
  return parse(
    await fetch(apiUrl(path), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body || {}),
    })
  );
}

export async function apiDelete(path) {
  return parse(await fetch(apiUrl(path), { method: 'DELETE', headers: { ...authHeaders() } }));
}

/** Probe whether the API server is reachable (used to degrade gracefully). */
export async function apiHealthy() {
  try {
    const res = await fetch(apiUrl('/health'));
    return res.ok;
  } catch {
    return false;
  }
}

export { apiUrl, APP_CONFIG };
export default { apiGet, apiPost, apiPatch, apiDelete, apiHealthy, apiUrl };
