create table if not exists public.sola_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ifields_key text not null,
  sola_xkey text not null,
  env text not null default 'x1',
  created_at timestamptz not null default now()
);

alter table public.sola_accounts enable row level security;

create table if not exists public.sola_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid,
  x_token text not null,
  card_type text,
  masked_card text,
  exp text,
  created_at timestamptz not null default now()
);

alter table public.sola_tokens enable row level security;

create policy "sola_tokens_select_own" on public.sola_tokens
  for select using (auth.uid() = user_id);
