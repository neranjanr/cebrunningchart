import Link from 'next/link';
import QuickTripForm from '@/components/QuickTripForm';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function NewTripPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-full py-6">
        <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between px-2">
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">New Trip Entry</h1>
            <p className="text-sm text-on-surface-variant">Quick capture with reciprocal odometer & time logic</p>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-telemetry-cyan hover:underline flex items-center gap-1"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <QuickTripForm />
      </div>
    </ProtectedRoute>
  );
}
