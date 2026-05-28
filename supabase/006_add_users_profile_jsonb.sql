alter table public.users
  add column if not exists profile jsonb not null default '{}'::jsonb;
