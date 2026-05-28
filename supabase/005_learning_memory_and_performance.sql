-- PaeCal2 migration: learning/memory tables + performance indexes
-- Run this in Supabase SQL Editor after 001/002, safe to re-run.

create table if not exists public.food_term_candidates (
  term text primary key,
  normalized_term text not null,
  raw_term text,
  canonical_key text,
  matched_aliases jsonb not null default '[]'::jsonb,
  item_count integer not null default 1,
  hit_count integer not null default 1,
  last_menu_name text,
  last_kcal numeric default 0,
  last_carb numeric default 0,
  last_protein numeric default 0,
  last_fat numeric default 0,
  last_sugar numeric default 0,
  last_confidence text default 'medium',
  last_source text default 'openai',
  status text not null default 'pending',
  examples jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.food_term_candidates
  add column if not exists raw_term text,
  add column if not exists canonical_key text,
  add column if not exists matched_aliases jsonb not null default '[]'::jsonb,
  add column if not exists item_count integer not null default 1;

create table if not exists public.memory_snapshots (
  user_id text not null references public.users(line_user_id),
  memory_date date not null,
  meal_count integer not null default 0,
  total_kcal numeric not null default 0,
  total_carb numeric not null default 0,
  total_protein numeric not null default 0,
  total_fat numeric not null default 0,
  total_sugar numeric not null default 0,
  summary jsonb not null default '{}'::jsonb,
  meals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, memory_date)
);

-- Fast user/profile lookup.
create index if not exists users_line_user_id_idx
  on public.users (line_user_id);

-- Fast session lookup.
create index if not exists user_sessions_user_id_idx
  on public.user_sessions (user_id);

-- Fast daily summary + last meal lookup.
create index if not exists meals_user_date_created_idx
  on public.meals (user_id, meal_date, created_at desc);

-- Fast food term learning review.
create index if not exists food_term_candidates_status_hits_idx
  on public.food_term_candidates (status, hit_count desc, last_seen_at desc);

create index if not exists food_term_candidates_last_seen_idx
  on public.food_term_candidates (last_seen_at desc);

create index if not exists food_term_candidates_canonical_hits_idx
  on public.food_term_candidates (canonical_key, hit_count desc, last_seen_at desc);

-- Fast memory lookup.
create index if not exists memory_snapshots_user_date_idx
  on public.memory_snapshots (user_id, memory_date desc);

-- Quick sanity checks after running:
-- select * from public.food_term_candidates limit 1;
-- select * from public.memory_snapshots limit 1;
-- select indexname from pg_indexes where schemaname = 'public' order by tablename, indexname;
