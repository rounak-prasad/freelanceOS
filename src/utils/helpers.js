// ==========================================
// FreelanceOS — Utility Functions
// ==========================================

// Indian number system formatting (₹1,20,000)
export function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  const parts = absNum.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];
  
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = formatted + ',' + last3;
  }
  
  const result = decPart === '00' ? intPart : `${intPart}.${decPart}`;
  return `${isNegative ? '-' : ''}₹${result}`;
}

// Convert number to words (Indian format)
export function numberToWordsINR(num) {
  if (num === 0) return 'Rupees Zero Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertGroup(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertGroup(n % 100) : '');
  }
  
  const absNum = Math.abs(Math.floor(num));
  if (absNum === 0) return 'Rupees Zero Only';
  
  const crore = Math.floor(absNum / 10000000);
  const lakh = Math.floor((absNum % 10000000) / 100000);
  const thousand = Math.floor((absNum % 100000) / 1000);
  const remainder = absNum % 1000;
  
  let result = '';
  if (crore) result += convertGroup(crore) + ' Crore ';
  if (lakh) result += convertGroup(lakh) + ' Lakh ';
  if (thousand) result += convertGroup(thousand) + ' Thousand ';
  if (remainder) result += convertGroup(remainder);
  
  // Handle paise
  const paise = Math.round((Math.abs(num) - absNum) * 100);
  let paiseStr = '';
  if (paise > 0) {
    paiseStr = ' and ' + convertGroup(paise) + ' Paise';
  }
  
  return 'Rupees ' + result.trim() + paiseStr + ' Only';
}

// Generate auto-incrementing invoice number
export function generateInvoiceNumber(prefix = 'INV', lastNumber = 0) {
  const next = lastNumber + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

// Calculate GST
export function calculateGST(subtotal, rate = 18, isInterState = false) {
  const gstAmount = (subtotal * rate) / 100;
  if (isInterState) {
    return { igst: gstAmount, cgst: 0, sgst: 0, total: subtotal + gstAmount };
  }
  return { igst: 0, cgst: gstAmount / 2, sgst: gstAmount / 2, total: subtotal + gstAmount };
}

// Validate GSTIN (15-digit)
export function validateGSTIN(gstin) {
  if (!gstin || gstin.length !== 15) return false;
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(gstin.toUpperCase());
}

// Indian state codes for GST
export const STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other Territory',
};

export function getStateFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return '';
  const code = gstin.substring(0, 2);
  return STATE_CODES[code] || 'Unknown State';
}

// Status color mapping
export function getStatusColor(status) {
  const map = {
    'Proposal Sent': 'purple',
    'In Progress': 'blue',
    'Invoice Sent': 'amber',
    'Paid': 'green',
    'Overdue': 'red',
    'Draft': 'gray',
    'Sent': 'blue',
    'Accepted': 'green',
    'Rejected': 'red',
  };
  return map[status] || 'gray';
}

export function getStatusBgClass(status) {
  const color = getStatusColor(status);
  const map = {
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    gray: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return map[color] || map.gray;
}

// Generate UUID
export function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// Format date to Indian format (DD/MM/YYYY)
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format date to ISO input format (YYYY-MM-DD)
export function toInputDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// Get relative time string
export function getRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

// Encode/decode proposal data for URL sharing
export function encodeProposalData(data) {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch {
    return '';
  }
}

export function decodeProposalData(hash) {
  try {
    return JSON.parse(decodeURIComponent(atob(hash)));
  } catch {
    return null;
  }
}

// Format duration from seconds
export function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Format hours nicely
export function formatHours(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Get current financial year (April–March)
export function getCurrentFY() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  return { start: startYear, end: startYear + 1, label: `FY ${startYear}-${String(startYear + 1).slice(-2)}` };
}

// SAC Codes commonly used by freelancers
export const SAC_CODES = [
  { code: '998311', desc: 'Management consulting services' },
  { code: '998312', desc: 'Business consulting services' },
  { code: '998313', desc: 'IT consulting services' },
  { code: '998314', desc: 'IT design & development services' },
  { code: '998315', desc: 'Hosting & IT infrastructure' },
  { code: '998316', desc: 'IT infrastructure management' },
  { code: '998321', desc: 'Publishing & broadcasting' },
  { code: '998361', desc: 'Advertising services' },
  { code: '998362', desc: 'Market research services' },
  { code: '998363', desc: 'Photography services' },
  { code: '998364', desc: 'Translation & interpretation' },
  { code: '998391', desc: 'Specialist design services' },
  { code: '998392', desc: 'Interior design services' },
  { code: '998399', desc: 'Other professional services' },
  { code: '999211', desc: 'Educational services' },
  { code: '998511', desc: 'Accounting & auditing' },
  { code: '998521', desc: 'Legal services' },
];
