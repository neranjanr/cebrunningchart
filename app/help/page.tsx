'use client';

import React from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const sections = [
  {
    id: 'book-opening',
    title: '1. Book Opening',
    content: `Book Opening seeds Page 1 with Opening KM (integer) and Opening Fuel (1 decimal, default 10 L). Enter it in Vehicle Settings when the Book starts (e.g., 2026-01-01 at 50,000 km). It is re-editable: when back-dated Pages are inserted before the earliest date, the Opening is re-applied to the new earliest Page and fuel balances are recalculated forward from the earliest Page. This keeps older histories correctly capitalized without mutating dates.`,
  },
  {
    id: 'reciprocals',
    title: '2. Reciprocal Calculations (Start+Distance=End)',
    content: `Odometer fields are Integer KM (no decimals, fuel retains 1 decimal). Distance = round(End − Start). Entering Start KM + Distance auto-derives End KM, and vice versa, both integer-rounded. Fuel remains at 1 decimal. This mirrors the paper book's integer odometer and prevents manual math errors.`,
  },
  {
    id: 'time-estimation',
    title: '3. Time Estimation (End − Distance/20, ceil 5 min)',
    content: `Estimated Start Time = End Time − (Distance / 20 km/h) ceiled to nearest 5 minutes: estimatedMinutes = ceil((distance/20)*60 /5)*5. Auto-fills only when Start Time is empty and End Time + Distance are present. The explicit “Auto” button recomputes even when Start Time is already filled, so edits to distance or End Time can be re-estimated. Manual override is always allowed and never auto-clobbered. End Time defaults to now (present time) on form load and remains overrideable to any HH:MM; Start Time may be left empty (null/“”) and the Trip still saves.`,
  },
  {
    id: 'import-template',
    title: '4. Import Template',
    content: `Template columns (single sheet): Date (YYYY-MM-DD) | Start KM (int) | End KM (int) | Distance (int auto) | Start Time (HH:MM optional) | End Time (HH:MM) | Type (Official/Private, defaults Official when blank) | Places Visited | Fuel Pumped (L) | Fuel Order No. Distance is auto-derived as round(end − start) if blank; a blank Type defaults to Official; a mismatch between provided Distance and end−start warns but trusts end−start. The file is downloadable as “Trip Import Template” from the Import UI.`,
  },
  {
    id: 'pagination-rules',
    title: '5. Pagination Rules (4 days / 13 trips / month rollover)',
    content: `Physical Book constraints are enforced strictly: maximum 4 distinct Dates per Page, maximum 13 Trips per Day Group, and a new calendar month always forces a new Page. Violations during manual entry or import pre-flight are reported as row-numbered errors and block any write until fixed. This keeps digital pagination identical to the paper book.`,
  },
  {
    id: 'fuel-formula',
    title: '6. Fuel Formula (Position + In-Tank + Drawn − Consumed = Closing)',
    content: `Per Day Group, Closing Balance = Position + In-Tank Fuel + Drawn − Consumed, rounded to 1 decimal. Position is the previous Day Group’s Closing Balance (Page N+1 Day 1 inherits Page N’s final Closing). In-Tank defaults to 0 per Day Group and is editable only on the first Trip of the day (distinguishing tank stock from pumped fuel). Drawn is summed Fuel Pumped per day with Fuel Order No. Consumed = Distance / Fuel Economy (economy inherits forward until overridden, fallback 10.5 km/L). Economy propagation and fuel arithmetic are tested via the ledger fuel engine seam.`,
  },
  {
    id: 'renumber',
    title: '7. Retroactive Renumber (Chronological 1..N)',
    content: `When a Trip or import date precedes the earliest Page, all Pages are sorted chronologically by date, renumbered 1..N sequentially, and page_number/page_id plus Trip.page_id are cascaded; dates are never mutated and pagination constraints (4/13/month) are preserved. Example: Book starts 2026-01-01 Page 1 at 50,000 km, later entry for 2025-01-01 becomes Pages 1–2 and the existing Page renumbers (no gap). Book Opening re-edit triggers recalculation of fuel balances forward from the earliest Page only. Continuity invariants hold after renumber: Page N End KM = Page N+1 Start KM and End Fuel = next Fuel Position (including In-Tank).`,
  },
  {
    id: 'auth-roles',
    title: '8. Auth Roles (Landing, Super Admin, Allow-list)',
    content: `Unauthenticated visitors see only Landing — a login page showing Super Admin password login (username Neranjan, hashed SupAd@2000, forced change on first login) and Google SSO. Google SSO is gated by the Super Admin’s Gmail allow-list managed at /settings/access (one or many addresses, CRUD only for Super Admin). Allowed Gmail users can SSO and see Dashboard, Ledger, Trips, and Help. Non-allowed Gmail is rejected with “Not authorized — contact admin” and stays on Landing. All ledger routes are behind an authenticated guard except Landing; Help at /help is authenticated and linked from the header (?) icon. Successful Trip save shows a “Trip Added” toast (~2s) then redirects to Dashboard; import success shows “N trips added” then redirects.`,
  },
];

export default function HelpPage() {
  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Help — Running Chart Guide</h1>
            <p className="text-sm text-on-surface-variant">
              How Book Opening, reciprocals, time estimation, import, pagination, fuel, renumber, and auth roles work.
            </p>
          </div>
          <Link href="/" className="text-sm font-medium text-telemetry-cyan hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-paper-sheet border border-rule-line rounded-xl shadow-sm divide-y divide-rule-line">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="p-6">
              <h2 className="text-sm font-bold tracking-tight text-on-surface mb-2">{s.title}</h2>
              <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">{s.content}</p>
            </section>
          ))}
        </div>

        <p className="mt-6 text-xs text-on-surface-variant">
          Domain glossary: Book, Page, Trip, Vehicle, Book Opening, Fuel Economy/Position/In-Tank/Drawn/Consumed/Closing Balance, Integer KM, Super Admin, Allowed Email, Landing, Help Page, Trip Import, Estimated Start Time, Global Search, Continuity Break, Transposed Side 2.
        </p>
      </div>
    </ProtectedRoute>
  );
}
