# Issue 1: Supabase Schema & Vehicle Profile Management

**What to build:** Supabase database schema for vehicles, book pages, trips, and fuel logs, along with the Vehicle Profile settings UI to configure vehicle attributes (brand, model, type, fuel type, tank capacity, initial odometer, and fuel level) with local fallback support.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Supabase database tables created for vehicles, book pages, trips, and fuel logs (`supabase/schema.sql`).
- [x] TypeScript types defined for all core models (`types/index.ts`).
- [x] Supabase client and storage utility with local fallback (`lib/supabase/client.ts`, `lib/vehicleStore.ts`).
- [x] Vehicle Profile settings UI and page implemented (`components/VehicleProfileForm.tsx`, `app/settings/vehicle/page.tsx`).
