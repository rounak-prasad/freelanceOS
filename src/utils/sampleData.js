// ==========================================
// FreelanceOS — Rich Sample Data ($1M Upgrade)
// ==========================================
import { generateId } from './helpers';

const now = new Date();
const today = now.toISOString().split('T')[0];

function daysAgo(n) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysAgoDate(n) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function monthAgo(n) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

// Stable IDs for cross-referencing
const CLIENT_IDS = {
  arjun: 'cl-arjun-001',
  ananya: 'cl-ananya-002',
  karan: 'cl-karan-003',
  shreya: 'cl-shreya-004',
  rishi: 'cl-rishi-005',
  zara: 'cl-zara-006',
};

// ---- 6 CLIENTS (Indian names, companies, states, GSTINs) ----
export const sampleClients = [
  {
    id: CLIENT_IDS.arjun,
    name: 'Arjun Mehta',
    company: 'PaySwift FinTech Pvt. Ltd.',
    email: 'arjun@payswift.in',
    phone: '+91 98200 11234',
    projectName: 'FinTech Dashboard Redesign',
    status: 'In Progress',
    projectValue: 250000,
    gstin: '27AABCP1234M1ZP',
    address: 'Andheri East, Mumbai, Maharashtra 400069',
    notes: 'Series A funded startup. Decision maker. Pays via NEFT within 7 days. Prefers Slack but responds on WhatsApp too.',
    createdAt: monthAgo(6),
    lastContactedAt: daysAgo(2),
    isAtRisk: false,
  },
  {
    id: CLIENT_IDS.ananya,
    name: 'Ananya Krishnan',
    company: 'GlowBerry D2C Brands',
    email: 'ananya@glowberry.in',
    phone: '+91 99020 55678',
    projectName: 'Brand Identity & Website',
    status: 'In Progress',
    projectValue: 360000,
    gstin: '29AABCG5678N1ZQ',
    address: 'HSR Layout, Bengaluru, Karnataka 560102',
    notes: 'D2C skincare brand. Very design-conscious. Needs frequent progress updates. Referred by Arjun.',
    createdAt: monthAgo(4),
    lastContactedAt: daysAgo(5),
    isAtRisk: false,
  },
  {
    id: CLIENT_IDS.karan,
    name: 'Karan Patel',
    company: 'Pixel Forge Agency',
    email: 'karan@pixelforge.co',
    phone: '+91 97120 33456',
    projectName: 'Agency Website Revamp',
    status: 'Paid',
    projectValue: 85000,
    gstin: '24AABCF9012P1ZR',
    address: 'SG Highway, Ahmedabad, Gujarat 380015',
    notes: 'White-label partner. Sends sub-contracts. Pays on 30-day terms. Deducts TDS.',
    createdAt: monthAgo(8),
    lastContactedAt: daysAgo(15),
    isAtRisk: false,
  },
  {
    id: CLIENT_IDS.shreya,
    name: 'Shreya Nair',
    company: '',
    email: 'shreya.nair@gmail.com',
    phone: '+91 94960 78901',
    projectName: 'Portfolio Website',
    status: 'Proposal Sent',
    projectValue: 45000,
    gstin: '',
    address: 'Fort Kochi, Kerala 682001',
    notes: 'Individual client. Photographer. No GSTIN. Small budget but potential for referrals.',
    createdAt: monthAgo(1),
    lastContactedAt: daysAgo(40),
    isAtRisk: false,
  },
  {
    id: CLIENT_IDS.rishi,
    name: 'Rishi Aggarwal',
    company: 'CartZone E-commerce Pvt. Ltd.',
    email: 'rishi@cartzone.in',
    phone: '+91 98110 22345',
    projectName: 'E-commerce Mobile App',
    status: 'In Progress',
    projectValue: 500000,
    gstin: '07AABCC3456Q1ZS',
    address: 'Connaught Place, New Delhi 110001',
    notes: 'Biggest client. SaaS dashboard project. Deducts TDS @10%. Has dedicated PM on their side.',
    createdAt: monthAgo(5),
    lastContactedAt: daysAgo(1),
    isAtRisk: false,
  },
  {
    id: CLIENT_IDS.zara,
    name: 'Zara Ahmed',
    company: 'Zara Boutique',
    email: 'zara@zaraboutique.in',
    phone: '+91 95550 44567',
    projectName: 'Retail Website',
    status: 'Overdue',
    projectValue: 65000,
    gstin: '36AABCZ7890R1ZT',
    address: 'Banjara Hills, Hyderabad, Telangana 500034',
    notes: 'Payment delayed 90+ days. Multiple reminders sent. Consider escalating.',
    createdAt: monthAgo(7),
    lastContactedAt: daysAgo(60),
    isAtRisk: true,
  },
];

