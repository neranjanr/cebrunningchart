'use client';

import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function AccessInner() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">Access — Removed</h1>
          <p className="text-sm text-on-surface-variant">Gmail allow-list and Google SSO have been removed. System is now single-operator (ADR-0010).</p>
        </div>
        <Link href="/" className="text-sm text-telemetry-cyan hover:underline">← Back to Dashboard</Link>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <p className="text-sm text-amber-800">This page is deprecated. Authentication is now Super Admin + TOTP (Google Authenticator) + single-use Recovery Code. See CONTEXT.md Auth & Access.</p>
      </div>
    </div>
  );
}

export default function AccessSettingsPage() {
  return <ProtectedRoute><AccessInner /></ProtectedRoute>;
}
