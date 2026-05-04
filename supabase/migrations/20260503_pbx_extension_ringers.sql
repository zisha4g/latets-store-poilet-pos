-- Step 1: Extension model + ringers
-- Adds routing/voicemail config columns to pbx_extensions, and a new
-- pbx_extension_ringers table that holds the list of endpoints (SIP /
-- PSTN / WebRTC) that should ring when an extension is dialed.

----------------------------------------------------------------------
-- 1. pbx_extensions: new columns
----------------------------------------------------------------------
alter table public.pbx_extensions
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists ring_strategy text not null default 'simultaneous',
  add column if not exists ring_timeout_secs integer not null default 25,
  add column if not exists no_answer_action text not null default 'voicemail',
  add column if not exists forward_external_number text,
  add column if not exists voicemail_enabled boolean not null default true;

-- Constrain enum-ish values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pbx_extensions_ring_strategy_check'
  ) then
    execute $cmd$
      alter table public.pbx_extensions
        add constraint pbx_extensions_ring_strategy_check
        check (ring_strategy in ('simultaneous','sequential'))
    $cmd$;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pbx_extensions_no_answer_action_check'
  ) then
    execute $cmd$
      alter table public.pbx_extensions
        add constraint pbx_extensions_no_answer_action_check
        check (no_answer_action in ('voicemail','forward_external','hangup'))
    $cmd$;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pbx_extensions_ring_timeout_check'
  ) then
    execute $cmd$
      alter table public.pbx_extensions
        add constraint pbx_extensions_ring_timeout_check
        check (ring_timeout_secs between 5 and 120)
    $cmd$;
  end if;
end $$;

create index if not exists pbx_extensions_assigned_user_id_idx
  on public.pbx_extensions(assigned_user_id);

----------------------------------------------------------------------
-- 2. pbx_extension_ringers: list of endpoints per extension
----------------------------------------------------------------------
create table if not exists public.pbx_extension_ringers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- tenant owner
  extension_id uuid not null references public.pbx_extensions(id) on delete cascade,
  kind text not null check (kind in ('sip','pstn','webrtc')),
  target text not null,         -- sip URI, E.164 number, or webrtc:<user_id>
  label text,                   -- optional human label (e.g. "Desk phone")
  priority integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pbx_extension_ringers_extension_idx
  on public.pbx_extension_ringers(extension_id);
create index if not exists pbx_extension_ringers_user_idx
  on public.pbx_extension_ringers(user_id);

-- Trigger to keep updated_at fresh.
create or replace function public.pbx_extension_ringers_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists pbx_extension_ringers_touch on public.pbx_extension_ringers;
create trigger pbx_extension_ringers_touch
  before update on public.pbx_extension_ringers
  for each row execute function public.pbx_extension_ringers_touch_updated_at();

----------------------------------------------------------------------
-- 3. RLS: tenant-scoped
----------------------------------------------------------------------
alter table public.pbx_extension_ringers enable row level security;

drop policy if exists "ringers_select_own" on public.pbx_extension_ringers;
create policy "ringers_select_own" on public.pbx_extension_ringers
  for select using (auth.uid() = user_id);

drop policy if exists "ringers_insert_own" on public.pbx_extension_ringers;
create policy "ringers_insert_own" on public.pbx_extension_ringers
  for insert with check (auth.uid() = user_id);

drop policy if exists "ringers_update_own" on public.pbx_extension_ringers;
create policy "ringers_update_own" on public.pbx_extension_ringers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ringers_delete_own" on public.pbx_extension_ringers;
create policy "ringers_delete_own" on public.pbx_extension_ringers
  for delete using (auth.uid() = user_id);

----------------------------------------------------------------------
-- 4. Reload PostgREST schema cache
----------------------------------------------------------------------
notify pgrst, 'reload schema';