// ---- MONTHLY EARNINGS (6 months, upward trend with one dip) ----
export const sampleEarnings = [
  { month: 'Dec 2025', amount: 95000 },
  { month: 'Jan 2026', amount: 135000 },
  { month: 'Feb 2026', amount: 110000 },
  { month: 'Mar 2026', amount: 185000 },
  { month: 'Apr 2026', amount: 160000 },
  { month: 'May 2026', amount: 145000 },
];

// ---- 20 INVOICES (Paid, Unpaid, Overdue, Critical) ----
export const sampleInvoices = [
  // --- PAID invoices (healthy history) ---
  {
    id: 'inv-001', invoiceNumber: 'INV-0001', clientId: CLIENT_IDS.arjun, clientName: 'Arjun Mehta',
    clientCompany: 'PaySwift FinTech Pvt. Ltd.', clientGstin: '27AABCP1234M1ZP',
    clientAddress: 'Andheri East, Mumbai, Maharashtra 400069',
    date: monthAgo(6), dueDate: daysAgo(150), placeOfSupply: '27',
    lineItems: [{ description: 'Discovery & UX Research Phase', sacCode: '998314', quantity: 1, rate: 50000 }],
    gstRate: 18, isInterState: false, subtotal: 50000, cgst: 4500, sgst: 4500, igst: 0, total: 59000,
    status: 'Paid', paidDate: daysAgo(155), amountPaid: 59000, notes: '',
  },
  {
    id: 'inv-002', invoiceNumber: 'INV-0002', clientId: CLIENT_IDS.arjun, clientName: 'Arjun Mehta',
    clientCompany: 'PaySwift FinTech Pvt. Ltd.', clientGstin: '27AABCP1234M1ZP',
    clientAddress: 'Andheri East, Mumbai, Maharashtra 400069',
    date: monthAgo(4), dueDate: daysAgo(100), placeOfSupply: '27',
    lineItems: [{ description: 'Wireframes & Prototyping', sacCode: '998314', quantity: 1, rate: 60000 }],
    gstRate: 18, isInterState: false, subtotal: 60000, cgst: 5400, sgst: 5400, igst: 0, total: 70800,
    status: 'Paid', paidDate: daysAgo(97), amountPaid: 70800, notes: '',
  },
  {
    id: 'inv-003', invoiceNumber: 'INV-0003', clientId: CLIENT_IDS.ananya, clientName: 'Ananya Krishnan',
    clientCompany: 'GlowBerry D2C Brands', clientGstin: '29AABCG5678N1ZQ',
    clientAddress: 'HSR Layout, Bengaluru, Karnataka 560102',
    date: monthAgo(4), dueDate: daysAgo(90), placeOfSupply: '29',
    lineItems: [{ description: 'Logo Design (3 concepts + revisions)', sacCode: '998391', quantity: 1, rate: 35000 },
      { description: 'Brand Guidelines Document', sacCode: '998391', quantity: 1, rate: 25000 }],
    gstRate: 18, isInterState: true, subtotal: 60000, cgst: 0, sgst: 0, igst: 10800, total: 70800,
    status: 'Paid', paidDate: daysAgo(85), amountPaid: 70800, notes: '',
  },
  {
    id: 'inv-004', invoiceNumber: 'INV-0004', clientId: CLIENT_IDS.karan, clientName: 'Karan Patel',
    clientCompany: 'Pixel Forge Agency', clientGstin: '24AABCF9012P1ZR',
    clientAddress: 'SG Highway, Ahmedabad, Gujarat 380015',
    date: monthAgo(3), dueDate: daysAgo(60), placeOfSupply: '24',
    lineItems: [{ description: 'Agency Website Design & Development', sacCode: '998314', quantity: 1, rate: 55000 },
      { description: 'CMS Integration (WordPress)', sacCode: '998314', quantity: 1, rate: 15000 }],
    gstRate: 18, isInterState: true, subtotal: 70000, cgst: 0, sgst: 0, igst: 12600, total: 82600,
    status: 'Paid', paidDate: daysAgo(55), amountPaid: 82600, notes: 'TDS deducted @10%',
  },
  {
    id: 'inv-005', invoiceNumber: 'INV-0005', clientId: CLIENT_IDS.rishi, clientName: 'Rishi Aggarwal',
    clientCompany: 'CartZone E-commerce Pvt. Ltd.', clientGstin: '07AABCC3456Q1ZS',
    clientAddress: 'Connaught Place, New Delhi 110001',
    date: monthAgo(5), dueDate: daysAgo(120), placeOfSupply: '07',
    lineItems: [{ description: 'UX Research & Information Architecture', sacCode: '998314', quantity: 1, rate: 100000 }],
    gstRate: 18, isInterState: true, subtotal: 100000, cgst: 0, sgst: 0, igst: 18000, total: 118000,
    status: 'Paid', paidDate: daysAgo(115), amountPaid: 118000, notes: 'TDS deducted @10%',
  },
  {
    id: 'inv-006', invoiceNumber: 'INV-0006', clientId: CLIENT_IDS.rishi, clientName: 'Rishi Aggarwal',
    clientCompany: 'CartZone E-commerce Pvt. Ltd.', clientGstin: '07AABCC3456Q1ZS',
    clientAddress: 'Connaught Place, New Delhi 110001',
    date: monthAgo(3), dueDate: daysAgo(60), placeOfSupply: '07',
    lineItems: [{ description: 'Low-Fidelity Wireframes & Component Library', sacCode: '998314', quantity: 1, rate: 125000 }],
    gstRate: 18, isInterState: true, subtotal: 125000, cgst: 0, sgst: 0, igst: 22500, total: 147500,
    status: 'Paid', paidDate: daysAgo(58), amountPaid: 147500, notes: 'TDS deducted @10%',
  },
  {
    id: 'inv-007', invoiceNumber: 'INV-0007', clientId: CLIENT_IDS.ananya, clientName: 'Ananya Krishnan',
    clientCompany: 'GlowBerry D2C Brands', clientGstin: '29AABCG5678N1ZQ',
    clientAddress: 'HSR Layout, Bengaluru, Karnataka 560102',
    date: monthAgo(3), dueDate: daysAgo(60), placeOfSupply: '29',
    lineItems: [{ description: 'Website Homepage Design', sacCode: '998314', quantity: 1, rate: 40000 },
      { description: 'Product Pages (8 templates)', sacCode: '998314', quantity: 8, rate: 5000 }],
    gstRate: 18, isInterState: true, subtotal: 80000, cgst: 0, sgst: 0, igst: 14400, total: 94400,
    status: 'Paid', paidDate: daysAgo(52), amountPaid: 94400, notes: '',
  },
  {
    id: 'inv-008', invoiceNumber: 'INV-0008', clientId: CLIENT_IDS.karan, clientName: 'Karan Patel',
    clientCompany: 'Pixel Forge Agency', clientGstin: '24AABCF9012P1ZR',
    clientAddress: 'SG Highway, Ahmedabad, Gujarat 380015',
    date: monthAgo(2), dueDate: daysAgo(30), placeOfSupply: '24',
    lineItems: [{ description: 'SEO Audit & On-Page Optimization', sacCode: '998361', quantity: 1, rate: 18000 }],
    gstRate: 18, isInterState: true, subtotal: 18000, cgst: 0, sgst: 0, igst: 3240, total: 21240,
    status: 'Paid', paidDate: daysAgo(25), amountPaid: 21240, notes: 'TDS deducted',
  },
  {
    id: 'inv-009', invoiceNumber: 'INV-0009', clientId: CLIENT_IDS.arjun, clientName: 'Arjun Mehta',
    clientCompany: 'PaySwift FinTech Pvt. Ltd.', clientGstin: '27AABCP1234M1ZP',
    clientAddress: 'Andheri East, Mumbai, Maharashtra 400069',
    date: monthAgo(2), dueDate: daysAgo(30), placeOfSupply: '27',
    lineItems: [{ description: 'High-Fidelity UI – Dashboard Module', sacCode: '998314', quantity: 1, rate: 75000 }],
    gstRate: 18, isInterState: false, subtotal: 75000, cgst: 6750, sgst: 6750, igst: 0, total: 88500,
    status: 'Paid', paidDate: daysAgo(28), amountPaid: 88500, notes: '',
  },
  {
    id: 'inv-010', invoiceNumber: 'INV-0010', clientId: CLIENT_IDS.rishi, clientName: 'Rishi Aggarwal',
    clientCompany: 'CartZone E-commerce Pvt. Ltd.', clientGstin: '07AABCC3456Q1ZS',
    clientAddress: 'Connaught Place, New Delhi 110001',
    date: monthAgo(1), dueDate: daysAgo(0), placeOfSupply: '07',
    lineItems: [{ description: 'High-Fidelity UI – All Modules', sacCode: '998314', quantity: 1, rate: 150000 }],
    gstRate: 18, isInterState: true, subtotal: 150000, cgst: 0, sgst: 0, igst: 27000, total: 177000,
    status: 'Paid', paidDate: daysAgo(5), amountPaid: 177000, notes: 'TDS deducted',
  },
  // --- UNPAID CURRENT (2-3, within due date) ---
  {
    id: 'inv-011', invoiceNumber: 'INV-0011', clientId: CLIENT_IDS.ananya, clientName: 'Ananya Krishnan',
    clientCompany: 'GlowBerry D2C Brands', clientGstin: '29AABCG5678N1ZQ',
    clientAddress: 'HSR Layout, Bengaluru, Karnataka 560102',
    date: daysAgo(7), dueDate: daysAgoDate(-8), placeOfSupply: '29',
    lineItems: [{ description: 'E-commerce Integration (Shopify)', sacCode: '998314', quantity: 1, rate: 60000 },
      { description: 'Payment Gateway Setup', sacCode: '998314', quantity: 1, rate: 15000 }],
    gstRate: 18, isInterState: true, subtotal: 75000, cgst: 0, sgst: 0, igst: 13500, total: 88500,
    status: 'Sent', paidDate: null, amountPaid: 0, notes: 'Due in 8 days',
  },
  {
    id: 'inv-012', invoiceNumber: 'INV-0012', clientId: CLIENT_IDS.arjun, clientName: 'Arjun Mehta',
    clientCompany: 'PaySwift FinTech Pvt. Ltd.', clientGstin: '27AABCP1234M1ZP',
    clientAddress: 'Andheri East, Mumbai, Maharashtra 400069',
    date: daysAgo(5), dueDate: daysAgoDate(-10), placeOfSupply: '27',
    lineItems: [{ description: 'Mobile App UI – Phase 1', sacCode: '998314', quantity: 1, rate: 65000 }],
    gstRate: 18, isInterState: false, subtotal: 65000, cgst: 5850, sgst: 5850, igst: 0, total: 76700,
    status: 'Sent', paidDate: null, amountPaid: 0, notes: '',
  },
  // --- OVERDUE 31-60 days ---
  {
    id: 'inv-013', invoiceNumber: 'INV-0013', clientId: CLIENT_IDS.karan, clientName: 'Karan Patel',
    clientCompany: 'Pixel Forge Agency', clientGstin: '24AABCF9012P1ZR',
    clientAddress: 'SG Highway, Ahmedabad, Gujarat 380015',
    date: daysAgo(60), dueDate: daysAgoDate(45), placeOfSupply: '24',
    lineItems: [{ description: 'Landing Page Design (3 variants)', sacCode: '998391', quantity: 3, rate: 12000 }],
    gstRate: 18, isInterState: true, subtotal: 36000, cgst: 0, sgst: 0, igst: 6480, total: 42480,
    status: 'Sent', paidDate: null, amountPaid: 15000, notes: 'Partial payment of ₹15,000 received on ' + daysAgoDate(30),
  },
  {
    id: 'inv-014', invoiceNumber: 'INV-0014', clientId: CLIENT_IDS.shreya, clientName: 'Shreya Nair',
    clientCompany: '', clientGstin: '',
    clientAddress: 'Fort Kochi, Kerala 682001',
    date: daysAgo(50), dueDate: daysAgoDate(35), placeOfSupply: '32',
    lineItems: [{ description: 'Portfolio Website – Design & Development', sacCode: '998314', quantity: 1, rate: 35000 }],
    gstRate: 18, isInterState: true, subtotal: 35000, cgst: 0, sgst: 0, igst: 6300, total: 41300,
    status: 'Sent', paidDate: null, amountPaid: 0, notes: 'B2C invoice (no GSTIN)',
  },
  // --- CRITICAL OVERDUE 90+ days (Zara Ahmed) ---
  {
    id: 'inv-015', invoiceNumber: 'INV-0015', clientId: CLIENT_IDS.zara, clientName: 'Zara Ahmed',
    clientCompany: 'Zara Boutique', clientGstin: '36AABCZ7890R1ZT',
    clientAddress: 'Banjara Hills, Hyderabad, Telangana 500034',
    date: daysAgo(193), dueDate: daysAgoDate(178), placeOfSupply: '36',
    lineItems: [{ description: 'Retail Website – Full Design & Development', sacCode: '998314', quantity: 1, rate: 40000 }],
    gstRate: 18, isInterState: true, subtotal: 40000, cgst: 0, sgst: 0, igst: 7200, total: 47200,
    status: 'Sent', paidDate: null, amountPaid: 0, notes: 'Multiple reminders sent. Client unresponsive.',
  },
  // --- More paid invoices for revenue history ---
  {
    id: 'inv-016', invoiceNumber: 'INV-0016', clientId: CLIENT_IDS.arjun, clientName: 'Arjun Mehta',
    clientCompany: 'PaySwift FinTech Pvt. Ltd.', clientGstin: '27AABCP1234M1ZP',
    clientAddress: 'Andheri East, Mumbai, Maharashtra 400069',
    date: monthAgo(5), dueDate: daysAgo(135), placeOfSupply: '27',
    lineItems: [{ description: 'UI Component Library Setup', sacCode: '998314', quantity: 1, rate: 30000 }],
    gstRate: 18, isInterState: false, subtotal: 30000, cgst: 2700, sgst: 2700, igst: 0, total: 35400,
    status: 'Paid', paidDate: daysAgo(130), amountPaid: 35400, notes: '',
  },
  {
    id: 'inv-017', invoiceNumber: 'INV-0017', clientId: CLIENT_IDS.rishi, clientName: 'Rishi Aggarwal',
    clientCompany: 'CartZone E-commerce Pvt. Ltd.', clientGstin: '07AABCC3456Q1ZS',
    clientAddress: 'Connaught Place, New Delhi 110001',
    date: monthAgo(2), dueDate: daysAgo(30), placeOfSupply: '07',
    lineItems: [{ description: 'User Testing & Iteration (2 rounds)', sacCode: '998314', quantity: 1, rate: 40000 }],
    gstRate: 18, isInterState: true, subtotal: 40000, cgst: 0, sgst: 0, igst: 7200, total: 47200,
    status: 'Paid', paidDate: daysAgo(22), amountPaid: 47200, notes: '',
  },
  {
    id: 'inv-018', invoiceNumber: 'INV-0018', clientId: CLIENT_IDS.ananya, clientName: 'Ananya Krishnan',
    clientCompany: 'GlowBerry D2C Brands', clientGstin: '29AABCG5678N1ZQ',
    clientAddress: 'HSR Layout, Bengaluru, Karnataka 560102',
    date: monthAgo(1), dueDate: daysAgo(15), placeOfSupply: '29',
    lineItems: [{ description: 'Social Media Kit (15 templates)', sacCode: '998391', quantity: 1, rate: 22000 }],
    gstRate: 18, isInterState: true, subtotal: 22000, cgst: 0, sgst: 0, igst: 3960, total: 25960,
    status: 'Paid', paidDate: daysAgo(10), amountPaid: 25960, notes: '',
  },
  {
    id: 'inv-019', invoiceNumber: 'INV-0019', clientId: CLIENT_IDS.zara, clientName: 'Zara Ahmed',
    clientCompany: 'Zara Boutique', clientGstin: '36AABCZ7890R1ZT',
    clientAddress: 'Banjara Hills, Hyderabad, Telangana 500034',
    date: daysAgo(120), dueDate: daysAgoDate(105), placeOfSupply: '36',
    lineItems: [{ description: 'Logo & Brand Collateral', sacCode: '998391', quantity: 1, rate: 18000 }],
    gstRate: 18, isInterState: true, subtotal: 18000, cgst: 0, sgst: 0, igst: 3240, total: 21240,
    status: 'Sent', paidDate: null, amountPaid: 0, notes: 'Also overdue. Bundled with INV-0015.',
  },
  {
    id: 'inv-020', invoiceNumber: 'INV-0020', clientId: CLIENT_IDS.rishi, clientName: 'Rishi Aggarwal',
    clientCompany: 'CartZone E-commerce Pvt. Ltd.', clientGstin: '07AABCC3456Q1ZS',
    clientAddress: 'Connaught Place, New Delhi 110001',
    date: daysAgo(3), dueDate: daysAgoDate(-12), placeOfSupply: '07',
    lineItems: [{ description: 'Final Screens, QA Support & Handoff', sacCode: '998314', quantity: 1, rate: 125000 }],
    gstRate: 18, isInterState: true, subtotal: 125000, cgst: 0, sgst: 0, igst: 22500, total: 147500,
    status: 'Sent', paidDate: null, amountPaid: 0, notes: 'Latest milestone invoice',
  },
];

