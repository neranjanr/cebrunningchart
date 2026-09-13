'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface ExtendedUser {
  id: string;
  email?: string;
  isSuperAdmin?: boolean;
  user_metadata?: any;
}

interface SessionLike {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: ExtendedUser;
}

interface AuthContextType {
  session: SessionLike | null;
  user: ExtendedUser | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  // deprecated: kept for compat
  signInWithGoogle: (mockEmail?: string) => Promise<void>;
  signInWithSuperAdmin: (username: string, password: string, totp?: string) => Promise<{ success: boolean; mustChangePassword?: boolean; mustEnrollTOTP?: boolean; totpRequired?: boolean; error?: string }>;
  changeSuperAdminPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  // TOTP / recovery
  setupTOTP: () => Promise<{ secret: string; uri: string; qrDataUrl: string | null }>;
  verifyTOTPSetup: (token: string) => Promise<{ success: boolean; recoveryCode?: string; error?: string }>;
  confirmRecoverySaved: () => Promise<{ success: boolean; error?: string }>;
  recoverWithCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  // deprecated allow-list stubs
  getAllowedEmailsState: () => string[];
  addAllowedEmail: (email: string) => { success: boolean; error?: string };
  removeAllowedEmail: (email: string) => { success: boolean; error?: string };
  setAllowedEmailsState: (emails: string[]) => void;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  isRecoverySession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionLike | null>(null);
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  const isSuperAdmin = !!user?.isSuperAdmin;
  const mustChangePassword = isSuperAdmin ? (user?.user_metadata?.must_change_password ?? false) : false;

  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'session' }) })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setUser(data.user as ExtendedUser);
          setIsRecoverySession(!!data.isRecoverySession);
          setSession({ access_token: 'server-session', refresh_token: 'server-session', expires_in: 3600, token_type: 'bearer', user: data.user } as SessionLike);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError('Google SSO removed — use Super Admin + TOTP (ADR-0010)');
  }, []);

  const signInWithSuperAdmin = useCallback(async (username: string, password: string, totp?: string) => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password, totp }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || 'Invalid credentials';
        if (data.totpRequired) return { success: false, totpRequired: true, error: err };
        setAuthError(err);
        return { success: false, error: err, totpRequired: !!data.totpRequired };
      }
      if (data.mustChangePassword) {
        // recovery session for password change
        setIsRecoverySession(true);
        return { success: true, mustChangePassword: true };
      }
      if (data.mustEnrollTOTP) {
        setIsRecoverySession(true);
        return { success: true, mustEnrollTOTP: true };
      }
      if (data.user) {
        setUser(data.user as ExtendedUser);
        setIsRecoverySession(false);
        setSession({ access_token: 'server-session', refresh_token: 'server-session', expires_in: 3600, token_type: 'bearer', user: data.user } as SessionLike);
      }
      return { success: true, mustChangePassword: !!data.mustChangePassword, mustEnrollTOTP: !!data.mustEnrollTOTP };
    } catch {
      const err = 'Login failed';
      setAuthError(err);
      return { success: false, error: err };
    }
  }, []);

  const changeSuperAdminPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change-password', currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to change password' };
      if (user) {
        const updatedUser: ExtendedUser = { ...user, user_metadata: { ...(user.user_metadata ?? {}), must_change_password: false }, isSuperAdmin: true };
        setUser(updatedUser);
        setSession(prev => prev ? ({ ...prev, user: updatedUser } as SessionLike) : prev);
      }
      return { success: true };
    } catch { return { success: false, error: 'Failed to change password' }; }
  }, [user]);

  const setupTOTP = useCallback(async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup-totp' }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to setup TOTP');
    return data;
  }, []);

  const verifyTOTPSetup = useCallback(async (token: string) => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify-totp-setup', totp: token }) });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Invalid TOTP' };
    return { success: true, recoveryCode: data.recoveryCode };
  }, []);

  const confirmRecoverySaved = useCallback(async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm-recovery-saved' }) });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Failed' };
    if (data.user) {
      setUser(data.user as ExtendedUser);
      setIsRecoverySession(false);
      setSession({ access_token: 'server-session', refresh_token: 'server-session', expires_in: 3600, token_type: 'bearer', user: data.user } as SessionLike);
    }
    return { success: true };
  }, []);

  const recoverWithCode = useCallback(async (code: string) => {
    setAuthError(null);
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recovery', recoveryCode: code }) });
    const data = await res.json();
    if (!res.ok) { const err = data.error || 'Recovery failed'; setAuthError(err); return { success: false, error: err }; }
    setIsRecoverySession(true);
    return { success: true };
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }).catch(() => {});
    setSession(null);
    setUser(null);
    setIsRecoverySession(false);
  }, []);

  // deprecated allow-list stubs
  const getAllowedEmailsState = useCallback(() => [] as string[], []);
  const addAllowedEmail = useCallback(() => ({ success: false, error: 'Allowed Email removed — single-operator mode (ADR-0010)' }), []);
  const removeAllowedEmail = useCallback(() => ({ success: false, error: 'Allowed Email removed — single-operator mode (ADR-0010)' }), []);
  const setAllowedEmailsState = useCallback(() => {}, []);

  return (
    <AuthContext.Provider value={{
      session, user, loading, authError, clearAuthError,
      signInWithGoogle, signInWithSuperAdmin, changeSuperAdminPassword, signOut,
      setupTOTP, verifyTOTPSetup, confirmRecoverySaved, recoverWithCode,
      getAllowedEmailsState, addAllowedEmail, removeAllowedEmail, setAllowedEmailsState,
      isSuperAdmin, mustChangePassword, isRecoverySession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
