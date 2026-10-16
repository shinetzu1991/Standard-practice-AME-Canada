-- Run once in Supabase → SQL Editor (after content.sql).
-- Keeps the admin's reply to each question report.
alter table public.question_reports add column if not exists reply text;
alter table public.question_reports add column if not exists replied_at timestamptz;
