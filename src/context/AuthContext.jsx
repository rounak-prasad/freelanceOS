/**
 * AuthContext — React auth state for FreelanceOS.
 *
 * In local mode (default, zero-config) auth is bypassed entirely so the product
 * still runs on localStorage + sample data. When APP_CONFIG.requireAuth is on
 * (i.e. the http/DB backend), the app gates on a real session and rehydrates the
 * user via GET /api/auth/me on load.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as auth from '../services/authClient.js';
import APP_CONFIG from '../config/appConfig.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(APP_CONFIG.requireAuth);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!APP_CONFIG.requireAuth) { setLoading(false); return; }
    let active = true;
    if (auth.getToken()) {
      auth.me()
        .then((d) => { if (active) { setUser(d.user); setWorkspaces(d.workspaces || []); } })
        .catch(() => auth.logout())
        .finally(() => active && setLoading(false));
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, []);

  const login = useCallback(async (payload) => {
    setError(null);
    const d = await auth.login(payload);
    setUser(d.user); setWorkspaces(d.workspaces || []);
    return d;
  }, []);

  const register = useCallback(async (payload) => {
    setError(null);
    const d = await auth.register(payload);
    setUser(d.user); setWorkspaces(d.workspaces || []);
    return d;
  }, []);

  const logout = useCallback(() => {
    auth.logout();
    setUser(null); setWorkspaces([]);
    if (APP_CONFIG.requireAuth) window.location.reload();
  }, []);

  return (
    <AuthContext.Provider value={{
      user, workspaces, loading, error, setError,
      isAuthed: !!user, login, register, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
