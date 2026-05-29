/**
 * appConfig.js — Central runtime configuration for FreelanceOS.
 * Reads Vite env vars (import.meta.env) with safe fallbacks so the app runs
 * locally with zero setup and can be pointed at a real backend / live keys by
 * setting variables in .env (see .env.example).
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

export const APP_CONFIG = {
  // Persistence backend: 'local' (browser localStorage, default) or 'http' (your API)
  dataBackend: env.VITE_DATA_BACKEND || 'local',
  // Base URL for the API server (AI proxy, payments, cross-border). Empty => same origin /api
  apiBase: env.VITE_API_BASE || '',
  // Feature flags so half-configured integrations degrade gracefully
  features: {
    aiAssistant: (env.VITE_FEATURE_AI ?? 'true') !== 'false',
    payments: (env.VITE_FEATURE_PAYMENTS ?? 'true') !== 'false',
    crossBorder: (env.VITE_FEATURE_CROSSBORDER ?? 'true') !== 'false',
  },
  // Default USD→INR used by the cross-border calculator until a live rate is wired
  defaultUsdInr: Number(env.VITE_DEFAULT_USDINR || 86),
  currency: 'INR',
  // Auth is required when using the http/DB backend, or when explicitly enabled
  // via VITE_REQUIRE_AUTH. Local mode (default) bypasses auth so the product
  // still runs with zero setup on localStorage + sample data.
  requireAuth: (env.VITE_REQUIRE_AUTH === 'true') || ((env.VITE_DATA_BACKEND || 'local') === 'http'),
};

export const apiUrl = (path) => {
  const base = APP_CONFIG.apiBase.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : `/api${p.startsWith('/api') ? p.slice(4) : p}`;
};

export default APP_CONFIG;
