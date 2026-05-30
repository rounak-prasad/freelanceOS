// ==========================================
// FreelanceOS — Security & Data (cloud/auth mode)
// Audit log (owner/admin), workspace backup (owner), DPDP/GDPR data export,
// and account erasure. Talks to /api/admin and /api/account.
// ==========================================
import React, { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { getWorkspaceId } from '../services/authClient';
import { ShieldCheck, Download, Loader2, AlertCircle, History, Trash2 } from 'lucide-react';

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function SecurityData() {
  const { user, workspaces, logout } = useAuth();
  const wsId = getWorkspaceId();
  const myRole = workspaces?.find((w) => w.id === wsId)?.role || 'member';
  const canAdmin = ['owner', 'admin'].includes(myRole);
  const isOwner = myRole === 'owner';

  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [delPwd, setDelPwd] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    if (!canAdmin) { setAudit({ entries: [], total: 0 }); return; }
    apiGet('/admin/audit?limit=100').then(setAudit).catch((e) => setError(e.message));
  }, [canAdmin]);
  useEffect(() => { load(); }, [load]);

  async function exportMyData() {
    setBusy('export'); setError(null); setNotice('');
    try { const d = await apiGet('/account/export'); downloadJson(d, `freelanceos-my-data-${Date.now()}.json`); setNotice('Your data export downloaded.'); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function backupWorkspace() {
    setBusy('backup'); setError(null); setNotice('');
    try { const d = await apiGet('/admin/backup'); downloadJson(d, `freelanceos-backup-${Date.now()}.json`); setNotice('Workspace backup downloaded.'); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function deleteAccount() {
    setBusy('delete'); setError(null);
    try {
      await apiPost('/account/delete', { password: delPwd });
      logout();
    } catch (e) { setError(e.message); setBusy(''); }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-accent" /> Security & Data</h1>
        <p className="text-dark-300 text-sm mt-1">Audit trail, backups, and your data rights (export & erasure).</p>
      </div>

      {notice && <div className="glass-card p-3 text-sm text-accent border-accent/20">{notice}</div>}
      {error && <div className="glass-card p-3 text-sm text-red-400 border-red-500/20 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {/* Data rights + backup */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="section-title">Your data</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportMyData} disabled={busy === 'export'} className="btn-secondary flex items-center gap-2"><Download className="w-4 h-4" /> {busy === 'export' ? 'Exporting…' : 'Export my data'}</button>
          {isOwner && <button onClick={backupWorkspace} disabled={busy === 'backup'} className="btn-secondary flex items-center gap-2"><Download className="w-4 h-4" /> {busy === 'backup' ? 'Backing up…' : 'Download workspace backup'}</button>}
        </div>
        <p className="text-xs text-dark-400">Exports are machine-readable JSON (DPDP/GDPR portability). Sensitive fields are encrypted at rest on the server.</p>
      </div>

      {/* Audit log */}
      {canAdmin && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-dark-600/50 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2"><History className="w-4 h-4 text-dark-300" /> Audit log</h2>
            {audit && <span className="text-xs text-dark-400">{audit.total} total</span>}
          </div>
          {!audit ? (
            <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
          ) : audit.entries.length === 0 ? (
            <p className="p-5 text-dark-400 text-sm">No activity recorded yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto custom-scroll">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-dark-800"><tr className="text-left border-b border-dark-600/50">
                  <th className="table-header px-5 py-2.5">When</th>
                  <th className="table-header px-5 py-2.5">Action</th>
                  <th className="table-header px-5 py-2.5">Entity</th>
                  <th className="table-header px-5 py-2.5">IP</th>
                </tr></thead>
                <tbody>
                  {audit.entries.map((e) => (
                    <tr key={e.id} className="border-b border-dark-700/50 last:border-0">
                      <td className="px-5 py-2.5 text-dark-300 text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-2.5"><span className="badge bg-dark-700 text-dark-200 font-mono text-[11px]">{e.action}</span></td>
                      <td className="px-5 py-2.5 text-dark-400 text-xs">{e.entity_type || '—'}{e.entity_id ? ` · ${String(e.entity_id).slice(0, 8)}` : ''}</td>
                      <td className="px-5 py-2.5 text-dark-500 text-xs">{e.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div className="glass-card p-5 space-y-3 border-red-500/20">
        <h2 className="section-title text-red-400 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete account</h2>
        <p className="text-xs text-dark-400">Permanently deletes your account and the workspaces you own (and all their data). This cannot be undone.</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="btn-danger">Delete my account…</button>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="input-label">Confirm with your password</label>
              <input type="password" value={delPwd} onChange={(e) => setDelPwd(e.target.value)} placeholder="Your password" />
            </div>
            <button onClick={deleteAccount} disabled={busy === 'delete' || !delPwd} className="btn-danger">{busy === 'delete' ? 'Deleting…' : 'Permanently delete'}</button>
            <button onClick={() => { setConfirmDelete(false); setDelPwd(''); }} className="btn-ghost">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
