-- Multi-tenant voice routing & call logging infrastructure.
--
-- 1. pbx_phone_numbers: maps a SignalWire DID to a tenant + inbound flow.
-- 2. Adds columns to pbx_call_logs needed by SignalWire status callbacks.

create table if not exists public.pbx_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- E.164, e.g. +18452740451
  number text not null,
  label text,
  -- Provider call SID/UUID (SignalWire phone number ID) for our side.
  provider_id text,
  -- What handles inbound calls: 'ivr' | 'extension' | 'voicemail' | 'forward'
  inbound_mode text not null default 'ivr',
  -- Optional FK targets depending on mode (ivr_menu_id, extension_id, etc.)
  ivr_menu_id uuid,
  extension_id uuid,
  forward_to text,
  -- Outbound caller ID to use when this DID is the chosen "outbound number"
  is_default_outbound_cli boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pbx_phone_numbers_number_unique
  on public.pbx_phone_numbers (number);
create index if not exists pbx_phone_numbers_user_idx
  on public.pbx_phone_numbers (user_id);

drop trigger if exists pbx_phone_numbers_updated_at on public.pbx_phone_numbers;
create trigger pbx_phone_numbers_updated_at
  before update on public.pbx_phone_numbers
  for each row execute function public.update_timestamp_column();

alter table public.pbx_phone_numbers enable row level security;

drop policy if exists "pbx_phone_numbers owner select" on public.pbx_phone_numbers;
create policy "pbx_phone_numbers owner select" on public.pbx_phone_numbers
  for select using (auth.uid() = user_id);
drop policy if exists "pbx_phone_numbers owner insert" on public.pbx_phone_numbers;
create policy "pbx_phone_numbers owner insert" on public.pbx_phone_numbers
  for insert with check (auth.uid() = user_id);
drop policy if exists "pbx_phone_numbers owner update" on public.pbx_phone_numbers;
create policy "pbx_phone_numbers owner update" on public.pbx_phone_numbers
  for update using (auth.uid() = user_id);
drop policy if exists "pbx_phone_numbers owner delete" on public.pbx_phone_numbers;
create policy "pbx_phone_numbers owner delete" on public.pbx_phone_numbers
  for delete using (auth.uid() = user_id);

-- Extra columns on pbx_call_logs to capture SignalWire status callbacks.
alter table public.pbx_call_logs
  add column if not exists signalwire_call_sid text,
  add column if not exists from_number text,
  add column if not exists to_number text,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists recording_url text,
  add column if not exists device_id uuid,
  add column if not exists extension_id uuid;

create unique index if not exists pbx_call_logs_signalwire_sid_unique
  on public.pbx_call_logs (signalwire_call_sid)
  where signalwire_call_sid is not null;

-- The partial index above can't be used as an ON CONFLICT inference target
-- by PostgREST/supabase-js. Add a plain unique constraint as well so we can
-- upsert by signalwire_call_sid. Multiple NULLs are still allowed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pbx_call_logs_signalwire_call_sid_key'
  ) then
    alter table public.pbx_call_logs
      add constraint pbx_call_logs_signalwire_call_sid_key
      unique (signalwire_call_sid);
  end if;
end$$;
