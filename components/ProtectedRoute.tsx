'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Landing } from './Landing';
import { usePathname, useRouter } from 'next/navigation';

const ALLOWED_RECOVERY_PATHS = ['/change-password', '/recovery'];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isSuperAdmin, mustChangePassword, isRecoverySession } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isSuperAdmin && mustChangePassword && !ALLOWED_RECOVERY_PATHS.includes(pathname)) {
      router.push('/change-password');
    }
    if (!loading && isRecoverySession && !ALLOWED_RECOVERY_PATHS.includes(pathname)) {
      router.push('/change-password');
    }
  }, [loading, isSuperAdmin, mustChangePassword, isRecoverySession, pathname, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-paper-ledger animate-pulse">Loading running chart session...</div>
      </div>
    );
  }

  if (isSuperAdmin && mustChangePassword && pathname !== '/change-password') {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 bg-amber-50 border border-amber-200 rounded-lg text-center" data-testid="forced-password-change-gate">
        <h2 className="text-sm font-bold text-amber-800 mb-2">Password Change Required</h2>
        <p className="text-xs text-amber-700 mb-4">Super Admin must change the bootstrap password (SupAd@2000) before accessing ledger data.</p>
        <button onClick={() => router.push('/change-password')} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold" data-testid="go-change-password">
          Go to Change Password
        </button>
      </div>
    );
  }

  if (isRecoverySession && !ALLOWED_RECOVERY_PATHS.includes(pathname)) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 bg-blue-50 border border-blue-200 rounded-lg text-center" data-testid="recovery-session-gate">
        <h2 className="text-sm font-bold text-blue-800 mb-2">Recovery Session</h2>
        <p className="text-xs text-blue-700 mb-4">Complete password reset and TOTP re-enrollment to continue.</p>
        <button onClick={() => router.push('/change-password')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">Continue Setup</button>
      </div>
    );
  }

  if (!user) return <Landing />;
  return <>{children}</>;
}
