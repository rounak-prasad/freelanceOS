/**
 * Login / Register screen. Shown only when APP_CONFIG.requireAuth is on (the
 * http/DB backend). Matches the app's dark theme. Local mode never sees this.
 */
import React, { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register({
          email: form.email, password: form.password,
          name: form.name || undefined, workspaceName: form.workspaceName || undefined,
        });
      }
      // On success the gate in main.jsx re-renders into the app.
    } catch (e2) {
      setErr(e2.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center shadow-lg shadow-accent/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-50 tracking-tight">Freelance<span className="text-gradient">OS</span></h1>
            <p className="text-[11px] text-dark-300 -mt-0.5">The money &amp; compliance OS for Indian freelancers</p>
          </div>
        </div>

        <div className="bg-dark-800/80 backdrop-blur border border-dark-600/50 rounded-2xl p-6 shadow-xl">
          <div className="flex gap-1 p-1 bg-dark-900/60 rounded-lg mb-6">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErr(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === m ? 'bg-accent/15 text-accent' : 'text-dark-300 hover:text-dark-100'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <Field label="Your name">
                <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Asha Verma" autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <input className={inputCls} type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
            </Field>
            <Field label="Password">
              <input className={inputCls} type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </Field>
            {mode === 'register' && (
              <Field label="Workspace name (optional)">
                <input className={inputCls} value={form.workspaceName} onChange={set('workspaceName')} placeholder="Asha's Studio" />
              </Field>
            )}

            {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-br from-accent to-amber-500 text-white font-semibold shadow-lg shadow-accent/20 hover:opacity-95 transition disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-dark-400 mt-6">
          Your data is scoped to your workspace. Tax/GST/FEMA logic is decision-support, not professional advice.
        </p>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-dark-900/60 border border-dark-600/60 text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-dark-300 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
