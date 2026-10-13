-- Run once in Supabase → SQL Editor (after schema.sql).
-- Question reports, user-submitted questions and questions hidden by the admin.
-- Server-only like the other tables: RLS on, no policies.

create table if not exists public.question_reports (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  email text,
  category text not null,
  question text not null,
  reason text not null,          -- error | copyright | other
  message text,
  status text not null default 'open',   -- open | resolved
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.question_submissions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  email text,
  name text,
  category text not null,
  topic text,
  question text not null,
  options jsonb not null,        -- array of 4 strings
  correct integer not null,      -- index into options
  explanation text,
  source text,                   -- where the submitter says it comes from
  status text not null default 'pending',  -- pending | approved | rejected
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.hidden_questions (
  question text primary key,
  category text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists question_reports_status_idx on public.question_reports (status, created_at desc);
create index if not exists question_submissions_status_idx on public.question_submissions (status, created_at desc);

alter table public.question_reports enable row level security;
alter table public.question_submissions enable row level security;
alter table public.hidden_questions enable row level security;
