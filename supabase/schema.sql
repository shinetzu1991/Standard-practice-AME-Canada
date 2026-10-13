-- Run once in Supabase → SQL Editor → New query → Run.
-- Both tables are written and read only by the server (secret key), so row
-- level security is on with no policies: nobody can read them from the browser.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  provider text,
  country text,
  region text,
  city text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  login_count integer not null default 0
);

create table if not exists public.logins (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  email text,
  provider text,
  country text,
  region text,
  city text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists logins_created_at_idx on public.logins (created_at desc);

alter table public.profiles enable row level security;
alter table public.logins enable row level security;
