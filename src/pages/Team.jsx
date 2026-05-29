// ==========================================
// FreelanceOS — Team (cloud/auth mode)
// Members + invitations via /api/team. Role management is owner/admin only;
// the server enforces RBAC and last-owner protection — the UI mirrors it.
// ==========================================
import React, { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { getWorkspaceId } from '../services/authClient';
import { Users, UserPlus, Trash2, AlertCircle, Loader2, Clock, Copy, Check } from 'lucide-react';

const ROLE_STYLES = {
  owner: 'bg-accent/15 text-accent',
  admin: 'bg-blue-500/15 text-blue-300',
  member: 'bg-dark-700 text-dark-200',
  viewer: 'bg-dark-700 text-dark-400',
};

export default function Team() {
  const { user, workspaces } = useAuth();
  const wsId = getWorkspaceId();
  const myRole = workspaces?.find((w) => w.id === wsId)?.role || 'member';
  const canManage = ['owner', 'admin'].includes(myRole);
  const assignableRoles = myRole === 'owner' ? ['owner', 'admin', 'member', 'viewer'] : ['admin', 'member', 'viewer'];

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'member' });
  const [copiedLink, setCopiedLink] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setMembers(await apiGet('/team/members'));
      if (['owner', 'admin'].includes(myRole)) setInvites(await apiGet('/team/invitations'));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [myRole]);
  useEffect(() => { load(); }, [load]);

  async function invite(e) {
    e.preventDefault();
    setBusy(true); setError(null); setCopiedLink('');
    try {
      const res = await apiPost('/team/invitations', { email: form.email.trim(), role: form.role });
      if (res.inviteLink) setCopiedLink(res.inviteLink);
      setForm({ email: '', role: 'member' });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const changeRole = (userId, role) => apiPatch(`/team/members/${userId}`, { role }).then(load).catch((e) => setError(e.message));
  const removeMember = (userId) => apiDelete(`/team/members/${userId}`).then(load).catch((e) => setError(e.message));
  const revoke = (id) => apiDelete(`/team/invitations/${id}`).then(load).catch((e) => setError(e.message));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;

  if (error && members.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-20 glass-card p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-dark-200 text-sm">{error}</p>
        <p className="text-dark-400 text-xs">Team management is available when the app runs against the API server (cloud mode).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-dark-50 flex items-center gap-2"><Users className="w-6 h-6 text-accent" /> Team</h1>
        <p className="text-dark-300 text-sm mt-1">Invite teammates and manage their access to this workspace.</p>
      </div>

      {error && <div className="glass-card p-3 text-sm text-red-400 border-red-500/20 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {/* Invite form */}
      {canManage && (
        <form onSubmit={invite} className="glass-card p-5 space-y-3">
          <h2 className="section-title flex items-center gap-2"><UserPlus className="w-4 h-4 text-accent" /> Invite a teammate</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email" required placeholder="teammate@email.com"
              value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="flex-1"
            />
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {['admin', 'member', 'viewer'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="submit" disabled={busy} className="btn-primary whitespace-nowrap">
              {busy ? 'Sending…' : 'Send invite'}
            </button>
          </div>
          {copiedLink && (
            <div className="flex items-center gap-2 text-xs text-dark-300 bg-dark-700/60 rounded-lg p-2">
              <span className="truncate flex-1">{copiedLink}</span>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(copiedLink); }} className="btn-ghost px-2 py-1 flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copy</button>
            </div>
          )}
          <p className="text-xs text-dark-400">Seats are governed by your plan. The invite link is emailed; in dev it's also shown here for testing.</p>
        </form>
      )}

      {/* Members */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-dark-600/50"><h2 className="section-title">Members ({members.length})</h2></div>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-dark-600/50">
            <th className="table-header px-5 py-2.5">Member</th>
            <th className="table-header px-5 py-2.5">Role</th>
            <th className="table-header px-5 py-2.5 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.user_id === user?.id;
              return (
                <tr key={m.user_id} className="border-b border-dark-700/50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-dark-100">{m.name || m.email}{isSelf && <span className="text-dark-400 font-normal"> (you)</span>}</div>
                    <div className="text-dark-400 text-xs">{m.email}{m.email_verified ? '' : ' · unverified'}</div>
                  </td>
                  <td className="px-5 py-3">
                    {canManage && !isSelf ? (
                      <select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)} className="py-1.5">
                        {assignableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className={`badge ${ROLE_STYLES[m.role] || 'bg-dark-700 text-dark-200'}`}>{m.role}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canManage && !isSelf && (
                      <button onClick={() => removeMember(m.user_id)} className="btn-ghost text-red-400 hover:bg-red-500/10 px-2 py-1 inline-flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {canManage && invites.filter((i) => i.status === 'pending').length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-dark-600/50"><h2 className="section-title flex items-center gap-2"><Clock className="w-4 h-4 text-dark-300" /> Pending invitations</h2></div>
          <table className="w-full text-sm">
            <tbody>
              {invites.filter((i) => i.status === 'pending').map((i) => (
                <tr key={i.id} className="border-b border-dark-700/50 last:border-0">
                  <td className="px-5 py-3 text-dark-100">{i.email}</td>
                  <td className="px-5 py-3"><span className={`badge ${ROLE_STYLES[i.role] || 'bg-dark-700 text-dark-200'}`}>{i.role}</span></td>
                  <td className="px-5 py-3 text-dark-400 text-xs">expires {new Date(i.expires_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => revoke(i.id)} className="btn-ghost text-red-400 hover:bg-red-500/10 px-2 py-1">Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
