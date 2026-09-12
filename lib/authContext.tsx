'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  BOOTSTRAP_PASSWORD_HASH,
  getSuperAdminState,
  setSuperAdminState,
  hashPassword,
  verifyPassword,
  isSuperAdminUsername,
  getAllowedEmails,
  setAllowedEmails,
  addAllowedEmail as addEmailStore,
  removeAllowedEmail as removeEmailStore,
  canGoogleUserSignIn,
} from './authAccess';

interface ExtendedUser extends User {
  isSuperAdmin?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: ExtendedUser | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: (mockEmail?: string) => Promise<void>;
  signInWithSuperAdmin: (username: string, password: string) => Promise<{ success: boolean; mustChangePassword?: boolean; error?: string }>;
  changeSuperAdminPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  getAllowedEmailsState: () => string[];
  addAllowedEmail: (email: string) => { success: boolean; error?: string };
  removeAllowedEmail: (email: string) => { success: boolean; error?: string };
  setAllowedEmailsState: (emails: string[]) => void;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const isSuperAdmin = !!user?.isSuperAdmin;
  const mustChangePassword = isSuperAdmin ? (user?.user_metadata?.must_change_password ?? false) : false;

  // Check server-side session on mount
  useEffect(() => {
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'session' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setUser(data.user as ExtendedUser);
          const mockSession: Session = {
            access_token: 'server-session',
            refresh_token: 'server-session',
            expires_in: 3600,
            token_type: 'bearer',
            user: data.user,
          } as Session;
          setSession(mockSession);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async (_mockEmail?: string) => {
    setAuthError(null);
    // Google SSO not yet implemented for direct PostgreSQL
    setAuthError('Google SSO is not available. Use Super Admin login.');
  }, []);

  const signInWithSuperAdmin = useCallback(async (username: string, password: string) => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || 'Invalid credentials';
        setAuthError(err);
        return { success: false, error: err };
      }
      setUser(data.user as ExtendedUser);
      const mockSession: Session = {
        access_token: 'server-session',
        refresh_token: 'server-session',
        expires_in: 3600,
        token_type: 'bearer',
        user: data.user,
      } as Session;
      setSession(mockSession);
      return { success: true, mustChangePassword: data.mustChangePassword };
    } catch {
      const err = 'Login failed';
      setAuthError(err);
      return { success: false, error: err };
    }
  }, []);

  const changeSuperAdminPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!isSuperAdmin) return { success: false, error: 'Not Super Admin' };
    const state = getSuperAdminState();
    const ok = await verifyPassword(currentPassword, state.passwordHash);
    if (!ok) return { success: false, error: 'Current password incorrect' };
    if (!newPassword || newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters' };
    const newHash = await hashPassword(newPassword);
    setSuperAdminState({ passwordHash: newHash, mustChangePassword: false });
    if (user) {
      const updatedUser: ExtendedUser = {
        ...user,
        user_metadata: { ...(user.user_metadata ?? {}), must_change_password: false },
        isSuperAdmin: true,
      };
      setUser(updatedUser);
      setSession(prev => prev ? ({ ...prev, user: updatedUser } as Session) : prev);
    }
    return { success: true };
  }, [isSuperAdmin, user]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(() => {});
    setSession(null);
    setUser(null);
  }, []);

  const getAllowedEmailsState = useCallback(() => getAllowedEmails(), []);
  const addAllowedEmail = useCallback(
    (email: string) => {
      if (!isSuperAdmin) return { success: false, error: 'Only Super Admin can manage allow-list' };
      const res = addEmailStore(email);
      if (!res.added) return { success: false, error: res.error };
      return { success: true };
    },
    [isSuperAdmin]
  );
  const removeAllowedEmail = useCallback(
    (email: string) => {
      if (!isSuperAdmin) return { success: false, error: 'Only Super Admin can manage allow-list' };
      const res = removeEmailStore(email);
      if (!res.removed) return { success: false, error: 'Email not found' };
      return { success: true };
    },
    [isSuperAdmin]
  );
  const setAllowedEmailsState = useCallback(
    (emails: string[]) => {
      if (!isSuperAdmin) return;
      setAllowedEmails(emails);
    },
    [isSuperAdmin]
  );

  return (
    <AuthContext.Provider
      value={{
        session, user, loading, authError, clearAuthError,
        signInWithGoogle, signInWithSuperAdmin, changeSuperAdminPassword, signOut,
        getAllowedEmailsState, addAllowedEmail, removeAllowedEmail, setAllowedEmailsState,
        isSuperAdmin, mustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