// ---- ACTIVITIES ----
export const sampleActivities = [
  { id: generateId(), type: 'invoice', message: 'Invoice INV-0020 sent to Rishi Aggarwal for ₹1,47,500', timestamp: daysAgo(0), icon: 'FileText' },
  { id: generateId(), type: 'payment', message: 'Payment of ₹1,77,000 received from Rishi Aggarwal (INV-0010)', timestamp: daysAgo(2), icon: 'IndianRupee' },
  { id: generateId(), type: 'invoice', message: 'Invoice INV-0012 sent to Arjun Mehta for ₹76,700', timestamp: daysAgo(3), icon: 'FileText' },
  { id: generateId(), type: 'milestone', message: 'Milestone "Final Screens & QA" completed for CartZone', timestamp: daysAgo(3), icon: 'CheckCircle' },
  { id: generateId(), type: 'client', message: 'Shreya Nair sent portfolio website proposal', timestamp: daysAgo(5), icon: 'Send' },
  { id: generateId(), type: 'payment', message: 'Partial payment of ₹15,000 from Karan Patel (INV-0013)', timestamp: daysAgo(10), icon: 'IndianRupee' },
  { id: generateId(), type: 'whatsapp', message: 'Payment reminder sent to Zara Ahmed — INV-0015 overdue 193 days', timestamp: daysAgo(12), icon: 'MessageCircle' },
  { id: generateId(), type: 'payment', message: 'Payment of ₹25,960 received from Ananya Krishnan (INV-0018)', timestamp: daysAgo(15), icon: 'IndianRupee' },
];

