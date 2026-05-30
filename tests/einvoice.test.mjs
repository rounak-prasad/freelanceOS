// GST filing: e-invoice (IRP) payload + validation, e-way bill, GSTR-1 sections,
// and the deterministic IRP sandbox. Pure functions — no DB. Run: node tests/einvoice.test.mjs
import { buildEInvoicePayload, validateEInvoice, supplyType } from '../server/lib/einvoice.js';
import { buildEWayBillPayload, validateEWayBill } from '../server/lib/ewaybill.js';
import { buildGstr1, summarizeGstr1 } from '../server/lib/gstr1.js';
import { sandboxEInvoice, submitEInvoice, sandboxEWayBill } from '../server/lib/irpClient.js';
import { periodToRange, fyString } from '../server/lib/gstFormat.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

const ws = { gstin: '29ABCDE1234F1Z5', legal_name: 'Asha Tech', name: 'Asha', state_code: '29', pincode: '560001', address: '1 MG Rd', city: 'Bengaluru' };
const item = (over = {}) => ({ description: 'Dev work', quantity: 1, unit_price_minor: 10000000, amount_minor: 10000000, hsn_sac: '998314', unit: 'OTH', ...over });

console.log('— e-invoice payload: B2B intra-state —');
const clientReg = { name: 'Acme Pvt Ltd', gstin: '29AABCA1234A1Z5', state_code: '29' };
const invDom = { number: 'INV-0001', issue_date: '2026-05-10', gst_rate: 0.18, same_state: 1, is_export: 0, zero_rated: 0,
  subtotal_minor: 10000000, cgst_minor: 900000, sgst_minor: 900000, igst_minor: 0, total_minor: 11800000, place_of_supply: '29' };
const r1 = buildEInvoicePayload({ invoice: invDom, workspace: ws, client: clientReg, items: [item()] });
ok('supType B2B', r1.supType === 'B2B');
ok('CGST+SGST split per line', r1.payload.ItemList[0].CgstAmt === 9000 && r1.payload.ItemList[0].SgstAmt === 9000 && r1.payload.ItemList[0].IgstAmt === 0);
ok('HSN carried through', r1.payload.ItemList[0].HsnCd === '998314');
ok('ValDtls reconciles to ₹1,18,000', r1.payload.ValDtls.TotInvVal === 118000 && r1.payload.ValDtls.AssVal === 100000);

console.log('— e-invoice payload: export under LUT (zero-rated) —');
const clientExp = { name: 'US Corp', gstin: null, state_code: '96', country: 'US' };
const invExpWO = { number: 'INV-0002', issue_date: '2026-05-12', gst_rate: 0, same_state: 0, is_export: 1, zero_rated: 1,
  subtotal_minor: 10000000, cgst_minor: 0, sgst_minor: 0, igst_minor: 0, total_minor: 10000000, place_of_supply: '96' };
const r2 = buildEInvoicePayload({ invoice: invExpWO, workspace: ws, client: clientExp, items: [item({ description: 'Consulting' })] });
ok('supType EXPWOP', r2.supType === 'EXPWOP');
ok('no GST on zero-rated export', r2.payload.ValDtls.IgstVal === 0 && r2.payload.ValDtls.TotInvVal === 100000 && r2.payload.ItemList[0].GstRt === 0);

console.log('— e-invoice payload: export with IGST (no LUT) —');
const invExpW = { number: 'INV-0003', issue_date: '2026-05-13', gst_rate: 0.18, same_state: 0, is_export: 1, zero_rated: 0,
  subtotal_minor: 10000000, cgst_minor: 0, sgst_minor: 0, igst_minor: 1800000, total_minor: 11800000, place_of_supply: '96' };
const r3 = buildEInvoicePayload({ invoice: invExpW, workspace: ws, client: clientExp, items: [item()] });
ok('supType EXPWP', r3.supType === 'EXPWP');
ok('IGST charged on line + ValDtls', r3.payload.ItemList[0].IgstAmt === 18000 && r3.payload.ValDtls.IgstVal === 18000 && r3.payload.ValDtls.TotInvVal === 118000);

console.log('— e-invoice validation —');
ok('valid B2B passes', validateEInvoice({ invoice: invDom, workspace: ws, client: clientReg, items: [item()] }).ok === true);
ok('missing HSN fails', validateEInvoice({ invoice: invDom, workspace: ws, client: clientReg, items: [item({ hsn_sac: null })] }).ok === false);
ok('B2C invoice (no buyer GSTIN) is not e-invoice eligible', validateEInvoice({ invoice: invDom, workspace: ws, client: { name: 'NoGstin' }, items: [item()] }).ok === false);
ok('missing workspace GSTIN fails', validateEInvoice({ invoice: invDom, workspace: { ...ws, gstin: '' }, client: clientReg, items: [item()] }).ok === false);

