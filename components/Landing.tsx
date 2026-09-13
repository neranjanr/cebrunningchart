'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';

export function Landing() {
  const { signInWithSuperAdmin, authError, clearAuthError } = useAuth();
  const [username, setUsername] = useState('Neranjan');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [showTOTP, setShowTOTP] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingSuper, setLoadingSuper] = useState(false);

  const handleSuperAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearAuthError();
    setLoadingSuper(true);
    try {
      const res = await signInWithSuperAdmin(username, password, showTOTP ? totp : undefined);
      if (!res.success) {
        if (res.totpRequired) {
          setShowTOTP(true);
          setFormError(res.error ?? 'Enter 6-digit code from Google Authenticator');
          return;
        }
        setFormError(res.error ?? 'Invalid credentials');
        return;
      }
      if (res.mustChangePassword) { window.location.href = '/change-password'; return; }
      if (res.mustEnrollTOTP) { window.location.href = '/change-password?enroll=totp'; return; }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoadingSuper(false);
    }
  };

  const displayError = formError || authError;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col justify-center gap-4 bg-slate-surface text-on-primary rounded-xl p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📖</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">FleetLedger</h1>
              <p className="text-xs tracking-widest uppercase text-on-primary-container">Audit Running Chart</p>
            </div>
          </div>
          <p className="text-sm text-on-primary-container leading-relaxed">
            Secure access to the digital running chart Book. Sign in as Super Admin with password + Google Authenticator (TOTP). Single-operator system.
          </p>
          <div className="text-[11px] font-mono text-on-primary-container/70">
            <p>Super Admin: Neranjan / password + 6-digit TOTP</p>
            <p>First login: change bootstrap password, enroll TOTP, save 64-char Recovery Code.</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {displayError && (
            <div data-testid="landing-error" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium" role="alert">
              {displayError}
            </div>
          )}

          <div className="bg-paper-sheet border border-rule-line rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold tracking-tight text-on-surface mb-1">Super Admin Login</h2>
            <p className="text-xs text-on-surface-variant mb-4">Password + Google Authenticator 6-digit code</p>
            <form onSubmit={handleSuperAdminSubmit} className="space-y-3">
              <div>
                <label htmlFor="sa-username" className="block text-xs font-semibold text-on-surface-variant mb-1">Username</label>
                <input id="sa-username" aria-label="Super Admin Username" data-testid="super-admin-username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-telemetry-cyan/30" />
              </div>
              <div>
                <label htmlFor="sa-password" className="block text-xs font-semibold text-on-surface-variant mb-1">Password</label>
                <input id="sa-password" aria-label="Super Admin Password" data-testid="super-admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="SupAd@2000" className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-telemetry-cyan/30" required />
              </div>
              {showTOTP && (
                <div>
                  <label htmlFor="sa-totp" className="block text-xs font-semibold text-on-surface-variant mb-1">Authenticator Code</label>
                  <input id="sa-totp" aria-label="TOTP Code" data-testid="totp-code-input" inputMode="numeric" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm tracking-widest font-mono" required />
                  <p className="text-[11px] text-on-surface-variant mt-1">Open Google Authenticator on your device and enter the 6-digit code for RunningChart.</p>
                </div>
              )}
              <button type="submit" data-testid="super-admin-login-button" disabled={loadingSuper} className="w-full py-2.5 bg-slate-surface text-on-primary rounded-lg text-sm font-semibold hover:bg-primary disabled:opacity-50">
                {loadingSuper ? 'Signing in…' : showTOTP ? 'Verify & Sign in' : 'Sign in'}
              </button>
              <p className="text-[10px] text-on-surface-variant">First login will require password change and TOTP enrollment at /change-password</p>
            </form>
            <div className="mt-4 text-center">
              <Link href="/recovery" data-testid="recovery-link" className="text-xs text-telemetry-cyan hover:underline">Lost access to Authenticator? Use Recovery Code</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
