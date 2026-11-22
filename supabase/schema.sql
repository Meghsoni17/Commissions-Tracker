-- CommTrack cloud schema.
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste this whole file → Run.
-- It is safe to run again: tables, policies and grants are created only if missing / replaced.
--
-- Every table has a user_id that references auth.users, Row Level Security is on, and each policy
-- only lets a signed-in user see and change rows where user_id = auth.uid(). Row ids are the app's
-- own text ids, unique per user, so the primary key is (user_id, id).

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

-- Roles you earn commission in (Closer, Setter, ...).
create table if not exists public.roles (
  user_id         uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id              text        not null,
  name            text        not null default '',
  color_slot      integer     not null default 1,
  archived        boolean     not null default false,
  created_at      timestamptz,
  commission_rate numeric,             -- percentage, 10 = 10%
  updated_at      timestamptz not null default now(),
  primary key (user_id, id)
);

-- Weekly commission entries (booked / showed / closed / commission per role per week).
create table if not exists public.commission_entries (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id            text        not null,
  role_id       text        not null default '',
  week_start    date,                  -- Monday of the week
  booked        numeric     not null default 0,
  showed        numeric     not null default 0,
  closed        numeric     not null default 0,
  commission    numeric     not null default 0,
  notes         text,
  day_breakdown jsonb,                 -- [{ "date": "yyyy-MM-dd", "amount": 123.45 }, ...]
  deal_id       text,                  -- set on entries generated from a deal
  updated_at    timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists commission_entries_user_week_idx on public.commission_entries (user_id, week_start);

-- Deals, with their payment schedule.
create table if not exists public.deals (
  user_id                uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                     text        not null,
  role_id                text        not null default '',
  client_name            text        not null default '',
  sale_date              date,
  total_contract_value   numeric     not null default 0,
  cash_collected_on_call numeric     not null default 0,
  payment_structure      text        not null default 'Paid in Full',
  installments           jsonb       not null default '[]'::jsonb,
  notes                  text,
  created_at             date,
  linked_entry_id        text,
  commission_rate        numeric,
  updated_at             timestamptz not null default now(),
  primary key (user_id, id)
);

-- Monthly commission goals, one per month.
create table if not exists public.monthly_goals (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  month_key  text        not null,     -- yyyy-MM
  amount     numeric     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

-- Work-related tax deductions.
create table if not exists public.deductions (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id             text        not null,
  financial_year text        not null default '',   -- "2026" = FY2026-27
  description    text        not null default '',
  category       text        not null default 'Other',
  amount         numeric     not null default 0,
  purchase_date  date,
  vendor         text        not null default '',
  payment_method text        not null default 'Other',
  notes          text,
  created_at     date,
  updated_at     timestamptz not null default now(),
  primary key (user_id, id)
);

-- Superannuation contributions.
create table if not exists public.super_contributions (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null,
  contribution_date date,
  amount            numeric     not null default 0,
  notes             text,
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

-- Items removed by Reset By Date Range, restorable for 30 days. `id` is the removed item's id.
create table if not exists public.recently_deleted (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  item_type  text        not null check (item_type in ('commission', 'deduction', 'super')),
  deleted_at timestamptz not null default now(),
  item       jsonb       not null,
  deal_ref   jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Booked / showed / closed numbers cleared by Reset Sales Data, restorable for 30 days.
create table if not exists public.recently_deleted_sales (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  entry_id   text        not null,
  role_id    text        not null default '',
  week_start date,
  booked     numeric     not null default 0,
  showed     numeric     not null default 0,
  closed     numeric     not null default 0,
  deleted_at timestamptz not null default now(),
  deal_id    text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- One row per user: PIN lock hash and app bookkeeping.
create table if not exists public.user_settings (
  user_id              uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  pin_hash             text,        -- PBKDF2-SHA256 of the 6-digit PIN, base64
  pin_salt             text,        -- base64
  pin_iterations       integer,
  commission_fixes     jsonb,       -- last commission-rate recalculation, kept for review
  cleared_deal_entries jsonb not null default '[]'::jsonb,
  cleared_deal_sales   jsonb not null default '[]'::jsonb,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Keep updated_at current
-- ---------------------------------------------------------------------------------------------

create or replace function public.commtrack_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles', 'commission_entries', 'deals', 'monthly_goals', 'deductions',
    'super_contributions', 'recently_deleted', 'recently_deleted_sales', 'user_settings'
  ]
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format(
      'create trigger touch_updated_at before update on public.%I
         for each row execute function public.commtrack_touch_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security: each user can only read and write their own rows
-- ---------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles', 'commission_entries', 'deals', 'monthly_goals', 'deductions',
    'super_contributions', 'recently_deleted', 'recently_deleted_sales', 'user_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "Users can read own rows" on public.%I', t);
    execute format(
      'create policy "Users can read own rows" on public.%I
         for select to authenticated using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "Users can insert own rows" on public.%I', t);
    execute format(
      'create policy "Users can insert own rows" on public.%I
         for insert to authenticated with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "Users can update own rows" on public.%I', t);
    execute format(
      'create policy "Users can update own rows" on public.%I
         for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "Users can delete own rows" on public.%I', t);
    execute format(
      'create policy "Users can delete own rows" on public.%I
         for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants: this project does not auto-expose new tables to the API, so grant explicitly.
-- Only the authenticated role gets access; anon (signed-out) gets nothing.
-- ---------------------------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.roles                  to authenticated;
grant select, insert, update, delete on table public.commission_entries     to authenticated;
grant select, insert, update, delete on table public.deals                  to authenticated;
grant select, insert, update, delete on table public.monthly_goals          to authenticated;
grant select, insert, update, delete on table public.deductions             to authenticated;
grant select, insert, update, delete on table public.super_contributions    to authenticated;
grant select, insert, update, delete on table public.recently_deleted       to authenticated;
grant select, insert, update, delete on table public.recently_deleted_sales to authenticated;
grant select, insert, update, delete on table public.user_settings          to authenticated;

-- Make the API pick up the new tables straight away.
notify pgrst, 'reload schema';
