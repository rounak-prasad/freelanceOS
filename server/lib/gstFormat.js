/**
 * gstFormat.js — Shared formatting helpers for the GST filing builders
 * (e-invoice, e-way bill, GSTR-1). Money is stored in minor units (paise);
 * the government schemas want rupees with 2 decimals.
 */
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** paise (minor units) → rupees, 2dp. */
export const paise = (minor) => round2((Number(minor) || 0) / 100);

/** GST rate fraction (0.18) → percentage number (18). */
export const ratePct = (frac) => Math.round((Number(frac) || 0) * 1000) / 10;

/** Tolerant 15-char GSTIN check (format, not checksum). */
export const isGstin = (g) => typeof g === 'string' && /^[0-9A-Z]{15}$/.test(g);

/** ISO 'YYYY-MM-DD' → 'DD/MM/YYYY' (e-invoice / e-way bill). */
export function toDDMMYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
}

/** ISO 'YYYY-MM-DD' → 'DD-MM-YYYY' (GSTR-1 invoice date format). */
export const toDDMMYYYYdash = (iso) => toDDMMYYYY(iso).replace(/\//g, '-');

/** Indian financial year string for a date, e.g. 2025 (Jun) → '2025-26'. */
export function fyString(dateLike) {
  const d = new Date(dateLike || Date.now());
  const y = d.getUTCFullYear();
  const fyStart = d.getUTCMonth() >= 3 ? y : y - 1; // FY starts in April (month index 3)
  return `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

/** 'MMYYYY' filing period → { fromISO, toISO, fp }. */
export function periodToRange(mmYYYY) {
  const s = String(mmYYYY || '');
  const mm = Number(s.slice(0, 2));
  const yyyy = Number(s.slice(2));
  if (!mm || mm < 1 || mm > 12 || !yyyy) throw new Error(`Invalid period "${mmYYYY}" — expected MMYYYY, e.g. 052026`);
  const iso = (d) => d.toISOString().slice(0, 10);
  return {
    fromISO: iso(new Date(Date.UTC(yyyy, mm - 1, 1))),
    toISO: iso(new Date(Date.UTC(yyyy, mm, 0))), // last day of month
    fp: `${String(mm).padStart(2, '0')}${yyyy}`,
  };
}

export default { round2, paise, ratePct, isGstin, toDDMMYYYY, toDDMMYYYYdash, fyString, periodToRange };
