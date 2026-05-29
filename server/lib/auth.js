/**
 * auth.js — Password hashing + JWT, using ONLY Node built-ins (node:crypto).
 *
 * Why no bcrypt / jsonwebtoken deps: this keeps the foundation runnable and
 * testable with zero `npm install` (important in CI and the sandbox). The
 * primitives used are industry-standard:
 *   • Passwords: scrypt (OWASP-recommended memory-hard KDF) with a per-user
 *     random salt and constant-time comparison.
 *   • Tokens: HS256 JWT (header.payload.signature, base64url) with iat/exp.
 *
 * For production you may swap in `argon2`/`jsonwebtoken` — the call sites
 * (hashPassword/verifyPassword/signJwt/verifyJwt) stay identical.
 */
import crypto from 'node:crypto';

const SCRYPT_N = 16384, SCRYPT_r = 8, SCRYPT_p = 1, KEYLEN = 64;

/** Returns "scrypt$N$r$p$saltHex$hashHex". */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), salt, expected.length,
      { N: Number(N), r: Number(r), p: Number(p) });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** Sign an HS256 JWT. Default lifetime 7 days. */
export function signJwt(payload, secret, expiresInSec = 60 * 60 * 24 * 7) {
  if (!secret) throw new Error('JWT secret is required');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec }));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Verify + decode an HS256 JWT. Throws on tamper/expiry. */
export function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Bad signature');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Token expired');
  return payload;
}

/** Hex SHA-256 — we persist only the HASH of single-use tokens (invites,
 * email-verification, password-reset, refresh), never the raw value. */
export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** Cryptographically-random URL-safe token (default 32 bytes → 43 chars). */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export default { hashPassword, verifyPassword, signJwt, verifyJwt, sha256, randomToken };
