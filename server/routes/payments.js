/**
 * Razorpay payment rails for FreelanceOS.
 *
 * Turns invoices from documents into payable requests:
 *   POST /api/payments/payment-link   → shareable Razorpay Payment Link (UPI/card/netbanking)
 *   POST /api/payments/create-order   → order for the embedded Checkout
 *   POST /api/payments/webhook        → verify signature, report paid status
 *
 * Needs RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (and RAZORPAY_WEBHOOK_SECRET for
 * the webhook). Without them every route returns 503 and the UI falls back to
 * the no-key UPI deep link.
 */
import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

// Lazy-load the SDK so the server still boots if the dep isn't installed yet.
async function getClient() {
  const { default: Razorpay } = await import('razorpay');
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

const notConfigured = (res) =>
  res.status(503).json({
    error: 'Payments not configured',
    hint: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.',
  });

/** Razorpay Payment Link — the simplest "get paid" flow (no frontend SDK needed). */
router.post('/payment-link', async (req, res) => {
  if (!razorpayConfigured()) return notConfigured(res);
  const { invoiceId, amount, currency = 'INR', customer = {}, description = '' } = req.body || {};
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount required' });
  try {
    const rzp = await getClient();
    const link = await rzp.paymentLink.create({
      amount: Math.round(amount * 100), // paise
      currency,
      description: description || `Invoice ${invoiceId || ''}`.trim(),
      customer: { name: customer.name, email: customer.email, contact: customer.contact },
      notify: { sms: Boolean(customer.contact), email: Boolean(customer.email) },
      reference_id: invoiceId ? String(invoiceId) : undefined,
      notes: { invoiceId: String(invoiceId || ''), source: 'FreelanceOS' },
    });
    res.json({ id: link.id, shortUrl: link.short_url, status: link.status });
  } catch (e) {
    res.status(502).json({ error: e?.error?.description || e.message });
  }
});

/** Order for Razorpay Checkout (embedded). */
router.post('/create-order', async (req, res) => {
  if (!razorpayConfigured()) return notConfigured(res);
  const { invoiceId, amount, currency = 'INR' } = req.body || {};
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount required' });
  try {
    const rzp = await getClient();
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: invoiceId ? `inv_${invoiceId}` : undefined,
      notes: { invoiceId: String(invoiceId || ''), source: 'FreelanceOS' },
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    res.status(502).json({ error: e?.error?.description || e.message });
  }
});

/** Webhook — verify HMAC signature and surface the paid event. */
router.post('/webhook', (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Webhook secret not configured' });
  const signature = req.headers['x-razorpay-signature'];
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.from('')).digest('hex');
  if (signature !== expected) return res.status(400).json({ error: 'Invalid signature' });

  const event = req.body?.event;
  const entity = req.body?.payload?.payment?.entity || req.body?.payload?.payment_link?.entity || {};
  // In production: mark the invoice paid in your DB here using entity.notes.invoiceId.
  console.log('[razorpay webhook]', event, entity?.id, entity?.notes?.invoiceId);
  res.json({ received: true });
});

export default router;