// ---- PROJECTS (Kanban) ----
export const sampleProjects = [
  {
    id: generateId(), title: 'FinTech Dashboard Redesign', clientName: 'Arjun Mehta',
    status: 'inProgress', priority: 'high', deadline: daysAgo(-14),
    subtasks: [
      { id: generateId(), title: 'UX Research & Audit', done: true },
      { id: generateId(), title: 'Wireframes & Prototype', done: true },
      { id: generateId(), title: 'Dashboard UI Design', done: true },
      { id: generateId(), title: 'Mobile App UI', done: false },
      { id: generateId(), title: 'Developer Handoff', done: false },
    ],
    notes: 'Phase 3 complete. Mobile app UI in progress.',
    createdAt: monthAgo(6),
  },
  {
    id: generateId(), title: 'Brand Identity & Website', clientName: 'Ananya Krishnan',
    status: 'inProgress', priority: 'high', deadline: daysAgo(-21),
    subtasks: [
      { id: generateId(), title: 'Logo & Brand Guidelines', done: true },
      { id: generateId(), title: 'Website Design', done: true },
      { id: generateId(), title: 'E-commerce Integration', done: false },
      { id: generateId(), title: 'Testing & Launch', done: false },
    ],
    notes: 'Brand done. Website design approved. E-commerce integration pending.',
    createdAt: monthAgo(4),
  },
  {
    id: generateId(), title: 'SaaS Dashboard – Design System', clientName: 'Rishi Aggarwal',
    status: 'review', priority: 'high', deadline: daysAgo(-7),
    subtasks: [
      { id: generateId(), title: 'UX Research', done: true },
      { id: generateId(), title: 'Wireframes & Components', done: true },
      { id: generateId(), title: 'Hi-Fi UI – All Modules', done: true },
      { id: generateId(), title: 'Final QA & Handoff', done: true },
    ],
    notes: 'All done! Final invoice sent. Waiting for payment.',
    createdAt: monthAgo(5),
  },
  {
    id: generateId(), title: 'Portfolio Website', clientName: 'Shreya Nair',
    status: 'todo', priority: 'low', deadline: daysAgo(-30),
    subtasks: [
      { id: generateId(), title: 'Content Collection', done: false },
      { id: generateId(), title: 'Design Mockup', done: false },
      { id: generateId(), title: 'Development', done: false },
    ],
    notes: 'Proposal sent. Waiting for approval.',
    createdAt: monthAgo(1),
  },
];

