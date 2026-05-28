-- PaeCal2 migration: canonical food term learning + memory snapshots
-- Run this in Supabase SQL Editor.

alter table public.food_term_candidates
  add column if not exists raw_term text,
  add column if not exists canonical_key text,
  add column if not exists matched_aliases jsonb not null default '[]'::jsonb,
  add column if not exists item_count integer not null default 1;

create index if not exists food_term_candidates_canonical_hits_idx
  on public.food_term_candidates (canonical_key, hit_count desc, last_seen_at desc);

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

create index if not exists memory_snapshots_user_date_idx
  on public.memory_snapshots (user_id, memory_date desc);
