'use client';

import React, { useEffect, useState } from 'react';
import { BookLedgerView } from '@/components/ledger/BookLedgerView';
import { getPages } from '@/lib/pageStore';
import { getTrips } from '@/lib/tripStore';
import { getVehicleProfile } from '@/lib/vehicleStore';
import type { BookPage, Trip, Vehicle } from '@/types';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ContinuityAlertBanner } from '@/components/ContinuityAlertBanner';

export default function LedgerPage() {
  const [pages, setPages] = useState<BookPage[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([getPages(), getTrips(), getVehicleProfile()]).then(([p, t, v]) => {
      if (!mounted) return;
      setPages(p);
      setTrips(t);
      setVehicle(v);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant">Loading ledger...</div>;
  }

  return (
    <ProtectedRoute>
      <div className="flex flex-col gap-4">
        <ContinuityAlertBanner pages={pages} trips={trips} />
        <BookLedgerView pages={pages} trips={trips} vehicle={vehicle} />
      </div>
    </ProtectedRoute>
  );
}
