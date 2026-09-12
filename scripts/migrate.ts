import { query } from '../lib/db';

async function migrate() {
  console.log('Running migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      brand text NOT NULL DEFAULT 'Toyota',
      model text NOT NULL DEFAULT 'Hilux',
      vehicle_type text NOT NULL DEFAULT 'Double Cab',
      fuel_type text NOT NULL DEFAULT 'Diesel',
      tank_capacity numeric(10,1) NOT NULL DEFAULT 80.0,
      current_odometer numeric(10,1) NOT NULL DEFAULT 0.0,
      current_fuel_level numeric(10,1) NOT NULL DEFAULT 10.0,
      registration_no text DEFAULT 'CAB-1234',
      created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
      updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS book_pages (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
      page_number integer NOT NULL,
      month text NOT NULL,
      start_km numeric(10,1) NOT NULL DEFAULT 0.0,
      end_km numeric(10,1) NOT NULL DEFAULT 0.0,
      start_fuel_balance numeric(10,1) NOT NULL DEFAULT 0.0,
      end_fuel_balance numeric(10,1) NOT NULL DEFAULT 0.0,
      created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
      UNIQUE(vehicle_id, page_number)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trips (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      page_id uuid REFERENCES book_pages(id) ON DELETE CASCADE NOT NULL,
      vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
      date date NOT NULL,
      day_index integer NOT NULL CHECK (day_index BETWEEN 1 AND 4),
      trip_index integer NOT NULL CHECK (trip_index BETWEEN 1 AND 13),
      start_time text NOT NULL,
      end_time text NOT NULL,
      start_km numeric(10,1) NOT NULL,
      end_km numeric(10,1) NOT NULL,
      trip_distance numeric(10,1) NOT NULL,
      trip_type text NOT NULL CHECK (trip_type IN ('Official', 'Private')) DEFAULT 'Official',
      places_visited text NOT NULL,
      fuel_pumped_amount numeric(10,1) DEFAULT 0.0,
      fuel_order_no text DEFAULT '',
      created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      token text UNIQUE NOT NULL,
      user_role text NOT NULL DEFAULT 'super_admin',
      created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
      expires_at timestamp with time zone NOT NULL
    );
  `);

  // Seed default vehicle if none exists
  const { rows } = await query('SELECT COUNT(*)::int as count FROM vehicles');
  if (rows[0].count === 0) {
    await query(`
      INSERT INTO vehicles (brand, model, vehicle_type, fuel_type, tank_capacity, current_odometer, current_fuel_level, registration_no)
      VALUES ('Toyota', 'Hilux', 'Double Cab', 'Diesel', 80.0, 50000.0, 10.0, 'CAB-1234')
    `);
    console.log('Seeded default vehicle');
  }

  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
