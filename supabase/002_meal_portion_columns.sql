-- PaeCal2 migration: meal portion metadata
-- Run this in Supabase SQL Editor.

alter table public.meals
  add column if not exists portion_level text not null default 'normal',
  add column if not exists portion_label text not null default 'พอดี',
  add column if not exists portion_note text,
  add column if not exists confidence text not null default 'medium';

create index if not exists meals_user_source_created_idx
  on public.meals (user_id, source, created_at desc);
