/**
 * contractTemplate.js — India-law freelance contract generator (no API needed).
 *
 * The old Contract Generator only worked via a browser-side Anthropic call that
 * always failed (no auth headers) — so it never produced a contract. This builds
 * a complete, India-specific service agreement deterministically from the form,
 * with the clauses online US templates miss: GST treatment, TDS (194J),
 * IP-transfer-on-full-payment, MSMED Act late-payment interest, and arbitration
 * jurisdiction under Indian law. Works offline; AI refinement is optional.
 *
 * ⚠️ Decision-support, not legal advice — have a lawyer review before signing.
 */

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function paymentSchedule(value, terms) {
  const v = Number(value) || 0;
  switch (terms) {
    case '50% Advance':
      return [`50% advance (${inr(v * 0.5)}) before work begins`, `50% balance (${inr(v * 0.5)}) on delivery / before final files are released`];
    case '30-60-10':
      return [`30% advance (${inr(v * 0.3)}) on signing`, `60% (${inr(v * 0.6)}) at the agreed midpoint milestone`, `10% (${inr(v * 0.1)}) on completion`];
    case '100% on delivery':
      return [`100% (${inr(v)}) due on delivery, within the payment window below`];
    default:
      return [`As mutually agreed in writing, totalling ${inr(v)}`];
  }
}

/**
 * @param {object} form  yourName, clientName, description, value, paymentTerms,
 *                       startDate, endDate, revisions, governingState
 * @param {object} settings  businessName, address, gstin, pan, paymentTermsDays, changeRate, udyam
 */
export function buildIndiaContract(form, settings = {}) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const freelancer = form.yourName || settings.businessName || settings.yourName || 'The Freelancer';
  const addr = settings.address || 'India';
  const gstin = settings.gstin || settings.gstIn || '';
  const pan = settings.pan || settings.panNumber || '';
  const dueDays = settings.defaultPaymentTerms ?? settings.paymentTermsDays ?? 15;
  const changeRate = settings.changeRequestRate || settings.hourlyRate || '';
  const state = form.governingState || 'Maharashtra';
  const sched = paymentSchedule(form.value, form.paymentTerms);

  return `FREELANCE SERVICE AGREEMENT

This Service Agreement ("Agreement") is made on ${today} under the Indian Contract Act, 1872, between:

(1) ${freelancer}${gstin ? `, GSTIN ${gstin}` : ''}${pan ? `, PAN ${pan}` : ''}, having its place of business at ${addr} ("Freelancer"); and
(2) ${form.clientName} ("Client").

The Freelancer and the Client are referred to individually as a "Party" and collectively as the "Parties".

1. SCOPE OF WORK
   1.1 The Freelancer agrees to provide the following services ("Services"):
       ${form.description}
   1.2 Any work not expressly described above is outside the scope of this Agreement and shall be treated as a Change Request under Clause 5.

2. TERM
   2.1 This Agreement commences on ${form.startDate || '[start date]'} and is expected to complete by ${form.endDate || '[end date]'}, unless extended by mutual written consent.

3. FEES & PAYMENT
   3.1 The total professional fee for the Services is ${inr(form.value)} (exclusive of taxes).
   3.2 Payment schedule:
${sched.map((s, i) => `       (${String.fromCharCode(97 + i)}) ${s}`).join('\n')}
   3.3 Invoices are payable within ${dueDays} days of the invoice date.
   3.4 GST: Fees are exclusive of GST. Where the Freelancer is GST-registered, GST at the applicable rate (currently 18%) shall be charged in addition. For export of services to a client outside India, the supply is zero-rated under a Letter of Undertaking (LUT) per Section 16 of the IGST Act, and no GST shall be charged.

4. TDS (TAX DEDUCTED AT SOURCE)
   4.1 If the Client is required to deduct tax at source under Section 194J of the Income-tax Act, 1961 (professional/technical services, presently 10%), such deduction shall be made and a TDS certificate in Form 16A issued to the Freelancer within statutory timelines.
   4.2 The Client shall ensure the deducted amount reflects in the Freelancer's Form 26AS / AIS. TDS is a deduction against the Freelancer's tax liability and not a reduction of the agreed fee.

5. REVISIONS & CHANGE REQUESTS (SCOPE CONTROL)
   5.1 The fee includes ${form.revisions ?? 3} round(s) of revisions on the agreed deliverables.
   5.2 Additional revisions or any work beyond Clause 1 require a written Change Request approved by both Parties and shall be billed separately${changeRate ? ` at ${inr(changeRate)} per hour` : ' at the Freelancer\'s prevailing rate'}.
   5.3 "Unlimited revisions" are expressly not offered under this Agreement.

6. INTELLECTUAL PROPERTY
   6.1 All intellectual property created under this Agreement shall transfer to the Client ONLY upon receipt of full payment of all sums due.
   6.2 Until full payment is received, the Freelancer retains all rights, title and interest in the work product, and the Client has no licence to use it.
   6.3 The Freelancer may display the work in a portfolio unless the Parties agree otherwise in writing.

7. LATE PAYMENT (MSMED ACT)
   7.1 Amounts not paid by the due date shall carry interest. Where the Freelancer is registered under the Udyam/MSME regime, interest shall accrue at three times the RBI-notified bank rate, compounded monthly, per Sections 15–16 of the MSMED Act, 2006.
   7.2 The Freelancer may suspend work and withhold deliverables until overdue amounts are cleared.

8. CONFIDENTIALITY
   8.1 Each Party shall keep confidential all non-public information of the other Party and use it solely to perform this Agreement. This clause survives termination.

9. TERMINATION
   9.1 Either Party may terminate this Agreement with 30 days' written notice.
   9.2 On termination, the Client shall pay for all Services performed and approved up to the termination date, and the Freelancer shall hand over paid-for deliverables.

10. FORCE MAJEURE
   10.1 Neither Party is liable for delays caused by events beyond reasonable control (e.g. natural disasters, internet/power outages, government action).

11. DISPUTE RESOLUTION & GOVERNING LAW
   11.1 This Agreement is governed by the laws of India.
   11.2 Disputes shall first be attempted to be resolved amicably; failing which, by arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996, seated in ${state}, India, in English.
   11.3 Subject to arbitration, the courts at ${state}, India shall have exclusive jurisdiction.

12. ENTIRE AGREEMENT
   12.1 This Agreement is the entire understanding between the Parties and supersedes prior discussions. Amendments must be in writing and signed by both Parties.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.


_____________________________            _____________________________
${freelancer}                              ${form.clientName}
(Freelancer)                               (Client)
Date:                                      Date:

— Generated by FreelanceOS. This is a starting template, not legal advice; have it reviewed by a qualified lawyer before signing.`;
}

export default { buildIndiaContract };
