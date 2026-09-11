-- FleetLedger / Running Chart Database Schema

create table if not exists vehicles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  brand text not null default 'Toyota',
  model text not null default 'Hilux',
  vehicle_type text not null default 'Cab / Double Cab',
  fuel_type text not null default 'Diesel',
  tank_capacity numeric(10,1) not null default 80.0,
  current_odometer numeric(10,1) not null default 0.0,
  current_fuel_level numeric(10,1) not null default 80.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists book_pages (
  id uuid default gen_random_uuid() primary key,
  vehicle_id uuid references vehicles(id) on delete cascade not null,
  page_number integer not null,
  month text not null, -- e.g. '2026-09'
  start_km numeric(10,1) not null default 0.0,
  end_km numeric(10,1) not null default 0.0,
  start_fuel_balance numeric(10,1) not null default 0.0,
  end_fuel_balance numeric(10,1) not null default 0.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(vehicle_id, page_number)
);

create table if not exists trips (
  id uuid default gen_random_uuid() primary key,
  page_id uuid references book_pages(id) on delete cascade not null,
  vehicle_id uuid references vehicles(id) on delete cascade not null,
  date date not null,
  day_index integer not null check (day_index between 1 and 4),
  trip_index integer not null check (trip_index between 1 and 13),
  start_time text not null,
  end_time text not null,
  start_km numeric(10,1) not null,
  end_km numeric(10,1) not null,
  trip_distance numeric(10,1) not null,
  trip_type text not null check (trip_type in ('Official', 'Private')) default 'Official',
  places_visited text not null,
  fuel_pumped_amount numeric(10,1) default 0.0,
  fuel_order_no text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists fuel_logs (
  id uuid default gen_random_uuid() primary key,
  page_id uuid references book_pages(id) on delete cascade not null,
  vehicle_id uuid references vehicles(id) on delete cascade not null,
  day_index integer not null check (day_index between 1 and 4),
  start_km_of_day numeric(10,1) not null default 0.0,
  end_km_of_day numeric(10,1) not null default 0.0,
  distance_travelled numeric(10,1) not null default 0.0,
  fuel_economy numeric(10,1) not null default 10.0, -- km/L
  fuel_position numeric(10,1) not null default 0.0,
  drawn_amount numeric(10,1) not null default 0.0,
  fuel_order_no text default '',
  consumed_amount numeric(10,1) not null default 0.0,
  balance_amount numeric(10,1) not null default 0.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(page_id, day_index)
);

-- Row Level Security (RLS) policies
alter table vehicles enable row level security;
alter table book_pages enable row level security;
alter table trips enable row level security;
alter table fuel_logs enable row level security;

create policy "Users can manage their own vehicles" on vehicles
  for all using (auth.uid() = user_id or user_id is null);

create policy "Users can manage pages for their vehicles" on book_pages
  for all using (
    exists (select 1 from vehicles where vehicles.id = book_pages.vehicle_id and (vehicles.user_id = auth.uid() or vehicles.user_id is null))
  );

create policy "Users can manage trips for their vehicles" on trips
  for all using (
    exists (select 1 from vehicles where vehicles.id = trips.vehicle_id and (vehicles.user_id = auth.uid() or vehicles.user_id is null))
  );

create policy "Users can manage fuel logs for their vehicles" on fuel_logs
  for all using (
    exists (select 1 from vehicles where vehicles.id = fuel_logs.vehicle_id and (vehicles.user_id = auth.uid() or vehicles.user_id is null))
  );
