/**
 * invoiceService.js — Server-side invoice math, reusing the SAME versioned tax
 * engine the UI uses (src/config/taxRules.js) so GST is computed once,
 * authoritatively, on the server — never trusted from the client.
 *
 * Money is handled in MINOR units (paise) end-to-end. GST is delegated to
 * gstOnInvoice() (rupees), then converted back to paise. This keeps a single
 * source of truth for the export/LUT zero-rating and CGST/SGST/IGST split.
 */
import { gstOnInvoice, GST_RATE_DEFAULT } from '../../src/config/taxRules.js';

/**
 * @param {object} p
 * @param {Array}  p.items  [{ description, quantity, unitPriceMinor }]
 * @param {boolean} p.isExport   export of service (foreign client)
 * @param {boolean} p.hasLUT     supplier has filed an LUT
 * @param {boolean} p.sameState  intra-state supply (CGST+SGST) vs inter-state (IGST)
 * @param {number}  [p.gstRate]  default 18%
 */
export function computeInvoice({ items = [], isExport = false, hasLUT = false, sameState = true, gstRate = GST_RATE_DEFAULT } = {}) {
  const lines = (Array.isArray(items) ? items : []).map((it, i) => {
    const quantity = Number(it.quantity ?? 1) || 0;
    const unitPriceMinor = Math.round(Number(it.unitPriceMinor ?? 0)) || 0;
    const amountMinor = Math.round(quantity * unitPriceMinor);
    return {
      description: String(it.description ?? '').slice(0, 500),
      quantity,
      unitPriceMinor,
      amountMinor,
      position: i,
      hsnSac: it.hsnSac != null && it.hsnSac !== '' ? String(it.hsnSac).slice(0, 8) : null,
      unit: it.unit != null && it.unit !== '' ? String(it.unit).slice(0, 8).toUpperCase() : null,
    };
  });

  const subtotalMinor = lines.reduce((s, l) => s + l.amountMinor, 0);

  const g = gstOnInvoice({
    amount: subtotalMinor / 100,                 // taxRules works in rupees
    isExportOfService: !!isExport,
    hasLUT: !!hasLUT,
    sameState: !!sameState,
    rate: Number(gstRate) || GST_RATE_DEFAULT,
  });

  const cgstMinor = Math.round((g.cgst || 0) * 100);
  const sgstMinor = Math.round((g.sgst || 0) * 100);
  const igstMinor = Math.round((g.igst || 0) * 100);
  const totalMinor = subtotalMinor + cgstMinor + sgstMinor + igstMinor;

  return {
    lines,
    subtotalMinor,
    cgstMinor,
    sgstMinor,
    igstMinor,
    totalMinor,
    gstRate: g.rate,
    zeroRated: !!g.zeroRated,
    gstNote: g.note,
  };
}

export default { computeInvoice };
