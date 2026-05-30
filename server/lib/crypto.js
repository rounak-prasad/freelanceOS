/**
 * crypto.js — Field-level encryption at rest (AES-256-GCM).
 *
 * Sensitive data (the per-tenant app_state blob: bank details, UPI, the foreign
 * account / FIRA register) is encrypted before it touches the database. The key
 * is derived from DATA_ENCRYPTION_KEY (any passphrase → SHA-256 → 32 bytes).
 *
 * Graceful by design:
 *   • No key set (dev/test): encryptString is a pass-through, so the zero-config
 *     experience is unchanged. decryptString returns plaintext untouched.
 *   • Key set: values are sealed as `enc:v1:<iv>.<tag>.<ciphertext>` (base64url).
 *     GCM's auth tag means tampering or a wrong key throws on decrypt.
 *   • Legacy plaintext rows (written before a key existed) decrypt as-is, so
 *     enabling encryption is non-breaking; new writes are encrypted.
 */
import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';

function getKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash('sha256').update(String(raw)).digest(); // 32 bytes
}

export const isEncryptionEnabled = () => getKey() !== null;
export const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

export function encryptString(plaintext) {
  const key = getKey();
  if (key === null || plaintext == null) return plaintext; // pass-through (no key / null)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptString(value) {
  if (!isEncrypted(value)) return value; // legacy plaintext / pass-through
  const key = getKey();
  if (key === null) throw new Error('Encrypted data found but DATA_ENCRYPTION_KEY is not set');
  const [ivb, tagb, ctb] = value.slice(PREFIX.length).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivb, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagb, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctb, 'base64url')), decipher.final()]).toString('utf8');
}

export default { encryptString, decryptString, isEncryptionEnabled, isEncrypted };
