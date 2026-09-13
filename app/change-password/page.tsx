'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

function ChangePasswordInner() {
  const { isSuperAdmin, changeSuperAdminPassword, setupTOTP, verifyTOTPSetup, confirmRecoverySaved } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollParam = searchParams.get('enroll');
  const [step, setStep] = useState<'password' | 'totp' | 'recovery'>(enrollParam === 'totp' ? 'totp' : 'password');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // totp enrollment
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ackSaved, setAckSaved] = useState(false);

  useEffect(() => { if (enrollParam === 'totp') setStep('totp'); }, [enrollParam]);

  if (!isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 bg-paper-sheet border border-rule-line rounded-lg text-center">
        <p className="text-sm text-on-surface-variant">Only Super Admin may change the bootstrap password.</p>
        <button onClick={() => router.push('/')} className="mt-4 px-4 py-2 bg-slate-surface text-on-primary rounded-lg text-sm">Back to Dashboard</button>
      </div>
    );
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError('New passwords do not match'); return; }
    if (next.length < 6) { setError('New password must be at least 6 characters'); return; }
    const res = await changeSuperAdminPassword(current, next);
    if (!res.success) { setError(res.error ?? 'Failed to change password'); return; }
    setSuccess(true);
    // move to TOTP enrollment
    setTimeout(async () => {
      try {
        const data = await setupTOTP();
        setSecret(data.secret); setUri(data.uri); setQrDataUrl(data.qrDataUrl);
        setStep('totp');
      } catch (err) { setError(err instanceof Error ? err.message : 'Failed to setup TOTP'); }
    }, 600);
  };

  const handleTOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await verifyTOTPSetup(totpCode);
    if (!res.success) { setError(res.error ?? 'Invalid code'); return; }
    setRecoveryCode(res.recoveryCode ?? null);
    setStep('recovery');
  };

  const handleConfirmSaved = async () => {
    if (!ackSaved) { setError('Confirm you have saved the Recovery Code'); return; }
    setError(null);
    const res = await confirmRecoverySaved();
    if (!res.success) { setError(res.error ?? 'Failed'); return; }
    router.push('/');
  };

  const handleDownload = () => {
    if (!recoveryCode) return;
    const blob = new Blob([`RunningChart Recovery Code\nKeep offline — single use, bypasses password+TOTP\n\n${recoveryCode}\n\nGenerated: ${new Date().toISOString()}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `runningchart-recovery-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
  };

  if (step === 'recovery' && recoveryCode) {
    return (
      <div className="max-w-lg mx-auto mt-8 p-8 bg-paper-sheet border border-rule-line rounded-xl shadow-sm">
        <h1 className="text-lg font-bold tracking-tight text-on-surface mb-1">Save Recovery Code</h1>
        <p className="text-xs text-on-surface-variant mb-4">This 64-char code is shown <span className="font-bold">once</span>. It bypasses password+ TOTP if your authenticator is lost. Store offline — it will be hashed and burned after use.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <p className="font-mono text-sm break-all tracking-wide text-amber-900" data-testid="recovery-code-display">{recoveryCode}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { navigator.clipboard.writeText(recoveryCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-xs px-3 py-1.5 bg-white border border-amber-200 rounded-lg font-semibold">{copied ? 'Copied!' : 'Copy'}</button>
            <button onClick={handleDownload} className="text-xs px-3 py-1.5 bg-slate-surface text-on-primary rounded-lg font-semibold">Download .txt</button>
          </div>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={ackSaved} onChange={e => setAckSaved(e.target.checked)} data-testid="ack-saved-checkbox" className="mt-1" />
          <span className="text-xs text-on-surface-variant">I have saved this Recovery Code offline and understand it is single-use. I will need it to recover if TOTP is lost.</span>
        </label>
        <button onClick={handleConfirmSaved} data-testid="confirm-saved-button" disabled={!ackSaved} className="w-full py-2.5 bg-slate-surface text-on-primary rounded-lg text-sm font-semibold disabled:opacity-50">Confirm & Go to Dashboard</button>
      </div>
    );
  }

  if (step === 'totp') {
    return (
      <div className="max-w-md mx-auto mt-8 p-8 bg-paper-sheet border border-rule-line rounded-xl shadow-sm">
        <h1 className="text-lg font-bold tracking-tight text-on-surface mb-1">Enroll Google Authenticator</h1>
        <p className="text-xs text-on-surface-variant mb-4">Scan the QR with Google Authenticator, then enter the 6-digit code to verify. Required on every login.</p>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">Password changed — now enroll TOTP</div>}
        <div className="flex flex-col items-center gap-3 mb-6">
          {qrDataUrl ? <img src={qrDataUrl} alt="TOTP QR" data-testid="totp-qr" className="w-48 h-48 border border-rule-line rounded-lg" /> : <div className="w-48 h-48 border border-dashed border-rule-line rounded-lg flex items-center justify-center text-xs text-on-surface-variant">Generating QR…</div>}
          {uri && <p className="text-[10px] font-mono break-all text-on-surface-variant px-2">{uri}</p>}
          {secret && <p className="text-[11px] font-mono text-on-surface-variant">Manual key: <span className="font-bold">{secret}</span></p>}
        </div>
        <form onSubmit={handleTOTPVerify} className="space-y-3">
          <label htmlFor="totp-code" className="block text-xs font-semibold text-on-surface-variant">6-digit code</label>
          <input id="totp-code" data-testid="totp-verify-input" inputMode="numeric" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm tracking-widest font-mono" required />
          <button type="submit" data-testid="totp-verify-button" className="w-full py-2.5 bg-slate-surface text-on-primary rounded-lg text-sm font-semibold">Verify & Generate Recovery Code</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-paper-sheet border border-rule-line rounded-xl shadow-sm">
      <h1 className="text-lg font-bold tracking-tight text-on-surface mb-1">Change Super Admin Password</h1>
      <p className="text-xs text-on-surface-variant mb-6">You are signed in as Super Admin (Neranjan). The bootstrap password <span className="font-mono font-bold">SupAd@2000</span> must be changed on first login.</p>
      {error && <div data-testid="change-password-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div data-testid="change-password-success" className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">Password changed — proceeding to TOTP setup…</div>}
      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div><label htmlFor="current-password" className="block text-xs font-semibold text-on-surface-variant mb-1">Current Password</label><input id="current-password" data-testid="current-password-input" type="password" value={current} onChange={e => setCurrent(e.target.value)} className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm" required /></div>
        <div><label htmlFor="new-password" className="block text-xs font-semibold text-on-surface-variant mb-1">New Password</label><input id="new-password" data-testid="new-password-input" type="password" value={next} onChange={e => setNext(e.target.value)} className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm" required /></div>
        <div><label htmlFor="confirm-password" className="block text-xs font-semibold text-on-surface-variant mb-1">Confirm New Password</label><input id="confirm-password" data-testid="confirm-password-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full px-3 py-2 border border-rule-line rounded-lg text-sm" required /></div>
        <button type="submit" data-testid="change-password-submit" className="w-full py-2.5 bg-slate-surface text-on-primary rounded-lg text-sm font-semibold">Change Password</button>
      </form>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <ChangePasswordInner />
    </Suspense>
  );
}