// ---- TIME ENTRIES ----
export const sampleTimeEntries = [
  { id: generateId(), clientName: 'Arjun Mehta', project: 'FinTech Dashboard Redesign', description: 'Mobile app navigation design', date: today, seconds: 7200, hourlyRate: 2500 },
  { id: generateId(), clientName: 'Arjun Mehta', project: 'FinTech Dashboard Redesign', description: 'Transaction history screen', date: daysAgoDate(1), seconds: 10800, hourlyRate: 2500 },
  { id: generateId(), clientName: 'Ananya Krishnan', project: 'Brand Identity & Website', description: 'Shopify theme customization', date: daysAgoDate(1), seconds: 5400, hourlyRate: 2000 },
  { id: generateId(), clientName: 'Rishi Aggarwal', project: 'SaaS Dashboard', description: 'Final QA support & bug fixes', date: daysAgoDate(2), seconds: 14400, hourlyRate: 3000 },
  { id: generateId(), clientName: 'Ananya Krishnan', project: 'Brand Identity & Website', description: 'Product page templates', date: daysAgoDate(3), seconds: 3600, hourlyRate: 2000 },
];

// ---- 8 EXPENSES ----
export const sampleExpenses = [
  { id: generateId(), description: 'Figma Pro subscription', amount: 1150, category: 'Software', date: daysAgoDate(2), clientName: '', taxDeductible: true, gstPaid: 0 },
  { id: generateId(), description: 'AWS hosting (3 client projects)', amount: 4200, category: 'Software', date: daysAgoDate(5), clientName: '', taxDeductible: true, gstPaid: 756 },
  { id: generateId(), description: 'WeWork co-working (monthly)', amount: 8000, category: 'Office', date: daysAgoDate(7), clientName: '', taxDeductible: true, gstPaid: 1440 },
  { id: generateId(), description: 'CA quarterly filing fees', amount: 5000, category: 'Professional', date: daysAgoDate(10), clientName: '', taxDeductible: true, gstPaid: 900 },
  { id: generateId(), description: 'Udemy course – Advanced React Patterns', amount: 3200, category: 'Education', date: daysAgoDate(15), clientName: '', taxDeductible: true, gstPaid: 576 },
  { id: generateId(), description: 'Internet bill (May)', amount: 1500, category: 'Internet', date: daysAgoDate(18), clientName: '', taxDeductible: true, gstPaid: 270 },
  { id: generateId(), description: 'Client meeting – cab (Arjun)', amount: 450, category: 'Travel', date: daysAgoDate(20), clientName: 'Arjun Mehta', taxDeductible: true, gstPaid: 0 },
  { id: generateId(), description: 'Logitech MX Master 3S mouse', amount: 7500, category: 'Hardware', date: daysAgoDate(25), clientName: '', taxDeductible: true, gstPaid: 1350 },
];

