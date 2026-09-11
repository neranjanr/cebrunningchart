'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase/client';
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

const SUPER_ADMIN_SESSION_KEY = 'fleetledger_super_admin_session';

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
  // Allow-list (Super Admin only)
  getAllowedEmailsState: () => string[];
  addAllowedEmail: (email: string) => { success: boolean; error?: string };
  removeAllowedEmail: (email: string) => { success: boolean; error?: string };
  setAllowedEmailsState: (emails: string[]) => void;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readSuperAdminSession(): ExtendedUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SUPER_ADMIN_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id) return parsed as ExtendedUser;
    return null;
  } catch {
    return null;
  }
}

function writeSuperAdminSession(user: ExtendedUser | null) {
  if (typeof window === 'undefined') return;
  if (user) window.localStorage.setItem(SUPER_ADMIN_SESSION_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Derived flags
  const isSuperAdmin = !!user?.isSuperAdmin;
  const mustChangePassword = isSuperAdmin ? (user?.user_metadata?.must_change_password ?? false) : false;

  useEffect(() => {
    // Check for super admin session first (local)
    const sa = readSuperAdminSession();
    if (sa) {
      // Re-validate against current store mustChangePassword flag
      const state = getSuperAdminState();
      const merged: ExtendedUser = {
        ...sa,
        isSuperAdmin: true,
        user_metadata: { ...(sa.user_metadata ?? {}), must_change_password: state.mustChangePassword },
      };
      setUser(merged);
      // Create mock session for consistency
      const mockSession: Session = {
        access_token: 'super-admin-token',
        refresh_token: 'super-admin-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: merged,
      } as Session;
      setSession(mockSession);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      // Gate Google SSO via allow-list
      if (session?.user?.email) {
        const check = canGoogleUserSignIn(session.user.email);
        if (!check.allowed) {
          // Reject non-allowed: sign out immediately and stay on Landing
          supabase!.auth.signOut().then(() => {
            setAuthError(check.reason ?? 'Not authorized — contact admin');
            setSession(null);
            setUser(null);
            setLoading(false);
          });
          return;
        }
      }
      setSession(session);
      setUser((session?.user as ExtendedUser) ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        const check = canGoogleUserSignIn(session.user.email);
        if (!check.allowed) {
          supabase!.auth.signOut().then(() => {
            setAuthError(check.reason ?? 'Not authorized — contact admin');
            setSession(null);
            setUser(null);
            setLoading(false);
          });
          return;
        }
      }
      setSession(session);
      setUser((session?.user as ExtendedUser) ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async (mockEmail?: string) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      // Mock sign-in for development without Supabase keys - gated by allow-list
      const email = mockEmail ?? 'driver@fleetledger.local';
      const check = canGoogleUserSignIn(email);
      if (!check.allowed) {
        setAuthError(check.reason ?? 'Not authorized — contact admin');
        // Do not set user/session; stay on Landing
        throw new Error(check.reason ?? 'Not authorized — contact admin');
      }
      const mockUser: ExtendedUser = {
        id: 'mock-user-123',
        app_metadata: {},
        user_metadata: { full_name: 'Test Driver', email },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email,
      } as ExtendedUser;
      const mockSession: Session = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockUser,
      };
      setSession(mockSession);
      setUser(mockUser);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      console.error('Error signing in with Google:', error.message);
      throw error;
    }
  }, []);

  const signInWithSuperAdmin = useCallback(async (username: string, password: string) => {
    setAuthError(null);
    if (!isSuperAdminUsername(username)) {
      const err = 'Invalid Super Admin credentials';
      setAuthError(err);
      return { success: false, error: err };
    }
    const state = getSuperAdminState();
    const ok = await verifyPassword(password, state.passwordHash);
    if (!ok) {
      const err = 'Invalid Super Admin credentials';
      setAuthError(err);
      return { success: false, error: err };
    }
    const superUser: ExtendedUser = {
      id: 'super-admin-1',
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {
        username: 'Neranjan',
        role: 'super_admin',
        must_change_password: state.mustChangePassword,
        full_name: 'Neranjan (Super Admin)',
        email: 'super-admin@fleetledger.local',
      },
      created_at: new Date().toISOString(),
      email: 'super-admin@fleetledger.local',
      isSuperAdmin: true,
    } as ExtendedUser;
    const mockSession: Session = {
      access_token: 'super-admin-token',
      refresh_token: 'super-admin-refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: superUser,
    } as Session;
    setUser(superUser);
    setSession(mockSession);
    writeSuperAdminSession(superUser);
    return { success: true, mustChangePassword: state.mustChangePassword };
  }, []);

  const changeSuperAdminPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!isSuperAdmin) return { success: false, error: 'Not Super Admin' };
    const state = getSuperAdminState();
    const ok = await verifyPassword(currentPassword, state.passwordHash);
    if (!ok) return { success: false, error: 'Current password incorrect' };
    if (!newPassword || newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters' };
    const newHash = await hashPassword(newPassword);
    const updated = { passwordHash: newHash, mustChangePassword: false };
    setSuperAdminState(updated);
    // Update session user_metadata
    if (user) {
      const updatedUser: ExtendedUser = {
        ...user,
        user_metadata: { ...(user.user_metadata ?? {}), must_change_password: false },
        isSuperAdmin: true,
      };
      setUser(updatedUser);
      writeSuperAdminSession(updatedUser);
      setSession((prev) => (prev ? ({ ...prev, user: updatedUser } as Session) : prev));
    }
    return { success: true };
  }, [isSuperAdmin, user]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    // Clear super admin session if exists
    if (readSuperAdminSession()) {
      writeSuperAdminSession(null);
      setSession(null);
      setUser(null);
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      setUser(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
      throw error;
    }
    // local signOut already handled via onAuthStateChange
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
        session,
        user,
        loading,
        authError,
        clearAuthError,
        signInWithGoogle,
        signInWithSuperAdmin,
        changeSuperAdminPassword,
        signOut,
        getAllowedEmailsState,
        addAllowedEmail,
        removeAllowedEmail,
        setAllowedEmailsState,
        isSuperAdmin,
        mustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
