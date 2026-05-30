// ==========================================
// FreelanceOS — GST Filing (cloud/auth mode)
// e-invoicing (IRN) per invoice + GSTR-1 JSON export. Talks to /api/gst.
// e-invoicing is gated to paid plans (the server returns 402 otherwise).
// ==========================================
import React, { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '../services/apiClient';
import { FileCheck2, Download, Loader2, AlertCircle, BadgeCheck, ShieldAlert } from 'lucide-react';

const rupees = (minor) => `₹${(Number(minor || 0) / 100).toLocaleString('en-IN')}`;

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function defaultPeriod() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
}

export default function GstFiling() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [period, setPeriod] = useState(defaultPeriod());
  const [gstr1, setGstr1] = useState(null);
  const [profile, setProfile] = useState(null);

  const load = useCallback(() => {
    setError(null);
    apiGet('/gst/einvoice/status').then(setRows).catch((e) => setError(e.message));
    apiGet('/team/workspace')
      .then((w) => setProfile({ gstin: w.gstin || '', legalName: w.legal_name || '', stateCode: w.state_code || '', hasLut: !!w.has_lut, gstRegistered: !!w.gst_registered }))
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy('profile'); setError(null); setNotice('');
    try { await apiPatch('/team/workspace', profile); setNotice('Tax profile saved.'); load(); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  async function generateIrn(id) {
    setBusy(id); setError(null); setNotice('');
    try {
      const res = await apiPost(`/gst/invoices/${id}/einvoice`, {});
      setNotice(`IRN generated (${res.mode} mode): ${res.irn.slice(0, 16)}…`);
      load();
    } catch (e) {
      setError(e.data?.errors ? `${e.message}: ${e.data.errors.join('; ')}` : e.message);
    } finally { setBusy(''); }
  }

  async function loadGstr1() {
    setBusy('gstr1'); setError(null); setGstr1(null);
    try { setGstr1(await apiGet(`/gst/gstr1?period=${encodeURIComponent(period)}`)); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  if (!rows && error) {
    return (
      <div className="max-w-md mx-auto mt-20 glass-card p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-dark-200 text-sm">{error}</p>
        <p className="text-dark-400 text-xs">GST filing is available when the app runs against the API server (cloud mode).</p>
      </div>
    );
  }
  if (!rows) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 flex items-center gap-2"><FileCheck2 className="w-6 h-6 text-accent" /> GST Filing</h1>
        <p className="text-dark-300 text-sm mt-1">Generate IRNs (e-invoices) and export your GSTR-1 return.</p>
      </div>

      {notice && <div className="glass-card p-3 text-sm text-accent border-accent/20 flex items-center gap-2"><BadgeCheck className="w-4 h-4" /> {notice}</div>}
      {error && <div className="glass-card p-3 text-sm text-red-400 border-red-500/20 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {/* Tax profile — required for e-invoicing */}
      {profile && (
        <form onSubmit={saveProfile} className="glass-card p-5 space-y-3">
          <h2 className="section-title">Tax profile</h2>
          <p className="text-dark-400 text-xs">Your GSTIN, legal name and state code — required to generate e-invoices.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="input-label">GSTIN</label><input value={profile.gstin} onChange={(e) => setProfile((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))} maxLength={15} placeholder="29ABCDE1234F1Z5" /></div>
            <div><label className="input-label">Legal name</label><input value={profile.legalName} onChange={(e) => setProfile((p) => ({ ...p, legalName: e.target.value }))} placeholder="As registered on the GST portal" /></div>
            <div><label className="input-label">State code</label><input value={profile.stateCode} onChange={(e) => setProfile((p) => ({ ...p, stateCode: e.target.value }))} maxLength={2} placeholder="29" /></div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-dark-200"><input type="checkbox" checked={profile.gstRegistered} onChange={(e) => setProfile((p) => ({ ...p, gstRegistered: e.target.checked }))} /> GST registered</label>
              <label className="flex items-center gap-2 text-sm text-dark-200"><input type="checkbox" checked={profile.hasLut} onChange={(e) => setProfile((p) => ({ ...p, hasLut: e.target.checked }))} /> Has LUT</label>
            </div>
          </div>
          <button type="submit" disabled={busy === 'profile'} className="btn-primary">{busy === 'profile' ? 'Saving…' : 'Save tax profile'}</button>
        </form>
      )}

      {/* GSTR-1 export */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="section-title">GSTR-1 export</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="input-label">Period (MMYYYY)</label>
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="052026" className="w-40" />
          </div>
          <button onClick={loadGstr1} disabled={busy === 'gstr1'} className="btn-primary">{busy === 'gstr1' ? 'Building…' : 'Build GSTR-1'}</button>
          {gstr1 && (
            <button onClick={() => downloadJson(gstr1.gstr1, `GSTR1-${gstr1.period}.json`)} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> Download JSON
            </button>
          )}
        </div>
        {gstr1 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            {[['Invoices', gstr1.summary.invoices], ['B2B', gstr1.summary.b2b], ['B2C (S+L)', gstr1.summary.b2cs + gstr1.summary.b2cl], ['Exports', gstr1.summary.exp], ['Taxable', `₹${gstr1.summary.taxable.toLocaleString('en-IN')}`]].map(([k, v]) => (
              <div key={k} className="glass-card p-3"><div className="text-dark-400 text-xs">{k}</div><div className="text-dark-50 font-semibold">{v}</div></div>
            ))}
          </div>
        )}
        {gstr1 && !gstr1.irpConfigured && (
          <p className="text-xs text-amber-300/80 flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5" /> Sandbox mode — connect a GSP (IRP credentials) to file live.</p>
        )}
      </div>

      {/* e-invoicing per invoice */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-dark-600/50"><h2 className="section-title">e-Invoicing (IRN)</h2></div>
        {rows.length === 0 ? (
          <p className="p-5 text-dark-400 text-sm">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-dark-600/50">
              <th className="table-header px-5 py-2.5">Invoice</th>
              <th className="table-header px-5 py-2.5">Amount</th>
              <th className="table-header px-5 py-2.5">IRN</th>
              <th className="table-header px-5 py-2.5 text-right">Action</th>
            </tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-dark-700/50 last:border-0">
                  <td className="px-5 py-3"><div className="text-dark-100 font-medium">{i.number}</div><div className="text-dark-400 text-xs">{i.issue_date} · {i.status}</div></td>
                  <td className="px-5 py-3 text-dark-200">{rupees(i.total_minor)}</td>
                  <td className="px-5 py-3">
                    {i.irn
                      ? <span className="badge bg-accent/15 text-accent font-mono text-[11px]" title={i.irn}>{i.irn.slice(0, 14)}…</span>
                      : <span className="text-dark-500 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {i.irn
                      ? <span className="text-accent text-xs flex items-center gap-1 justify-end"><BadgeCheck className="w-3.5 h-3.5" /> Generated</span>
                      : <button onClick={() => generateIrn(i.id)} disabled={busy === i.id} className="btn-secondary">{busy === i.id ? 'Working…' : 'Generate IRN'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-dark-400">
        e-invoicing is included on Pro and Team plans. IRN/QR are generated in sandbox mode until you connect a GSP;
        figures are decision-support — reconcile in the GST portal before filing.
      </p>
    </div>
  );
}
