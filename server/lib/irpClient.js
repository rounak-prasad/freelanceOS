/**
 * irpClient.js — Adapter for the Invoice Registration Portal (IRP) / e-way bill
 * system, accessed in production through a GSP/ASP.
 *
 *   • SANDBOX (default): no credentials → deterministic, offline IRN / e-way
 *     numbers so the whole flow is exercisable locally and in tests. The IRN is
 *     the documented SHA-256 of {SellerGSTIN, DocType, DocNo, FY}; the signed QR
 *     is a base64 JSON stand-in for the IRP's JWS.
 *   • LIVE: set IRP_BASE_URL + IRP_API_KEY (your GSP endpoint + token). The exact
 *     request/response contract varies by GSP; the shape here is representative
 *     and only runs when those env vars are present.
 *
 * Going live requires a GSP/ASP contract and the GSTIN enabled for e-invoicing
 * on the government portal — see SETUP.md.
 */
import crypto from 'node:crypto';
import { fyString } from './gstFormat.js';

export const irpConfigured = () => Boolean(process.env.IRP_BASE_URL && process.env.IRP_API_KEY);

function parseDdmmyyyy(s) {
  if (!s) return Date.now();
  const [d, m, y] = String(s).split('/');
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/** Deterministic sandbox IRN/ack/QR for an e-invoice payload. */
export function sandboxEInvoice(payload) {
  const gstin = payload?.SellerDtls?.Gstin || '';
  const no = payload?.DocDtls?.No || '';
  const typ = payload?.DocDtls?.Typ || 'INV';
  const fy = fyString(parseDdmmyyyy(payload?.DocDtls?.Dt));
  const irn = crypto.createHash('sha256').update(`${gstin}-${typ}-${no}-${fy}`).digest('hex'); // 64 hex
  const ackNo = String((BigInt('0x' + irn.slice(0, 12)) % 9000000000n) + 1000000000n);
  const ackDt = new Date().toISOString();
  const qr = { irn, ackNo, ackDt, sellerGstin: gstin, buyerGstin: payload?.BuyerDtls?.Gstin, docNo: no, totInvVal: payload?.ValDtls?.TotInvVal };
  const signedQrCode = Buffer.from(JSON.stringify(qr)).toString('base64');
  return { mode: 'sandbox', irn, ackNo, ackDt, signedQrCode, status: 'ACT' };
}

export async function submitEInvoice(payload) {
  if (irpConfigured()) {
    const res = await fetch(`${process.env.IRP_BASE_URL.replace(/\/$/, '')}/einvoice/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.IRP_API_KEY}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || `IRP request failed (${res.status})`);
    return {
      mode: 'live',
      irn: data.Irn || data.irn,
      ackNo: data.AckNo || data.ackNo,
      ackDt: data.AckDt || data.ackDt,
      signedQrCode: data.SignedQRCode || data.signedQrCode,
      status: data.Status || 'ACT',
    };
  }
  return sandboxEInvoice(payload);
}

/** Deterministic sandbox 12-digit e-way bill number. */
export function sandboxEWayBill(payload) {
  const seed = crypto.createHash('sha256').update(`${payload?.fromGstin || ''}-${payload?.docNo || ''}-ewb`).digest('hex');
  const ewbNo = String((BigInt('0x' + seed.slice(0, 12)) % 900000000000n) + 100000000000n); // 12 digits
  return { mode: 'sandbox', ewbNo, ewbDt: new Date().toISOString(), validUpto: new Date(Date.now() + 86400000).toISOString() };
}

export async function generateEWayBill(payload) {
  if (irpConfigured()) {
    const res = await fetch(`${process.env.IRP_BASE_URL.replace(/\/$/, '')}/ewaybill/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.IRP_API_KEY}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || `E-way bill request failed (${res.status})`);
    return { mode: 'live', ewbNo: data.ewayBillNo || data.ewbNo, ewbDt: data.ewayBillDate || data.ewbDt, validUpto: data.validUpto };
  }
  return sandboxEWayBill(payload);
}

export default { irpConfigured, submitEInvoice, generateEWayBill, sandboxEInvoice, sandboxEWayBill };
