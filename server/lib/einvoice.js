/**
 * einvoice.js — Build the NIC IRP e-invoice JSON (schema v1.1) for an invoice,
 * plus a validator for the fields the IRP requires. Pure functions: pass plain
 * rows (invoice + workspace + client + items); no DB or network here.
 *
 * Per-line GST is derived from the invoice's authoritative rate + intra/inter
 * state flag and summed into ValDtls, so ItemList and ValDtls reconcile by
 * construction (the IRP rejects mismatched totals).
 */
import { round2, paise, ratePct, isGstin, toDDMMYYYY } from './gstFormat.js';

/** Supply type drives the IRP document category. */
export function supplyType(invoice, client) {
  if (invoice.is_export) return invoice.zero_rated ? 'EXPWOP' : 'EXPWP';
  return isGstin(client?.gstin || '') ? 'B2B' : 'B2C';
}

export function buildEInvoicePayload({ invoice, workspace, client, items = [] }) {
  const rate = Number(invoice.gst_rate) || 0; // fraction e.g. 0.18
  const zero = !!invoice.zero_rated;
  const intra = !!invoice.same_state && !invoice.is_export;
  const sup = supplyType(invoice, client);

  let assVal = 0, cgstVal = 0, sgstVal = 0, igstVal = 0;
  const ItemList = items.map((it, idx) => {
    const taxable = paise(it.amount_minor);
    let cgst = 0, sgst = 0, igst = 0;
    if (!zero && rate > 0) {
      if (intra) { cgst = round2((taxable * rate) / 2); sgst = round2((taxable * rate) / 2); }
      else { igst = round2(taxable * rate); }
    }
    assVal = round2(assVal + taxable);
    cgstVal = round2(cgstVal + cgst);
    sgstVal = round2(sgstVal + sgst);
    igstVal = round2(igstVal + igst);
    return {
      SlNo: String(idx + 1),
      PrdDesc: (String(it.description || '').slice(0, 300)) || 'Service',
      IsServc: 'Y',
      HsnCd: it.hsn_sac || '',
      Qty: Number(it.quantity) || 0,
      Unit: it.unit || 'OTH',
      UnitPrice: paise(it.unit_price_minor),
      TotAmt: taxable,
      AssAmt: taxable,
      GstRt: zero ? 0 : ratePct(rate),
      IgstAmt: igst, CgstAmt: cgst, SgstAmt: sgst,
      TotItemVal: round2(taxable + cgst + sgst + igst),
    };
  });

  const totInvVal = round2(assVal + cgstVal + sgstVal + igstVal);
  const pos = (client?.state_code || invoice.place_of_supply || workspace.state_code || '').toString();

  const payload = {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: sup, RegRev: 'N', IgstOnIntra: 'N' },
    DocDtls: { Typ: 'INV', No: String(invoice.number), Dt: toDDMMYYYY(invoice.issue_date) },
    SellerDtls: {
      Gstin: workspace.gstin || '',
      LglNm: workspace.legal_name || workspace.name || '',
      Addr1: workspace.address || 'NA',
      Loc: workspace.city || 'NA',
      Pin: Number(workspace.pincode) || 0,
      Stcd: workspace.state_code || '',
    },
    BuyerDtls: {
      Gstin: client?.gstin || 'URP',
      LglNm: client?.name || client?.company || 'Unregistered',
      Pos: pos,
      Addr1: 'NA', Loc: 'NA', Pin: 0,
      Stcd: client?.state_code || pos || '',
    },
    ItemList,
    ValDtls: { AssVal: assVal, CgstVal: cgstVal, SgstVal: sgstVal, IgstVal: igstVal, TotInvVal: totInvVal },
  };
  return { payload, supType: sup };
}

/** Validate the data needed for a successful IRP submission. */
export function validateEInvoice({ invoice, workspace, client, items = [] }) {
  const errors = [], warnings = [];
  const sup = supplyType(invoice, client);
  if (!isGstin(workspace.gstin || '')) errors.push('Workspace GSTIN is missing or not a valid 15-character GSTIN');
  if (sup === 'B2C') errors.push('e-invoicing applies to B2B supplies and exports — a B2C invoice (no buyer GSTIN) cannot be reported to the IRP');
  if (!items.length) errors.push('Invoice has no line items');
  items.forEach((it, i) => {
    if (!it.hsn_sac) errors.push(`Line ${i + 1} ("${String(it.description || '').slice(0, 30)}") is missing an HSN/SAC code`);
  });
  if (!workspace.state_code) warnings.push('Workspace state code is missing — the IRP requires the seller state code');
  if (!workspace.pincode) warnings.push('Workspace PIN code is not set — using a placeholder for the sandbox');
  return { ok: errors.length === 0, errors, warnings, supType: sup };
}

export default { buildEInvoicePayload, validateEInvoice, supplyType };
