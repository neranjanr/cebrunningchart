'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export default function ChangePasswordPage() {
  const { isSuperAdmin, changeSuperAdminPassword } = useAuth();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 bg-paper-sheet border border-rule-line rounded-lg text-center">
        <p className="text-sm text-on-surface-variant">Only Super Admin may change the bootstrap password.</p>
        <button onClick={() => router.push('/')} className="mt-4 px-4 py-2 bg-slate-surface text-on-primary rounded-lg text-sm">Back to Dashboard</button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('New passwords do not match');
      return;
    }
    if (next.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    const res = await changeSuperAdminPassword(current, next);
    if (!res.success) {
      setError(res.error ?? 'Failed to change password');
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push('/'), 1200);
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-paper-sheet border border-rule-line rounded-xl shadow-sm">
      <h1 className="text-lg font-bold tracking-tight text-on-surface mb-1">Change Super Admin Password</h1>
      <p className="text-xs text-on-surface-variant mb-6">
        You are signed in as Super Admin (Neranjan). The bootstrap password <span className="font-mono font-bold">SupAd@2000</span> must be changed on first login.
      </p>
      {error && (
        <div data-testid="change-password-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div data-testid="change-password-success" className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
          Password changed — redirecting to Dashboard…
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="current-password" className="block text-xs font-semibold text-on-surface-variant mb-1">Current Password</label>
          <input
            id="current-password"
            aria-label="Current Password"
            data-testid="current-password-input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm"
            required
          />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-xs font-semibold text-on-surface-variant mb-1">New Password</label>
          <input
            id="new-password"
            aria-label="New Password"
            data-testid="new-password-input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm"
            required
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-xs font-semibold text-on-surface-variant mb-1">Confirm New Password</label>
          <input
            id="confirm-password"
            aria-label="Confirm New Password"
            data-testid="confirm-password-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm"
            required
          />
        </div>
        <button
          type="submit"
          data-testid="change-password-submit"
          className="w-full py-2.5 bg-slate-surface text-on-primary rounded-lg text-sm font-semibold hover:bg-primary"
        >
          Change Password
        </button>
      </form>
    </div>
  );
}