console.log('— IRP sandbox (deterministic) —');
const s1 = sandboxEInvoice(r1.payload);
const s2 = sandboxEInvoice(r1.payload);
ok('IRN is 64 hex chars', /^[0-9a-f]{64}$/.test(s1.irn));
ok('IRN deterministic for same invoice', s1.irn === s2.irn);
ok('different invoice → different IRN', sandboxEInvoice(r2.payload).irn !== s1.irn);
ok('signed QR decodes to JSON with the IRN', JSON.parse(Buffer.from(s1.signedQrCode, 'base64').toString()).irn === s1.irn);
const submitted = await submitEInvoice(r1.payload); // no IRP_* env → sandbox
ok('submitEInvoice falls back to sandbox', submitted.mode === 'sandbox' && submitted.irn === s1.irn);

console.log('— e-way bill —');
const ewb = buildEWayBillPayload({ invoice: invDom, workspace: ws, client: clientReg, items: [item()] });
ok('EWB fromGstin + totInvValue', ewb.fromGstin === ws.gstin && ewb.totInvValue === 118000 && ewb.itemList.length === 1);
ok('EWB validates with GSTIN', validateEWayBill({ invoice: invDom, workspace: ws }).ok === true);
ok('EWB sandbox number is 12 digits', /^[0-9]{12}$/.test(sandboxEWayBill(ewb).ewbNo));

console.log('— GSTR-1 sections —');
const gstr1Invoices = [
  { number: 'INV-0001', issue_date: '2026-05-10', gst_rate: 0.18, same_state: 1, is_export: 0, zero_rated: 0, subtotal_minor: 10000000, cgst_minor: 900000, sgst_minor: 900000, igst_minor: 0, total_minor: 11800000, client_gstin: '29AABCA1234A1Z5', client_state_code: '29', place_of_supply: '29' },
  { number: 'INV-0002', issue_date: '2026-05-12', gst_rate: 0, same_state: 0, is_export: 1, zero_rated: 1, subtotal_minor: 10000000, cgst_minor: 0, sgst_minor: 0, igst_minor: 0, total_minor: 10000000, client_gstin: null, client_state_code: '96', place_of_supply: '96' },
  { number: 'INV-0003', issue_date: '2026-05-15', gst_rate: 0.18, same_state: 0, is_export: 0, zero_rated: 0, subtotal_minor: 30000000, cgst_minor: 0, sgst_minor: 0, igst_minor: 5400000, total_minor: 35400000, client_gstin: null, client_state_code: '27', place_of_supply: '27' }, // inter-state unregistered > ₹2.5L → b2cl
  { number: 'INV-0004', issue_date: '2026-05-18', gst_rate: 0.18, same_state: 1, is_export: 0, zero_rated: 0, subtotal_minor: 500000, cgst_minor: 45000, sgst_minor: 45000, igst_minor: 0, total_minor: 590000, client_gstin: null, client_state_code: '29', place_of_supply: '29' }, // intra unregistered small → b2cs
];
const g = buildGstr1({ invoices: gstr1Invoices, workspace: ws, period: '052026' });
ok('b2b: one registered buyer', g.b2b && g.b2b.length === 1 && g.b2b[0].ctin === '29AABCA1234A1Z5');
ok('b2b inv carries rate + taxable', g.b2b[0].inv[0].itms[0].itm_det.txval === 100000 && g.b2b[0].inv[0].itms[0].itm_det.rt === 18);
ok('exp: WOPAY export present', g.exp && g.exp[0].exp_typ === 'WOPAY' && g.exp[0].inv[0].itms[0].iamt === 0);
ok('b2cl: inter-state > ₹2.5L', g.b2cl && g.b2cl.length === 1 && g.b2cl[0].pos === '27' && g.b2cl[0].inv[0].itms[0].iamt === 54000);
ok('b2cs: intra unregistered aggregated', g.b2cs && g.b2cs.length === 1 && g.b2cs[0].sply_ty === 'INTRA' && g.b2cs[0].txval === 5000);
ok('GSTR-1 carries gstin + period', g.gstin === ws.gstin && g.fp === '052026');
const sum = summarizeGstr1(gstr1Invoices);
ok('summary counts sections', sum.b2b === 1 && sum.exp === 1 && sum.b2cl === 1 && sum.b2cs === 1 && sum.invoices === 4);

console.log('— period + FY helpers —');
const range = periodToRange('052026');
ok('period → ISO range', range.fromISO === '2026-05-01' && range.toISO === '2026-05-31' && range.fp === '052026');
ok('FY string (May 2026 → 2026-27)', fyString('2026-05-10') === '2026-27');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