// ---- PROPOSALS ----
export const sampleProposals = [
  {
    id: generateId(),
    projectTitle: 'Portfolio Website – Photography',
    clientName: 'Shreya Nair',
    yourName: 'Your Name',
    scope: 'Custom portfolio website showcasing photography work. Responsive design with gallery, about, contact pages. Built on a modern stack with CMS for easy content updates.',
    deliverables: ['Custom Design (Desktop + Mobile)', 'Gallery with Lightbox', 'Contact Form Integration', 'CMS Setup (Sanity/Strapi)', 'SEO Optimization'],
    timeline: 21,
    paymentTerms: '50% Advance',
    milestones: [],
    projectValue: 45000,
    status: 'Sent',
    validity: 15,
    termsAndConditions: 'All designs remain IP of client after final payment. 2 revision rounds included. Additional revisions billed at ₹2,000/hour.',
    createdAt: monthAgo(1),
  },
];

// ---- MILESTONE PROJECTS (3 projects, realistic) ----
export const sampleMilestoneProjects = [
  {
    id: 'mp1',
    name: 'Brand Identity & Website Design',
    clientName: 'Ananya Krishnan',
    clientId: CLIENT_IDS.ananya,
    totalValue: 360000,
    completionPercent: null,
    changeRequests: [],
    milestones: [
      { id: 'ms1', name: 'Logo & Brand Guidelines', percentage: 17, amount: 60000, dueDate: daysAgoDate(90), status: 'Invoiced' },
      { id: 'ms2', name: 'Website Homepage Design', percentage: 22, amount: 80000, dueDate: daysAgoDate(60), status: 'Invoiced' },
      { id: 'ms3', name: 'E-commerce Integration', percentage: 21, amount: 75000, dueDate: daysAgoDate(-8), status: 'Completed' },
      { id: 'ms4', name: 'Testing & Launch', percentage: 40, amount: 145000, dueDate: daysAgoDate(-30), status: 'Pending' },
    ]
  },
  {
    id: 'mp2',
    name: 'SaaS Dashboard UI/UX',
    clientName: 'Rishi Aggarwal',
    clientId: CLIENT_IDS.rishi,
    totalValue: 500000,
    completionPercent: null,
    changeRequests: [],
    milestones: [
      { id: 'ms5', name: 'UX Research & Information Architecture', percentage: 20, amount: 100000, dueDate: daysAgoDate(120), status: 'Invoiced' },
      { id: 'ms6', name: 'Low-Fidelity Wireframes & Component Library', percentage: 25, amount: 125000, dueDate: daysAgoDate(60), status: 'Invoiced' },
      { id: 'ms7', name: 'High-Fidelity UI – All Modules', percentage: 30, amount: 150000, dueDate: daysAgoDate(15), status: 'Invoiced' },
      { id: 'ms8', name: 'Final Screens, QA Support & Handoff', percentage: 25, amount: 125000, dueDate: daysAgoDate(-7), status: 'Completed' },
    ]
  },
  {
    id: 'mp3',
    name: 'E-commerce Mobile App',
    clientName: 'Arjun Mehta',
    clientId: CLIENT_IDS.arjun,
    totalValue: 250000,
    completionPercent: null,
    changeRequests: [],
    milestones: [
      { id: 'ms9', name: 'Discovery & UX Research', percentage: 20, amount: 50000, dueDate: daysAgoDate(150), status: 'Invoiced' },
      { id: 'ms10', name: 'Wireframes & Prototyping', percentage: 24, amount: 60000, dueDate: daysAgoDate(100), status: 'Invoiced' },
      { id: 'ms11', name: 'Dashboard UI Design', percentage: 30, amount: 75000, dueDate: daysAgoDate(30), status: 'Invoiced' },
      { id: 'ms12', name: 'Mobile App UI & Handoff', percentage: 26, amount: 65000, dueDate: daysAgoDate(-10), status: 'Pending' },
    ]
  },
];

