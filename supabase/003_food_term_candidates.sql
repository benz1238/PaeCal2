-- PaeCal2 migration: food term learning candidates
-- Run this in Supabase SQL Editor.

create table if not exists public.food_term_candidates (
  term text primary key,
  normalized_term text not null,
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

create index if not exists food_term_candidates_status_hits_idx
  on public.food_term_candidates (status, hit_count desc, last_seen_at desc);

create index if not exists food_term_candidates_last_seen_idx
  on public.food_term_candidates (last_seen_at desc);
