'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Vehicle } from '@/types';
import { getVehicleProfile } from '@/lib/vehicleStore';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export default function Home() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    getVehicleProfile().then(setVehicle);
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-6">
      <main className="flex flex-col w-full max-w-4xl gap-8 py-12 px-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📖</span>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                FleetLedger — Running Chart
              </h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Digital counterpart to the physical fleet running chart logbook.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                isSupabaseConfigured
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
              }`}
            >
              {isSupabaseConfigured ? 'Supabase Connected' : 'Local Storage Mode'}
            </span>
            <Link
              href="/settings/vehicle"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-sm font-medium transition-colors"
            >
              Vehicle Settings
            </Link>
          </div>
        </div>

        {vehicle && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Vehicle</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {vehicle.brand} {vehicle.model}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{vehicle.vehicle_type} ({vehicle.fuel_type})</p>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Current Odometer</span>
              <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {vehicle.current_odometer.toLocaleString()} KM
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Continuity tracker</p>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Fuel Level & Tank</span>
              <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {vehicle.current_fuel_level}L / {vehicle.tank_capacity}L
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Tank capacity</p>
            </div>
          </div>
        )}

        <div className="p-6 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900 rounded-xl">
          <h2 className="text-base font-semibold text-cyan-900 dark:text-cyan-200 mb-2">Issue 1 Implemented Successfully</h2>
          <p className="text-sm text-cyan-700 dark:text-cyan-300 leading-relaxed">
            Supabase schema (`supabase/schema.sql`), TypeScript definitions (`types/index.ts`), Supabase client utility (`lib/supabase/client.ts`), and Vehicle Profile management state & UI (`components/VehicleProfileForm.tsx` & `/settings/vehicle`) are now in place.
          </p>
        </div>
      </main>
    </div>
  );
}
