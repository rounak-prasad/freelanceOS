/**
 * ewaybill.js — Build the NIC e-way bill JSON for an invoice. Pure function.
 * E-way bills apply to the movement of goods over ₹50,000; for a services-only
 * freelancer this is rarely needed, but studios shipping goods (prints, devices,
 * merchandise) do need it — so the builder + adapter are provided.
 */
import { paise, toDDMMYYYY } from './gstFormat.js';

export function buildEWayBillPayload({ invoice, workspace, client, items = [], transport = {} }) {
  const fromState = workspace.state_code || '';
  const toState = (client?.state_code || invoice.place_of_supply || fromState).toString();

  const itemList = items.map((it) => ({
    productName: (String(it.description || '').slice(0, 100)) || 'Item',
    hsnCode: it.hsn_sac || '',
    quantity: Number(it.quantity) || 0,
    qtyUnit: it.unit || 'OTH',
    taxableAmount: paise(it.amount_minor),
  }));

  return {
    supplyType: 'O',        // Outward
    subSupplyType: '1',     // Supply
    docType: 'INV',
    docNo: String(invoice.number),
    docDate: toDDMMYYYY(invoice.issue_date),
    fromGstin: workspace.gstin || '',
    fromTrdName: workspace.legal_name || workspace.name || '',
    fromStateCode: fromState,
    actFromStateCode: fromState,
    toGstin: client?.gstin || 'URP',
    toTrdName: client?.name || 'Unregistered',
    toStateCode: toState,
    actToStateCode: toState,
    totalValue: paise(invoice.subtotal_minor),
    cgstValue: paise(invoice.cgst_minor),
    sgstValue: paise(invoice.sgst_minor),
    igstValue: paise(invoice.igst_minor),
    totInvValue: paise(invoice.total_minor),
    transMode: String(transport.mode || '1'),   // 1 = Road
    transDistance: String(transport.distance || '0'),
    transporterId: transport.transporterId || '',
    vehicleNo: transport.vehicleNo || '',
    vehicleType: transport.vehicleType || 'R',   // Regular
    itemList,
  };
}

export function validateEWayBill({ invoice, workspace }) {
  const errors = [], warnings = [];
  if (!workspace.gstin) errors.push('Workspace GSTIN is required to generate an e-way bill');
  if (paise(invoice.total_minor) < 50000) warnings.push('E-way bills are generally mandatory only above ₹50,000 of consignment value');
  return { ok: errors.length === 0, errors, warnings };
}

export default { buildEWayBillPayload, validateEWayBill };
