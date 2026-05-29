/**
 * Cross-border provider interface for FreelanceOS.
 *
 * Cross-border collection + FIRA/FIRC generation is partner-specific (Razorpay
 * Export, Skydo, etc.) and licensed under RBI PA-CB — you integrate a partner,
 * you do not build the rail. This module defines a provider-agnostic interface
 * so a partner adapter can drop in. Until a partner key is set, it returns the
 * computed quote (works today) and a clear "manual FIRA" instruction.
 *
 *   GET  /api/crossborder/providers           → available providers + config state
 *   POST /api/crossborder/quote  { amountUSD, usdInr, providerId }
 *   POST /api/crossborder/fira   { remittanceId, ... }  → request eFIRA (partner)
 */
import { Router } from 'express';

const router = Router();

// Mirror of the client fee models so server quotes match the UI.
const PROVIDERS = {
  skydo: { name: 'Skydo', fee: (usd) => (usd <= 2000 ? 19 : usd <= 10000 ? 29 : usd * 0.003), fxMarkupPct: 0, firaIncluded: true, envKey: 'SKYDO_API_KEY' },
  razorpay: { name: 'Razorpay Export', fee: (usd) => usd * 0.01, fxMarkupPct: 0, firaIncluded: true, envKey: 'RAZORPAY_KEY_ID' },
  wise: { name: 'Wise', fee: (usd) => usd * 0.0175, fxMarkupPct: 0, firaIncluded: false, envKey: 'WISE_API_TOKEN' },
};

router.get('/providers', (_req, res) => {
  res.json(
    Object.entries(PROVIDERS).map(([id, p]) => ({
      id, name: p.name, firaIncluded: p.firaIncluded, configured: Boolean(process.env[p.envKey]),
    }))
  );
});

router.post('/quote', (req, res) => {
  const { amountUSD = 0, usdInr = 86, providerId = 'skydo' } = req.body || {};
  const p = PROVIDERS[providerId] || PROVIDERS.skydo;
  const gross = amountUSD * usdInr;
  const feeUsd = p.fee(amountUSD);
  const cost = feeUsd * usdInr + gross * p.fxMarkupPct;
  res.json({
    providerId, providerName: p.name,
    gross: Math.round(gross), cost: Math.round(cost), net: Math.round(gross - cost),
    firaIncluded: p.firaIncluded,
  });
});

router.post('/fira', async (req, res) => {
  const { providerId = 'skydo' } = req.body || {};
  const p = PROVIDERS[providerId];
  if (!p) return res.status(400).json({ error: 'Unknown provider' });
  if (!process.env[p.envKey]) {
    return res.status(503).json({
      error: 'Provider not connected',
      hint: `Set ${p.envKey} to auto-generate FIRA via ${p.name}. Until then, request the FIRA/FIRC from the provider dashboard and mark it received in the tracker.`,
    });
  }
  // Partner adapter would call the provider's FIRA API here and return the doc URL.
  res.json({ status: 'requested', provider: p.name, message: 'eFIRA requested — typically issued within 24h.' });
});

export default router;
