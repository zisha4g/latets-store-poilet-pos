-- Voice ordering platform controls + tenant IVR configuration

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'platform_admins' and policyname = 'platform_admins_select_own'
  ) then
    execute 'create policy "platform_admins_select_own" on public.platform_admins for select using (auth.uid() = user_id)';
  end if;
end;
$$;

create table if not exists public.store_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null default 'signalwire',
  provider_account_id text,
  inbound_phone_e164 text unique,
  webhook_secret text,
  voice_ordering_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_channels enable row level security;

create index if not exists idx_store_channels_user_id on public.store_channels(user_id);
create index if not exists idx_store_channels_phone on public.store_channels(inbound_phone_e164);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_channels' and policyname = 'store_channels_select_own'
  ) then
    execute 'create policy "store_channels_select_own" on public.store_channels for select using (auth.uid() = user_id)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_channels' and policyname = 'store_channels_insert_own'
  ) then
    execute 'create policy "store_channels_insert_own" on public.store_channels for insert with check (auth.uid() = user_id)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_channels' and policyname = 'store_channels_update_own'
  ) then
    execute 'create policy "store_channels_update_own" on public.store_channels for update using (auth.uid() = user_id)';
  end if;
end;
$$;

create table if not exists public.ivr_flow_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  provider text not null default 'signalwire',
  flow jsonb not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ivr_flow_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ivr_flow_templates' and policyname = 'ivr_flow_templates_select_all_authenticated'
  ) then
    execute 'create policy "ivr_flow_templates_select_all_authenticated" on public.ivr_flow_templates for select to authenticated using (true)';
  end if;
end;
$$;

create table if not exists public.ivr_flow_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  template_id uuid references public.ivr_flow_templates(id) on delete set null,
  flow jsonb not null,
  version integer not null default 1,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ivr_flow_configs enable row level security;

create index if not exists idx_ivr_flow_configs_user_id on public.ivr_flow_configs(user_id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ivr_flow_configs' and policyname = 'ivr_flow_configs_select_own'
  ) then
    execute 'create policy "ivr_flow_configs_select_own" on public.ivr_flow_configs for select using (auth.uid() = user_id)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ivr_flow_configs' and policyname = 'ivr_flow_configs_insert_own'
  ) then
    execute 'create policy "ivr_flow_configs_insert_own" on public.ivr_flow_configs for insert with check (auth.uid() = user_id)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ivr_flow_configs' and policyname = 'ivr_flow_configs_update_own'
  ) then
    execute 'create policy "ivr_flow_configs_update_own" on public.ivr_flow_configs for update using (auth.uid() = user_id)';
  end if;
end;
$$;

create table if not exists public.phone_call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_channel_id uuid not null references public.store_channels(id) on delete cascade,
  provider text not null default 'signalwire',
  provider_call_id text not null,
  call_status text,
  state text not null default 'welcome',
  last_digits text,
  cart jsonb not null default '[]'::jsonb,
  address_recording_url text,
  address_transcript text,
  payment_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_call_id)
);

alter table public.phone_call_sessions enable row level security;

create index if not exists idx_phone_call_sessions_user_id on public.phone_call_sessions(user_id);
create index if not exists idx_phone_call_sessions_channel_id on public.phone_call_sessions(store_channel_id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'phone_call_sessions' and policyname = 'phone_call_sessions_select_own'
  ) then
    execute 'create policy "phone_call_sessions_select_own" on public.phone_call_sessions for select using (auth.uid() = user_id)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'phone_call_sessions' and policyname = 'phone_call_sessions_insert_own'
  ) then
    execute 'create policy "phone_call_sessions_insert_own" on public.phone_call_sessions for insert with check (auth.uid() = user_id)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'phone_call_sessions' and policyname = 'phone_call_sessions_update_own'
  ) then
    execute 'create policy "phone_call_sessions_update_own" on public.phone_call_sessions for update using (auth.uid() = user_id)';
  end if;
end;
$$;

create table if not exists public.voice_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.voice_admin_audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'voice_admin_audit_logs' and policyname = 'voice_admin_audit_logs_select_own'
  ) then
    execute 'create policy "voice_admin_audit_logs_select_own" on public.voice_admin_audit_logs for select using (auth.uid() = admin_user_id)';
  end if;
end;
$$;

create or replace function public.update_timestamp_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists store_channels_updated_at on public.store_channels;
create trigger store_channels_updated_at
  before update on public.store_channels
  for each row
  execute function public.update_timestamp_column();

drop trigger if exists ivr_flow_templates_updated_at on public.ivr_flow_templates;
create trigger ivr_flow_templates_updated_at
  before update on public.ivr_flow_templates
  for each row
  execute function public.update_timestamp_column();

drop trigger if exists ivr_flow_configs_updated_at on public.ivr_flow_configs;
create trigger ivr_flow_configs_updated_at
  before update on public.ivr_flow_configs
  for each row
  execute function public.update_timestamp_column();

drop trigger if exists phone_call_sessions_updated_at on public.phone_call_sessions;
create trigger phone_call_sessions_updated_at
  before update on public.phone_call_sessions
  for each row
  execute function public.update_timestamp_column();

insert into public.ivr_flow_templates (name, provider, flow, is_active)
values (
  'default-voice-v1',
  'signalwire',
  jsonb_build_object(
    'version', 1,
    'prompts', jsonb_build_object(
      'welcome', 'Welcome to StorePilot ordering. Press 1 to enter SKU, press 9 to repeat.',
      'sku', 'Enter product SKU, then pound.',
      'qty', 'Enter quantity, then pound.',
      'address', 'Please say your delivery address after the tone.'
    ),
    'states', jsonb_build_array('welcome', 'sku', 'qty', 'address', 'checkout')
  ),
  true
)
on conflict (name) do nothing;
