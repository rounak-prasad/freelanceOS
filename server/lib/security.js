/**
 * security.js — HTTP hardening helpers (no dependencies).
 *
 *   securityHeaders   — sensible security headers on every response (a small
 *                       helmet-equivalent). The API serves JSON only, so the CSP
 *                       is locked down to nothing renderable and framing is
 *                       denied. HSTS is sent only over HTTPS.
 *   enforceJsonObject — reject mutating requests whose body isn't a JSON object
 *                       (defence against type-confusion / array-body tricks).
 *
 * Note on CSRF: the API authenticates with a Bearer token in the Authorization
 * header (not cookies), so it is not exposed to classic CSRF — a cross-site form
 * cannot set that header. If cookie auth is ever added, add a CSRF token here.
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/** Reject mutating requests whose JSON body is not a plain object. */
export function enforceJsonObject(req, _res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const b = req.body;
    if (b !== undefined && (b === null || typeof b !== 'object' || Array.isArray(b))) {
      return next(Object.assign(new Error('Request body must be a JSON object'), { status: 400 }));
    }
  }
  next();
}

export default { securityHeaders, enforceJsonObject };
