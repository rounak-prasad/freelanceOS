/**
 * payments.js — Frontend payment helpers for FreelanceOS.
 *
 * Two layers:
 *  1. UPI deep link / QR — works with ZERO backend and zero keys. Generates an
 *     NPCI-spec upi:// string from the freelancer's own VPA so any invoice can
 *     be paid from any UPI app. This alone fixes "invoices are documents, not
 *     payment requests".
 *  2. Razorpay (Payment Links / Orders) — real money rails via the API server
 *     (server/routes/payments.js). Needs RAZORPAY_KEY_ID/SECRET in the server
 *     env; until then these calls fail gracefully and the UI falls back to UPI.
 */
import { apiPost } from './apiClient.js';

/**
 * Build a UPI deep link (also encode as a QR on the client).
 * @param {{payeeVpa:string, payeeName:string, amount:number, note?:string, txnRef?:string}} p
 */
export function upiLink({ payeeVpa, payeeName, amount, note = '', txnRef = '' }) {
  if (!payeeVpa) return '';
  const params = new URLSearchParams({
    pa: payeeVpa,
    pn: payeeName || 'FreelanceOS',
    am: amount != null ? String(amount) : '',
    cu: 'INR',
    tn: note,
  });
  if (txnRef) params.set('tr', txnRef);
  return `upi://pay?${params.toString()}`;
}

/** Free QR image (no key) via a public QR renderer, encoding any string. */
export function qrImageUrl(data, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/** Create a Razorpay Payment Link for an invoice (server-side, real keys). */
export async function createPaymentLink({ invoiceId, amount, currency = 'INR', customer = {}, description = '' }) {
  return apiPost('/payments/payment-link', { invoiceId, amount, currency, customer, description });
}

/** Create a Razorpay Order (for the embedded checkout flow). */
export async function createOrder({ invoiceId, amount, currency = 'INR' }) {
  return apiPost('/payments/create-order', { invoiceId, amount, currency });
}

export default { upiLink, qrImageUrl, createPaymentLink, createOrder };
