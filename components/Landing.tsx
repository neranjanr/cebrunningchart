'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';

export function Landing() {
  const { signInWithSuperAdmin, signInWithGoogle, authError, clearAuthError } = useAuth();
  const [username, setUsername] = useState('Neranjan');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingSuper, setLoadingSuper] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleSuperAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearAuthError();
    setLoadingSuper(true);
    try {
      const res = await signInWithSuperAdmin(username, password);
      if (!res.success) {
        setFormError(res.error ?? 'Invalid credentials');
      } else if (res.mustChangePassword) {
        // ProtectedRoute will redirect to /change-password; but also handle here
        window.location.href = '/change-password';
      }
      // On success, authContext will set user and trigger rerender to protected content
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoadingSuper(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError(null);
    clearAuthError();
    setLoadingGoogle(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setFormError(msg);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const displayError = formError || authError;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Brand / Intro */}
        <div className="flex flex-col justify-center gap-4 bg-slate-surface text-on-primary rounded-xl p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📖</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">FleetLedger</h1>
              <p className="text-xs tracking-widest uppercase text-on-primary-container">Audit Running Chart</p>
            </div>
          </div>
          <p className="text-sm text-on-primary-container leading-relaxed">
            Secure access to the digital running chart Book. Sign in as Super Admin or via an allow-listed Gmail to view Dashboard, Ledger and Trips.
          </p>
          <div className="text-[11px] font-mono text-on-primary-container/70">
            <p>Super Admin bootstrap: Neranjan / SupAd@2000 (hashed, forced change on first login)</p>
            <p>Allowed Gmail users are gated by the Super Admin allow-list.</p>
          </div>
        </div>

        {/* Auth Cards */}
        <div className="flex flex-col gap-6">
          {displayError && (
            <div
              data-testid="landing-error"
              className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium"
              role="alert"
            >
              {displayError}
            </div>
          )}

          {/* Super Admin Login */}
          <div className="bg-paper-sheet border border-rule-line rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold tracking-tight text-on-surface mb-1">Super Admin Login</h2>
            <p className="text-xs text-on-surface-variant mb-4">Username <span className="font-mono font-bold">Neranjan</span> + hashed password</p>
            <form onSubmit={handleSuperAdminSubmit} className="space-y-3">
              <div>
                <label htmlFor="sa-username" className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Username
                </label>
                <input
                  id="sa-username"
                  aria-label="Super Admin Username"
                  data-testid="super-admin-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-telemetry-cyan/30"
                />
              </div>
              <div>
                <label htmlFor="sa-password" className="block text-xs font-semibold text-on-surface-variant mb-1">
                  Password
                </label>
                <input
                  id="sa-password"
                  aria-label="Super Admin Password"
                  data-testid="super-admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="SupAd@2000"
                  className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-telemetry-cyan/30"
                  required
                />
              </div>
              <button
                type="submit"
                data-testid="super-admin-login-button"
                disabled={loadingSuper}
                className="w-full py-2.5 bg-slate-surface text-on-primary rounded-lg text-sm font-semibold hover:bg-primary disabled:opacity-50"
              >
                {loadingSuper ? 'Signing in…' : 'Sign in as Super Admin'}
              </button>
              <p className="text-[10px] text-on-surface-variant">First login will require password change at /change-password</p>
            </form>
          </div>

          {/* Google SSO */}
          <div className="bg-paper-sheet border border-rule-line rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold tracking-tight text-on-surface mb-1">Google SSO (Allow-list)</h2>
            <p className="text-xs text-on-surface-variant mb-4">Only Gmail addresses on the allow-list may sign in.</p>
            <button
              onClick={handleGoogleSignIn}
              data-testid="google-sso-button"
              disabled={loadingGoogle}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-lg text-sm border border-gray-300 shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.87z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.15v3.15C3.12 21.32 7.22 24 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.15C.42 8.08 0 9.74 0 12s.42 3.92 1.15 5.39l4.12-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.22 0 3.12 2.68 1.15 6.61l4.12 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
              </svg>
              {loadingGoogle ? 'Signing in…' : 'Sign in with Google'}
            </button>
            <p className="text-[11px] text-on-surface-variant mt-2">
              Non-allowed Gmail will see “Not authorized — contact admin” and stay on Landing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
