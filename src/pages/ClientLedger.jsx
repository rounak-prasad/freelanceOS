// ==========================================
// FreelanceOS — Client Ledger Page
// ==========================================
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { formatINR, formatDate, calculateGST } from '../utils/helpers';
import {
  BookOpen, Search, Share2, IndianRupee, ChevronDown,
  FileText,
} from 'lucide-react';

function getInvoiceTotal(inv) {
  if (inv.total) return inv.total;
  const subtotal = (inv.lineItems || []).reduce((s, li) => s + li.quantity * li.rate, 0);
  const gst = calculateGST(subtotal, inv.gstRate || 18, inv.isInterState || false);
  return gst.total;
}

export default function ClientLedger() {
  const { state, addToast } = useData();
  const [searchParams] = useSearchParams();
  const [selectedClient, setSelectedClient] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  // Auto-select client from query params
  useEffect(() => {
    const clientIdParam = searchParams.get('clientId');
    if (clientIdParam) {
      setSelectedClient(clientIdParam);
    }
  }, [searchParams]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return state.clients;
    const q = clientSearch.toLowerCase();
    return state.clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  }, [state.clients, clientSearch]);

  const client = useMemo(() => state.clients.find(c => c.id === selectedClient), [state.clients, selectedClient]);

  const clientInvoices = useMemo(() => {
    if (!client) return [];
    return state.invoices
      .filter(inv => inv.clientName === client.name || inv.clientId === client.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.invoices, client]);

  const summary = useMemo(() => {
    const totalInvoiced = clientInvoices.reduce((s, inv) => s + getInvoiceTotal(inv), 0);
    const totalReceived = clientInvoices.reduce((s, inv) => {
      if (inv.status === 'Paid') return s + getInvoiceTotal(inv);
      return s + (inv.amountPaid || 0);
    }, 0);
    return { totalInvoiced, totalReceived, balanceDue: totalInvoiced - totalReceived };
  }, [clientInvoices]);

  function shareStatement() {
    if (!client) return;
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const totalInvoiced = summary.totalInvoiced;
    const totalReceived = summary.totalReceived;
    const balanceDue = summary.balanceDue;
    
    const invoiceRowsHtml = clientInvoices.map(inv => {
      const total = getInvoiceTotal(inv);
      const paid = inv.status === 'Paid' ? total : (inv.amountPaid || 0);
      const outstanding = total - paid;
      const description = (inv.lineItems || []).map(li => li.description).join(', ');
      return `
        <tr>
          <td>${formatDate(inv.date)}</td>
          <td><strong>${inv.invoiceNumber}</strong></td>
          <td>${description}</td>
          <td style="text-align: right;">${formatINR(total)}</td>
          <td style="text-align: right; color: #10B981;">${formatINR(paid)}</td>
          <td style="text-align: right; font-weight: bold; color: ${outstanding > 0 ? '#EF4444' : '#10B981'};">
            ${outstanding > 0 ? formatINR(outstanding) : 'Settled'}
          </td>
        </tr>
      `;
    }).join('');

    const businessName = state.settings.businessName || state.settings.yourName || 'My Freelance Business';
    const initial = businessName.charAt(0).toUpperCase();
    const contactEmail = state.settings.email || 'you@example.com';
    const clientCompanyText = client.company ? `<div style="color: #4B5563; font-size: 14px; font-weight: normal; margin-top: 4px;">${client.company}</div>` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Statement of Account - ${client.name}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1F2937;
            background-color: #F3F4F6;
            margin: 0;
            padding: 40px 20px;
          }
          .container {
            max-width: 850px;
            margin: 0 auto;
            background-color: #FFFFFF;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
            border: 1px solid #E5E7EB;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0F766E;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-area {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-box {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #0F766E, #0D9488);
            color: #FFFFFF;
            font-size: 18px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
          }
          .business-name {
            font-size: 18px;
            font-weight: bold;
            color: #111827;
          }
          .statement-title {
            text-align: right;
          }
          .statement-title h1 {
            margin: 0;
            font-size: 22px;
            color: #0F766E;
            font-weight: 800;
          }
          .statement-title p {
            margin: 4px 0 0 0;
            font-size: 12px;
            color: #6B7280;
          }
          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 35px;
          }
          .party-details h3 {
            margin: 0 0 8px 0;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #9CA3AF;
          }
          .party-details .name {
            font-size: 15px;
            font-weight: bold;
            color: #111827;
          }
          .summary-bar {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            background-color: #F0FDFA;
            border: 1px solid #CCFBF1;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 35px;
          }
          .summary-card {
            text-align: center;
          }
          .summary-card p {
            margin: 0;
            font-size: 11px;
            color: #0D9488;
            font-weight: 600;
            text-transform: uppercase;
          }
          .summary-card h2 {
            margin: 6px 0 0 0;
            font-size: 20px;
            color: #0F766E;
            font-weight: bold;
          }
          .summary-card.due h2 {
            color: ${balanceDue > 0 ? '#DC2626' : '#0F766E'};
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 35px;
          }
          th {
            background-color: #F9FAFB;
            color: #374151;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            padding: 10px 14px;
            text-align: left;
            border-bottom: 2px solid #E5E7EB;
          }
          td {
            padding: 12px 14px;
            font-size: 13px;
            border-bottom: 1px solid #F3F4F6;
            color: #4B5563;
          }
          tr:hover td {
            background-color: #F9FAFB;
          }
          .total-row td {
            font-weight: bold;
            background-color: #F9FAFB;
            border-top: 2px solid #E5E7EB;
            border-bottom: 2px solid #E5E7EB;
            color: #111827;
          }
          .footer {
            text-align: center;
            border-top: 1px dashed #E5E7EB;
            padding-top: 25px;
            color: #6B7280;
            font-size: 12px;
          }
          .print-btn-container {
            max-width: 850px;
            margin: 0 auto 15px auto;
            text-align: right;
          }
          .print-btn {
            background-color: #0F766E;
            color: #FFFFFF;
            border: none;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: bold;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .print-btn:hover {
            background-color: #0D9488;
          }
          @media print {
            body {
              background-color: #FFFFFF;
              padding: 0;
            }
            .container {
              box-shadow: none;
              border: none;
              padding: 0;
            }
            .print-btn-container {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-btn-container">
          <button class="print-btn" onclick="window.print()">Print Statement</button>
        </div>
        <div class="container">
          <div class="header">
            <div class="logo-area">
              <div class="logo-box">${initial}</div>
              <div>
                <div class="business-name">${businessName}</div>
                <div style="font-size: 10px; color: #6B7280;">Professional Freelance Services</div>
              </div>
            </div>
            <div class="statement-title">
              <h1>Statement of Account</h1>
              <p>As of ${today}</p>
            </div>
          </div>
          
          <div class="details-grid">
            <div class="party-details">
              <h3>Statement For</h3>
              <div class="name">${client.name}</div>
              ${clientCompanyText}
              <div style="color: #4B5563; font-size: 13px; margin-top: 4px;">${client.address || ''}</div>
            </div>
            <div class="party-details" style="text-align: right;">
              <h3>Prepared By</h3>
              <div class="name">${state.settings.yourName || businessName}</div>
              <div style="color: #4B5563; font-size: 13px; margin-top: 4px;">${state.settings.address || ''}</div>
              <div style="color: #4B5563; font-size: 13px;">${contactEmail}</div>
            </div>
          </div>
          
          <div class="summary-bar">
            <div class="summary-card">
              <p>Total Invoiced</p>
              <h2>${formatINR(totalInvoiced)}</h2>
            </div>
            <div class="summary-card">
              <p>Total Received</p>
              <h2 style="color: #059669;">${formatINR(totalReceived)}</h2>
            </div>
            <div class="summary-card due">
              <p>Balance Due</p>
              <h2>${formatINR(balanceDue)}</h2>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Description</th>
                <th style="text-align: right;">Billed</th>
                <th style="text-align: right;">Paid</th>
                <th style="text-align: right;">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceRowsHtml}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">Grand Total</td>
                <td style="text-align: right;">${formatINR(totalInvoiced)}</td>
                <td style="text-align: right; color: #059669;">${formatINR(totalReceived)}</td>
                <td style="text-align: right; color: ${balanceDue > 0 ? '#DC2626' : '#059669'};">${formatINR(balanceDue)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p>Thank you for your business. For any questions regarding this statement, please contact <strong>${contactEmail}</strong>.</p>
            <p style="font-size: 10px; color: #9CA3AF; margin-top: 20px;">Computer-generated statement. Powered by FreelanceOS India.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      addToast('Statement opened in new tab!');
    } else {
      addToast('Popup blocked! Please allow popups to view statement.', 'error');
    }
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" />
            Client Ledger
          </h1>
          <p className="text-sm text-dark-300 mt-0.5">Per-client statement of all invoices, payments, and outstanding balance.</p>
        </div>
        {client && (
          <button onClick={shareStatement} className="btn-primary flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share Statement
          </button>
        )}
      </div>

      {/* Client Selector */}
      <div className="glass-card p-5">
        <label className="block text-sm font-medium text-dark-200 mb-2">Select Client</label>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full pl-10 appearance-none"
          >
            <option value="">Search and select a client to view their ledger...</option>
            {state.clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
        </div>
      </div>

      {/* Summary Cards */}
      {client && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-dark-400">Total Invoiced</p>
              <p className="text-xl font-bold text-dark-50 mt-0.5">{formatINR(summary.totalInvoiced)}</p>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4 text-green-400" />
                </div>
              </div>
              <p className="text-xs text-dark-400">Total Received</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{formatINR(summary.totalReceived)}</p>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4 text-red-400" />
                </div>
              </div>
              <p className="text-xs text-dark-400">Balance Due</p>
              <p className={`text-xl font-bold mt-0.5 ${summary.balanceDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatINR(summary.balanceDue)}
              </p>
            </div>
          </div>

          {/* Statement Table */}
          {clientInvoices.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-600/30">
                      <th className="table-header px-4 py-3 text-left">Date</th>
                      <th className="table-header px-4 py-3 text-left">Invoice #</th>
                      <th className="table-header px-4 py-3 text-left">Description</th>
                      <th className="table-header px-4 py-3 text-right">Invoice Amt</th>
                      <th className="table-header px-4 py-3 text-right">Paid</th>
                      <th className="table-header px-4 py-3 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoices.map(inv => {
                      const total = getInvoiceTotal(inv);
                      const paid = inv.status === 'Paid' ? total : (inv.amountPaid || 0);
                      const outstanding = total - paid;
                      const description = (inv.lineItems || []).map(li => li.description).join(', ');
                      return (
                        <tr key={inv.id} className="border-b border-dark-600/10 hover:bg-dark-700/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-dark-300">{formatDate(inv.date)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-dark-50">{inv.invoiceNumber}</td>
                          <td className="px-4 py-3 text-sm text-dark-200 max-w-[200px] truncate">{description}</td>
                          <td className="px-4 py-3 text-sm text-dark-100 text-right">{formatINR(total)}</td>
                          <td className="px-4 py-3 text-sm text-emerald-400 text-right">{formatINR(paid)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-right">
                            {outstanding > 0 ? (
                              <span className="text-red-400">{formatINR(outstanding)}</span>
                            ) : (
                              <span className="text-emerald-400">Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-dark-600/30 text-xs text-dark-400">
                Generated {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <FileText className="w-12 h-12 text-dark-400 mx-auto mb-3" />
              <p className="text-dark-300">No invoices found for this client</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
