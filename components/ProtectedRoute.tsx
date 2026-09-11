'use client';

import React from 'react';
import { useAuth } from '@/lib/authContext';
import { GoogleLoginButton } from './GoogleLoginButton';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-paper-ledger animate-pulse">Loading running chart session...</div>
      </div>
    );
  }

  // If Supabase is not configured, or user is signed in, allow access
  if (!isSupabaseConfigured || user) {
    return <>{children}</>;
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-slate-surface rounded-lg shadow-xl text-center border border-slate-700">
      <span className="text-4xl mb-4 block">🔒</span>
      <h2 className="text-lg font-bold text-on-primary mb-2">Authentication Required</h2>
      <p className="text-xs text-on-primary-container mb-6">
        Please sign in with your Google account to access your fleet running chart records and operational logs securely.
      </p>
      <GoogleLoginButton />
    </div>
  );
}