// ---- 5 RECURRING SCHEDULES ----
export const sampleRecurringSchedules = [
  {
    id: 'rs1', clientName: 'Karan Patel', clientId: CLIENT_IDS.karan,
    description: 'Monthly SEO & Analytics Retainer', amount: 18000, gstRate: 18,
    frequency: 'monthly', nextDueDate: daysAgoDate(-3), lastInvoiceDate: daysAgoDate(27), isActive: true,
  },
  {
    id: 'rs2', clientName: 'Ananya Krishnan', clientId: CLIENT_IDS.ananya,
    description: 'Social Media Design Retainer (10 posts)', amount: 25000, gstRate: 18,
    frequency: 'monthly', nextDueDate: daysAgoDate(-10), lastInvoiceDate: daysAgoDate(20), isActive: true,
  },
  {
    id: 'rs3', clientName: 'Arjun Mehta', clientId: CLIENT_IDS.arjun,
    description: 'Product Design Support (Ad-hoc)', amount: 15000, gstRate: 18,
    frequency: 'monthly', nextDueDate: daysAgoDate(2), lastInvoiceDate: null, isActive: true,
  },
  {
    id: 'rs4', clientName: 'Rishi Aggarwal', clientId: CLIENT_IDS.rishi,
    description: 'UI Maintenance & Bug Fixes', amount: 20000, gstRate: 18,
    frequency: 'monthly', nextDueDate: daysAgoDate(-15), lastInvoiceDate: daysAgoDate(15), isActive: true,
  },
  {
    id: 'rs5', clientName: 'Karan Patel', clientId: CLIENT_IDS.karan,
    description: 'Bi-weekly Newsletter Design', amount: 8000, gstRate: 18,
    frequency: 'biweekly', nextDueDate: daysAgoDate(-5), lastInvoiceDate: daysAgoDate(9), isActive: false,
  },
];

