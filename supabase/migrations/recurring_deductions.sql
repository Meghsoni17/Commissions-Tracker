-- CommTrack migration: recurring deductions and work-use percentage.
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste this whole file → Run.
-- It is safe to run again. It only adds things: no existing rows are changed or deleted.
--
--   1. public.recurring_deductions: expenses paid on a schedule (phone plan, internet, software, car lease).
--   2. public.deductions.work_use_percent: the share of a one-off deduction used for work.
--      Existing deductions get no value (null), which the app reads as 100%, so their totals don't change.

-- ---------------------------------------------------------------------------------------------
-- 1. Recurring deductions
-- ---------------------------------------------------------------------------------------------

create table if not exists public.recurring_deductions (
  user_id          uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id               text        not null,
  name             text        not null default '',
  amount           numeric     not null default 0 check (amount >= 0),          -- per payment
  frequency        text        not null default 'Monthly'
                               check (frequency in ('Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Yearly')),
  start_date       date        not null,                                        -- first payment
  end_date         date,                                                        -- null = ongoing
  category         text        not null default 'Other',
  work_use_percent numeric     not null default 100 check (work_use_percent between 0 and 100),
  notes            text,
  created_at       date,
  updated_at       timestamptz not null default now(),
  primary key (user_id, id),
  check (end_date is null or end_date >= start_date)
);

-- Keep updated_at current (function created by schema.sql).
drop trigger if exists touch_updated_at on public.recurring_deductions;
create trigger touch_updated_at before update on public.recurring_deductions
  for each row execute function public.commtrack_touch_updated_at();

-- Row Level Security: each user can only read and write their own rows.
alter table public.recurring_deductions enable row level security;

drop policy if exists "Users can read own rows" on public.recurring_deductions;
create policy "Users can read own rows" on public.recurring_deductions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own rows" on public.recurring_deductions;
create policy "Users can insert own rows" on public.recurring_deductions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own rows" on public.recurring_deductions;
create policy "Users can update own rows" on public.recurring_deductions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own rows" on public.recurring_deductions;
create policy "Users can delete own rows" on public.recurring_deductions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- This project does not auto-expose new tables to the API, so grant explicitly (authenticated only).
grant select, insert, update, delete on table public.recurring_deductions to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Work-use percentage on one-off deductions
-- ---------------------------------------------------------------------------------------------

-- Nullable with no default, so existing rows are left exactly as they are (null = 100% work use).
alter table public.deductions add column if not exists work_use_percent numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'deductions_work_use_percent_check' and conrelid = 'public.deductions'::regclass
  ) then
    alter table public.deductions
      add constraint deductions_work_use_percent_check
      check (work_use_percent is null or work_use_percent between 0 and 100);
  end if;
end;
$$;

-- Make the API pick up the new table and column straight away.
notify pgrst, 'reload schema';
