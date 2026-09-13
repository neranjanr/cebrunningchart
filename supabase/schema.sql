-- RunningChart Database Schema (Railway Postgres, single-operator)
-- No Supabase auth — auth via super_admin + TOTP + Recovery Code (ADR-0009/0010)
-- Sessions: 30d absolute + 7d idle sliding (CONTEXT.md Session)

-- Enable pgcrypto for gen_random_uuid
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core ledger (single-operator, no user_id FK)
-- ---------------------------------------------------------------------------
create table if not exists vehicles (
  id uuid default gen_random_uuid() primary key,
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
  month text not null,
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
  fuel_economy numeric(10,1) not null default 10.0,
  fuel_position numeric(10,1) not null default 0.0,
  drawn_amount numeric(10,1) not null default 0.0,
  fuel_order_no text default '',
  consumed_amount numeric(10,1) not null default 0.0,
  balance_amount numeric(10,1) not null default 0.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(page_id, day_index)
);

-- ---------------------------------------------------------------------------
-- Auth (ADR-0010): single Super Admin, TOTP (Google Authenticator), Recovery Code
-- ---------------------------------------------------------------------------
create table if not exists super_admin (
  id uuid default gen_random_uuid() primary key,
  username text not null unique default 'Neranjan',
  password_hash text not null,
  must_change_password boolean not null default true,
  totp_secret_encrypted text,
  totp_enabled boolean not null default false,
  totp_verified_at timestamp with time zone,
  recovery_code_hash text,
  recovery_code_created_at timestamp with time zone,
  recovery_code_used_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed bootstrap super admin if not exists (password SupAd@2000, bcrypt will replace SHA on first login)
insert into super_admin (username, password_hash, must_change_password, totp_enabled)
values ('Neranjan', '$2b$12$bootstrap_placeholder_will_be_rehashed_on_first_login', true, false)
on conflict (username) do nothing;

create table if not exists sessions (
  token text primary key,
  user_role text not null default 'super_admin',
  expires_at timestamp with time zone not null,
  last_active_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_sessions_expires_at on sessions(expires_at);
create index if not exists idx_sessions_last_active_at on sessions(last_active_at);

-- Drop legacy Supabase RLS if previously enabled
alter table if exists vehicles disable row level security;
alter table if exists book_pages disable row level security;
alter table if exists trips disable row level security;
alter table if exists fuel_logs disable row level security;