// ---- 3 CHANGE REQUESTS (Pending / Approved+Unbilled / Billed) ----
export const sampleChangeRequests = [
  {
    id: 'cr-001',
    projectId: 'mp1',
    projectName: 'Brand Identity & Website Design',
    clientName: 'Ananya Krishnan',
    clientId: CLIENT_IDS.ananya,
    title: 'Extra revision round for homepage hero',
    description: 'Client requested a 4th hero section variation after the agreed 3 concepts were delivered. Involves new illustration style exploration.',
    requestedBy: 'client',
    estimatedHours: 6,
    estimatedAmount: 12000,
    status: 'Pending',
    requestedAt: daysAgo(3),
    approvedAt: null,
    billedInvoiceId: null,
    clientApprovalMethod: null,
    notes: 'Waiting for client confirmation via email.',
  },
  {
    id: 'cr-002',
    projectId: 'mp2',
    projectName: 'SaaS Dashboard UI/UX',
    clientName: 'Rishi Aggarwal',
    clientId: CLIENT_IDS.rishi,
    title: 'Dark mode implementation',
    description: 'Full dark mode variant for all dashboard screens. Was not in original SOW. Client wants it for enterprise users.',
    requestedBy: 'client',
    estimatedHours: 10,
    estimatedAmount: 30000,
    status: 'Approved',
    requestedAt: daysAgo(15),
    approvedAt: daysAgo(12),
    billedInvoiceId: null,
    clientApprovalMethod: 'WhatsApp',
    notes: 'Approved via WhatsApp. Screenshot saved. Need to bill this.',
  },
  {
    id: 'cr-003',
    projectId: 'mp3',
    projectName: 'E-commerce Mobile App',
    clientName: 'Arjun Mehta',
    clientId: CLIENT_IDS.arjun,
    title: 'Push notification design',
    description: 'Design for 5 push notification templates + in-app notification center. Added after MVP scope was agreed.',
    requestedBy: 'me',
    estimatedHours: 4,
    estimatedAmount: 10000,
    status: 'Billed',
    requestedAt: daysAgo(30),
    approvedAt: daysAgo(28),
    billedInvoiceId: 'inv-009',
    clientApprovalMethod: 'Email',
    notes: 'Billed as part of INV-0009.',
  },
];

// ---- SETTINGS ----
export const defaultSettings = {
  yourName: 'Your Name',
  businessName: 'Your Business',
  email: 'you@example.com',
  phone: '+91 99999 99999',
  gstin: '27AADCS1234P1ZP',
  pan: 'ABCDE1234F',
  address: 'Mumbai, Maharashtra 400001',
  accountHolderName: '',
  bankName: 'HDFC Bank',
  accountNumber: '12345678901234',
  ifsc: 'HDFC0001234',
  upiId: 'yourname@upi',
  invoicePrefix: 'INV',
  lastInvoiceNumber: 20,
  defaultTerms: 'Payment is due within 15 days of invoice date. Late payments will attract interest at 1.5% per month. All disputes are subject to jurisdiction of Mumbai courts.',
  defaultPaymentTerms: 15,
  defaultPaymentDays: 15,
  invoiceFooter: '',
  revenueGoal: 1800000,
  revenueGoals: { monthly: 150000, quarterly: 450000, annual: 1800000 },
  startupRecurringCheck: true,
  checkRecurringOnStartup: true,
};
