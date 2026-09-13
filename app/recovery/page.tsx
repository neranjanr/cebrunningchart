'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export default function RecoveryPage() {
  const { recoverWithCode } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await recoverWithCode(code);
      if (!res.success) { setError(res.error ?? 'Recovery failed'); return; }
      router.push('/change-password');
    } catch (err) { setError(err instanceof Error ? err.message : 'Recovery failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-paper-sheet border border-rule-line rounded-xl shadow-sm">
      <h1 className="text-lg font-bold tracking-tight text-on-surface mb-1">Recovery — Bypass Password + TOTP</h1>
      <p className="text-xs text-on-surface-variant mb-6">Enter your single-use 64-char Recovery Code (shown once at enrollment). This bypasses both password and TOTP and creates a 10-min recovery session that forces password reset + TOTP re-enrollment. The code will be burned after use.</p>
      {error && <div data-testid="recovery-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recovery-code" className="block text-xs font-semibold text-on-surface-variant mb-1">Recovery Code</label>
          <textarea id="recovery-code" data-testid="recovery-code-input" value={code} onChange={e => setCode(e.target.value)} placeholder="a1b2c3d4-e5f6..." className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm font-mono min-h-[90px]" required />
          <p className="text-[11px] text-on-surface-variant mt-1">Paste with or without dashes — spaces trimmed, case-insensitive.</p>
        </div>
        <button type="submit" data-testid="recovery-submit" disabled={loading} className="w-full py-2.5 bg-slate-surface text-on-primary rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? 'Verifying…' : 'Recover Access'}
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link href="/" className="text-xs text-telemetry-cyan hover:underline">← Back to Landing</Link>
      </div>
    </div>
  );
}
