/**
 * gstr1.js — Build the GSTR-1 return JSON (offline-utility shape) from a period's
 * invoices. Pure function: pass enriched invoice rows (with buyer GSTIN/state)
 * + the workspace + the filing period 'MMYYYY'.
 *
 * Each invoice carries a single GST rate (invoice.gst_rate), so the per-rate
 * item breakup is derived from invoice-level totals. Sections produced:
 *   • b2b   — supplies to registered buyers (buyer GSTIN present)
 *   • exp   — exports (WPAY = IGST paid, WOPAY = under LUT / zero-rated)
 *   • b2cl  — inter-state supplies to unregistered buyers, invoice value > ₹2.5L
 *   • b2cs  — all other B2C, aggregated by place-of-supply + rate + supply type
 *
 * Amounts are rupees (2dp). This is decision-support; reconcile in the GST
 * portal / with a CA before filing.
 */
import { round2, paise, ratePct, toDDMMYYYYdash } from './gstFormat.js';

const B2CL_THRESHOLD = 250000; // ₹2.5L

export function buildGstr1({ invoices = [], workspace, period }) {
  const b2bMap = new Map();   // ctin -> inv[]
  const b2clMap = new Map();  // pos  -> inv[]
  const b2csMap = new Map();  // 'INTER|pos|rt' -> aggregate
  const expMap = new Map();   // exp_typ -> inv[]

  for (const i of invoices) {
    const val = paise(i.total_minor);
    const txval = paise(i.subtotal_minor);
    const iamt = paise(i.igst_minor);
    const camt = paise(i.cgst_minor);
    const samt = paise(i.sgst_minor);
    const rt = ratePct(i.gst_rate);
    const idt = toDDMMYYYYdash(i.issue_date);
    const pos = String(i.client_state_code || i.place_of_supply || '').padStart(2, '0').slice(0, 2);
    const interState = !i.same_state;

    if (i.is_export) {
      const exp_typ = i.zero_rated ? 'WOPAY' : 'WPAY';
      const arr = expMap.get(exp_typ) || [];
      arr.push({ inum: i.number, idt, val, itms: [{ txval, rt, iamt: i.zero_rated ? 0 : iamt, csamt: 0 }] });
      expMap.set(exp_typ, arr);
    } else if (i.client_gstin) {
      const arr = b2bMap.get(i.client_gstin) || [];
      arr.push({
        inum: i.number, idt, val, pos, rchrg: 'N', inv_typ: 'R',
        itms: [{ num: 1, itm_det: { rt, txval, iamt, camt, samt, csamt: 0 } }],
      });
      b2bMap.set(i.client_gstin, arr);
    } else if (interState && val > B2CL_THRESHOLD) {
      const arr = b2clMap.get(pos) || [];
      arr.push({ inum: i.number, idt, val, itms: [{ rt, txval, iamt, csamt: 0 }] });
      b2clMap.set(pos, arr);
    } else {
      const sply_ty = interState ? 'INTER' : 'INTRA';
      const key = `${sply_ty}|${pos}|${rt}`;
      const agg = b2csMap.get(key) || { sply_ty, pos, typ: 'OE', rt, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
      agg.txval = round2(agg.txval + txval);
      agg.iamt = round2(agg.iamt + iamt);
      agg.camt = round2(agg.camt + camt);
      agg.samt = round2(agg.samt + samt);
      b2csMap.set(key, agg);
    }
  }

  const out = { gstin: workspace.gstin || '', fp: period, version: 'GST3.1', hash: 'hash' };
  const b2b = [...b2bMap].map(([ctin, inv]) => ({ ctin, inv }));
  const b2cl = [...b2clMap].map(([pos, inv]) => ({ pos, inv }));
  const b2cs = [...b2csMap.values()];
  const exp = [...expMap].map(([exp_typ, inv]) => ({ exp_typ, inv }));
  if (b2b.length) out.b2b = b2b;
  if (b2cl.length) out.b2cl = b2cl;
  if (b2cs.length) out.b2cs = b2cs;
  if (exp.length) out.exp = exp;
  return out;
}

/** Lightweight totals for a UI summary (counts + taxable + tax). */
export function summarizeGstr1(invoices = []) {
  const s = { invoices: invoices.length, b2b: 0, b2cl: 0, b2cs: 0, exp: 0, taxable: 0, tax: 0 };
  for (const i of invoices) {
    s.taxable = round2(s.taxable + paise(i.subtotal_minor));
    s.tax = round2(s.tax + paise(i.cgst_minor) + paise(i.sgst_minor) + paise(i.igst_minor));
    if (i.is_export) s.exp++;
    else if (i.client_gstin) s.b2b++;
    else if (!i.same_state && paise(i.total_minor) > B2CL_THRESHOLD / 1) s.b2cl++;
    else s.b2cs++;
  }
  return s;
}

export default { buildGstr1, summarizeGstr1 };
