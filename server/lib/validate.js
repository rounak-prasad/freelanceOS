/**
 * validate.js — Tiny HTTP error + validation helpers (no dependencies).
 * Routes throw these; the central error handler in server/index.js maps
 * HttpError.status → response code so handlers stay clean.
 */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const bad = (msg, details) => { throw new HttpError(400, msg, details); };
export const unauthorized = (msg = 'Unauthorized') => { throw new HttpError(401, msg); };
export const forbidden = (msg = 'Forbidden') => { throw new HttpError(403, msg); };
export const notFound = (msg = 'Not found') => { throw new HttpError(404, msg); };

/** Wrap an (async) route handler so thrown errors reach Express' error mw. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length) bad(`Missing required field(s): ${missing.join(', ')}`);
}

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));

/** Coerce any truthy/falsy value to a SQLite-safe integer (0/1). */
export const boolInt = (v) => (v ? 1 : 0);
/** Coerce undefined → null (node:sqlite rejects undefined bindings). */
export const orNull = (v) => (v === undefined ? null : v);

export default { HttpError, bad, unauthorized, forbidden, notFound, asyncHandler, requireFields, isEmail, boolInt, orNull };
