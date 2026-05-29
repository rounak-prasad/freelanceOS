// Standalone Node test harness for the pure-logic modules (no React, no deps).
// Run: node tests/logic.test.mjs
import {
  computeIncomeTax, presumptiveIncome44ADA, isEligible44ADA,
  gstOnInvoice, tdsOn, advanceTaxSchedule,
} from '../src/config/taxRules.js';
import { runGuardrails } from '../src/services/complianceEngine.js';
import { compareAll, computeNet, PROVIDERS } from '../src/services/fxLeakage.js';
import { forecast } from '../src/services/cashflow.js';

let pass = 0, fail = 0;
const approx = (a, b, t = 1) => Math.abs(a - b) <= t;
function ok(name, cond, extra = '') { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', name, extra); } }

console.log('— Income tax (FY25-26 new regime) —');
ok('₹0 income → ₹0', computeIncomeTax(0).total === 0);
ok('₹12L income → ₹0 (87A rebate)', computeIncomeTax(1200000).total === 0, JSON.stringify(computeIncomeTax(1200000)));
// ₹16L: slab tax = 0(4L)+20k(4-8)+40k(8-12)+60k(12-16)=120000; +4% cess=124800
ok('₹16L → ~₹1,24,800', approx(computeIncomeTax(1600000).total, 124800, 5), JSON.stringify(computeIncomeTax(1600000)));
// ₹24L: 20k+40k+60k+80k(16-20 @20%)+100k(20-24 @25%)=300000; cess 12000 => 312000
ok('₹24L → ~₹3,12,000', approx(computeIncomeTax(2400000).total, 312000, 10), JSON.stringify(computeIncomeTax(2400000)));
ok('effective rate < 30% at ₹24L', computeIncomeTax(2400000).effectiveRate < 0.30);

console.log('— Section 44ADA —');
ok('presumptive 50%', presumptiveIncome44ADA(2000000) === 1000000);
ok('software dev eligible', isEligible44ADA('information_technology', 4000000, 1).eligible === true);
ok('content writer NOT eligible', isEligible44ADA('content_writing', 1000000, 1).eligible === false);
ok('over ₹75L not eligible', isEligible44ADA('information_technology', 8000000, 1).eligible === false);

console.log('— GST (the export zero-rating fix) —');
const exp = gstOnInvoice({ amount: 100000, isExportOfService: true, hasLUT: true });
ok('export+LUT → ZERO GST (was 18% bug)', exp.total === 0 && exp.zeroRated === true, JSON.stringify(exp));
const expNoLut = gstOnInvoice({ amount: 100000, isExportOfService: true, hasLUT: false });
ok('export no-LUT → IGST 18% refundable', expNoLut.igst === 18000 && !expNoLut.zeroRated);
const dom = gstOnInvoice({ amount: 100000, sameState: true });
ok('domestic intra → CGST+SGST 9+9', dom.cgst === 9000 && dom.sgst === 9000 && dom.total === 18000);
const inter = gstOnInvoice({ amount: 100000, sameState: false });
ok('domestic inter → IGST 18', inter.igst === 18000);

console.log('— TDS —');
ok('194J 10%', tdsOn(100000, '194J', true).amount === 10000);
ok('no PAN → 20%', tdsOn(100000, '194J', false).amount === 20000);

console.log('— Advance tax (the flat-30% fix: schedule from real liability) —');
const sched = advanceTaxSchedule(124800, false);
ok('4 instalments', sched.length === 4);
ok('cum 15/45/75/100', sched[0].cum === 0.15 && sched[3].cum === 1);
ok('instalments sum to liability', approx(sched.reduce((s, x) => s + x.instalment, 0), 124800, 2));
ok('44ADA → single 15-Mar instalment', advanceTaxSchedule(124800, true).length === 1);

console.log('— Compliance guardrails —');
const alerts = runGuardrails({
  professionKey: 'content_writing', using44ADA: true, grossReceipts: 1500000,
  foreignAccounts: [{ platform: 'PayPal', active: true }],
  expenses: [{ vendor: 'Adobe Creative Cloud', amount: 4000 }, { vendor: 'Figma', amount: 1200 }],
  annualTurnover: 2500000, gstRegistered: false,
  taxLiability: 200000, paidSoFar: 0, today: new Date('2026-06-05'),
});
const ids = alerts.map((a) => a.id);
ok('flags 44ADA ineligibility', ids.includes('sec44ada-ineligible'), ids.join(','));
ok('flags Schedule FA trap', ids.includes('schedule-fa'));
ok('flags RCM foreign SaaS', ids.includes('rcm-foreign-saas'));
ok('flags GST threshold crossed', ids.includes('gst-threshold-crossed'));
ok('flags advance tax (due 15 Jun)', ids.includes('advance-tax-due'), ids.join(','));
ok('critical sorted first', alerts[0].severity === 'critical');
const clean = runGuardrails({ professionKey: 'information_technology', using44ADA: true, grossReceipts: 3000000, foreignAccounts: [], expenses: [{ vendor: 'local chai', amount: 50 }], annualTurnover: 3000000, gstRegistered: true, taxLiability: 0 });
ok('clean IT profile → no critical traps', !clean.some((a) => a.severity === 'critical'), clean.map(a=>a.id).join(','));

console.log('— FX leakage —');
const cmp = compareAll(2000, 86);
ok('Skydo/Razorpay beat PayPal', cmp.best.net > cmp.worst.net);
ok('gap per $1000 is material (>₹2000)', cmp.gapPer1000 > 2000, 'gap/1k=' + cmp.gapPer1000);
ok('PayPal is worst', cmp.worst.providerName === 'PayPal', cmp.worst.providerName);
const skydo = computeNet(2000, 86, PROVIDERS.find(p => p.id === 'skydo'));
ok('Skydo $2000 fee ≈ $19 (₹1634)', approx(skydo.totalCost, 19 * 86, 50), JSON.stringify(skydo));

console.log('— Cash-flow forecast —');
const fc = forecast({
  invoices: [{ total: 100000, status: 'sent', dueDate: '2026-06-20' }],
  recurringSchedules: [{ amount: 50000, dayOfMonth: 1, active: true }],
  pipeline: [{ value: 300000, stage: 'proposal', expectedCloseDate: '2026-07-15' }],
}, { months: 4, monthlyFloor: 80000, taxLiability: 120000, is44ADA: false, openingBalance: 20000, today: new Date('2026-05-29') });
ok('produces 4 months', fc.months.length === 4);
ok('month has expectedIn', fc.months.some((m) => m.expectedIn > 0));
ok('advance-tax overlaid in June', fc.months[1].taxDue > 0, JSON.stringify(fc.months[1]));
ok('suggestion present', typeof fc.suggestion === 'string' && fc.suggestion.length > 0);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
