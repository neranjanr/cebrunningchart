'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/authContext';

function AccessInner() {
  const { isSuperAdmin, getAllowedEmailsState, addAllowedEmail, removeAllowedEmail } = useAuth();
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setEmails(getAllowedEmailsState());
  }, [getAllowedEmailsState]);

  const refresh = () => setEmails(getAllowedEmailsState());

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!input.trim()) {
      setError('Enter an email');
      return;
    }
    const res = addAllowedEmail(input);
    if (!res.success) {
      setError(res.error ?? 'Failed to add');
      return;
    }
    setInfo(`Added ${input.trim().toLowerCase()}`);
    setInput('');
    refresh();
  };

  const handleRemove = (email: string) => {
    const res = removeAllowedEmail(email);
    if (!res.success) setError(res.error ?? 'Failed to remove');
    else {
      setInfo(`Removed ${email}`);
      refresh();
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-paper-sheet border border-rule-line rounded-xl text-center">
        <h1 className="text-lg font-bold text-on-surface mb-2">Access Settings</h1>
        <p className="text-sm text-on-surface-variant">Only Super Admin (Neranjan) can manage the Gmail allow-list.</p>
        <Link href="/" className="mt-4 inline-block px-4 py-2 bg-slate-surface text-on-primary rounded-lg text-sm">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">Access — Gmail Allow-list</h1>
          <p className="text-sm text-on-surface-variant">Only Super Admin can CRUD at /settings/access. Google SSO checks this list.</p>
        </div>
        <Link href="/" className="text-sm text-telemetry-cyan hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div data-testid="access-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {info && (
        <div data-testid="access-info" className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
          {info}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          aria-label="Gmail address"
          data-testid="allowlist-input"
          placeholder="user@gmail.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-3 py-2 border border-rule-line rounded-lg text-sm"
        />
        <button type="submit" data-testid="allowlist-add-button" className="px-4 py-2 bg-slate-surface text-on-primary rounded-lg text-sm font-semibold">
          Add
        </button>
      </form>

      <div className="bg-paper-sheet border border-rule-line rounded-xl shadow-sm">
        <div className="p-4 border-b border-rule-line flex items-center justify-between">
          <h2 className="text-sm font-bold text-on-surface">Allowed Emails ({emails.length})</h2>
          <span className="text-[11px] text-on-surface-variant">Case-insensitive, Gmail only</span>
        </div>
        {emails.length === 0 ? (
          <p className="p-6 text-sm text-on-surface-variant text-center">No allowed emails yet. Add one to enable Google SSO.</p>
        ) : (
          <ul className="divide-y divide-rule-line">
            {emails.map((email) => (
              <li key={email} data-testid={`allowlist-row-${email}`} className="flex items-center justify-between px-4 py-3">
                <span className="font-mono text-sm">{email}</span>
                <button
                  aria-label={`Remove ${email}`}
                  data-testid={`allowlist-remove-${email}`}
                  onClick={() => handleRemove(email)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-2 py-1"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AccessSettingsPage() {
  return (
    <ProtectedRoute>
      <AccessInner />
    </ProtectedRoute>
  );
}
