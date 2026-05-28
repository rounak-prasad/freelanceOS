import{a0 as z,a3 as P,V as d,O as e,B as A,z as r,w as S,F as T,s as R}from"./index-Ma0noDzz.js";import{S as L}from"./share-2-C50gA6iW.js";import{S as M}from"./search-CTkDxe7n.js";import{C as O}from"./chevron-down-CYbWhCkM.js";import{I as F}from"./indian-rupee-DzTmXv9o.js";function u(a){if(a.total)return a.total;const g=(a.lineItems||[]).reduce((x,p)=>x+p.quantity*p.rate,0);return R(g,a.gstRate||18,a.isInterState||!1).total}function Y(){const{state:a,addToast:g}=z(),[b]=P(),[x,p]=d.useState(""),[f,q]=d.useState("");d.useEffect(()=>{const t=b.get("clientId");t&&p(t)},[b]),d.useMemo(()=>{if(!f.trim())return a.clients;const t=f.toLowerCase();return a.clients.filter(s=>s.name.toLowerCase().includes(t)||s.company&&s.company.toLowerCase().includes(t))},[a.clients,f]);const o=d.useMemo(()=>a.clients.find(t=>t.id===x),[a.clients,x]),c=d.useMemo(()=>o?a.invoices.filter(t=>t.clientName===o.name||t.clientId===o.id).sort((t,s)=>new Date(s.date)-new Date(t.date)):[],[a.invoices,o]),l=d.useMemo(()=>{const t=c.reduce((i,n)=>i+u(n),0),s=c.reduce((i,n)=>n.status==="Paid"?i+u(n):i+(n.amountPaid||0),0);return{totalInvoiced:t,totalReceived:s,balanceDue:t-s}},[c]);function $(){if(!o)return;const t=new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}),s=l.totalInvoiced,i=l.totalReceived,n=l.balanceDue,y=c.map(m=>{const j=u(m),k=m.status==="Paid"?j:m.amountPaid||0,N=j-k,I=(m.lineItems||[]).map(C=>C.description).join(", ");return`
        <tr>
          <td>${S(m.date)}</td>
          <td><strong>${m.invoiceNumber}</strong></td>
          <td>${I}</td>
          <td style="text-align: right;">${r(j)}</td>
          <td style="text-align: right; color: #10B981;">${r(k)}</td>
          <td style="text-align: right; font-weight: bold; color: ${N>0?"#EF4444":"#10B981"};">
            ${N>0?r(N):"Settled"}
          </td>
        </tr>
      `}).join(""),h=a.settings.businessName||a.settings.yourName||"My Freelance Business",B=h.charAt(0).toUpperCase(),w=a.settings.email||"you@example.com",D=o.company?`<div style="color: #4B5563; font-size: 14px; font-weight: normal; margin-top: 4px;">${o.company}</div>`:"",E=`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Statement of Account - ${o.name}</title>
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
            color: ${n>0?"#DC2626":"#0F766E"};
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
              <div class="logo-box">${B}</div>
              <div>
                <div class="business-name">${h}</div>
                <div style="font-size: 10px; color: #6B7280;">Professional Freelance Services</div>
              </div>
            </div>
            <div class="statement-title">
              <h1>Statement of Account</h1>
              <p>As of ${t}</p>
            </div>
          </div>
          
          <div class="details-grid">
            <div class="party-details">
              <h3>Statement For</h3>
              <div class="name">${o.name}</div>
              ${D}
              <div style="color: #4B5563; font-size: 13px; margin-top: 4px;">${o.address||""}</div>
            </div>
            <div class="party-details" style="text-align: right;">
              <h3>Prepared By</h3>
              <div class="name">${a.settings.yourName||h}</div>
              <div style="color: #4B5563; font-size: 13px; margin-top: 4px;">${a.settings.address||""}</div>
              <div style="color: #4B5563; font-size: 13px;">${w}</div>
            </div>
          </div>
          
          <div class="summary-bar">
            <div class="summary-card">
              <p>Total Invoiced</p>
              <h2>${r(s)}</h2>
            </div>
            <div class="summary-card">
              <p>Total Received</p>
              <h2 style="color: #059669;">${r(i)}</h2>
            </div>
            <div class="summary-card due">
              <p>Balance Due</p>
              <h2>${r(n)}</h2>
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
              ${y}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">Grand Total</td>
                <td style="text-align: right;">${r(s)}</td>
                <td style="text-align: right; color: #059669;">${r(i)}</td>
                <td style="text-align: right; color: ${n>0?"#DC2626":"#059669"};">${r(n)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <p>Thank you for your business. For any questions regarding this statement, please contact <strong>${w}</strong>.</p>
            <p style="font-size: 10px; color: #9CA3AF; margin-top: 20px;">Computer-generated statement. Powered by FreelanceOS India.</p>
          </div>
        </div>
      </body>
      </html>
    `,v=window.open("","_blank");v?(v.document.write(E),v.document.close(),g("Statement opened in new tab!")):g("Popup blocked! Please allow popups to view statement.","error")}return e.jsxs("div",{className:"page-enter space-y-6",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between gap-4",children:[e.jsxs("div",{children:[e.jsxs("h1",{className:"text-2xl font-bold text-dark-50 tracking-tight flex items-center gap-2",children:[e.jsx(A,{className:"w-6 h-6 text-accent"}),"Client Ledger"]}),e.jsx("p",{className:"text-sm text-dark-300 mt-0.5",children:"Per-client statement of all invoices, payments, and outstanding balance."})]}),o&&e.jsxs("button",{onClick:$,className:"btn-primary flex items-center gap-2",children:[e.jsx(L,{className:"w-4 h-4"})," Share Statement"]})]}),e.jsxs("div",{className:"glass-card p-5",children:[e.jsx("label",{className:"block text-sm font-medium text-dark-200 mb-2",children:"Select Client"}),e.jsxs("div",{className:"relative max-w-md",children:[e.jsx(M,{className:"absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400"}),e.jsxs("select",{value:x,onChange:t=>p(t.target.value),className:"w-full pl-10 appearance-none",children:[e.jsx("option",{value:"",children:"Search and select a client to view their ledger..."}),a.clients.map(t=>e.jsxs("option",{value:t.id,children:[t.name,t.company?` (${t.company})`:""]},t.id))]}),e.jsx(O,{className:"absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none"})]})]}),o&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-4",children:[e.jsxs("div",{className:"glass-card p-5",children:[e.jsx("div",{className:"flex items-center gap-2 mb-2",children:e.jsx("div",{className:"w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center",children:e.jsx(F,{className:"w-4 h-4 text-blue-400"})})}),e.jsx("p",{className:"text-xs text-dark-400",children:"Total Invoiced"}),e.jsx("p",{className:"text-xl font-bold text-dark-50 mt-0.5",children:r(l.totalInvoiced)})]}),e.jsxs("div",{className:"glass-card p-5",children:[e.jsx("div",{className:"flex items-center gap-2 mb-2",children:e.jsx("div",{className:"w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center",children:e.jsx(F,{className:"w-4 h-4 text-green-400"})})}),e.jsx("p",{className:"text-xs text-dark-400",children:"Total Received"}),e.jsx("p",{className:"text-xl font-bold text-emerald-400 mt-0.5",children:r(l.totalReceived)})]}),e.jsxs("div",{className:"glass-card p-5",children:[e.jsx("div",{className:"flex items-center gap-2 mb-2",children:e.jsx("div",{className:"w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center",children:e.jsx(F,{className:"w-4 h-4 text-red-400"})})}),e.jsx("p",{className:"text-xs text-dark-400",children:"Balance Due"}),e.jsx("p",{className:`text-xl font-bold mt-0.5 ${l.balanceDue>0?"text-red-400":"text-emerald-400"}`,children:r(l.balanceDue)})]})]}),c.length>0?e.jsxs("div",{className:"glass-card overflow-hidden",children:[e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-dark-600/30",children:[e.jsx("th",{className:"table-header px-4 py-3 text-left",children:"Date"}),e.jsx("th",{className:"table-header px-4 py-3 text-left",children:"Invoice #"}),e.jsx("th",{className:"table-header px-4 py-3 text-left",children:"Description"}),e.jsx("th",{className:"table-header px-4 py-3 text-right",children:"Invoice Amt"}),e.jsx("th",{className:"table-header px-4 py-3 text-right",children:"Paid"}),e.jsx("th",{className:"table-header px-4 py-3 text-right",children:"Outstanding"})]})}),e.jsx("tbody",{children:c.map(t=>{const s=u(t),i=t.status==="Paid"?s:t.amountPaid||0,n=s-i,y=(t.lineItems||[]).map(h=>h.description).join(", ");return e.jsxs("tr",{className:"border-b border-dark-600/10 hover:bg-dark-700/30 transition-colors",children:[e.jsx("td",{className:"px-4 py-3 text-sm text-dark-300",children:S(t.date)}),e.jsx("td",{className:"px-4 py-3 text-sm font-medium text-dark-50",children:t.invoiceNumber}),e.jsx("td",{className:"px-4 py-3 text-sm text-dark-200 max-w-[200px] truncate",children:y}),e.jsx("td",{className:"px-4 py-3 text-sm text-dark-100 text-right",children:r(s)}),e.jsx("td",{className:"px-4 py-3 text-sm text-emerald-400 text-right",children:r(i)}),e.jsx("td",{className:"px-4 py-3 text-sm font-semibold text-right",children:n>0?e.jsx("span",{className:"text-red-400",children:r(n)}):e.jsx("span",{className:"text-emerald-400",children:"Settled"})})]},t.id)})})]})}),e.jsxs("div",{className:"px-4 py-3 border-t border-dark-600/30 text-xs text-dark-400",children:["Generated ",new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})]})]}):e.jsxs("div",{className:"glass-card p-12 text-center",children:[e.jsx(T,{className:"w-12 h-12 text-dark-400 mx-auto mb-3"}),e.jsx("p",{className:"text-dark-300",children:"No invoices found for this client"})]})]})]})}export{Y as default};
