-- pbx_voicemails — what the PBX UI reads. Webhook used to write to public.voicemails
-- which is a different (older) table the UI doesn't show. Mirror the shape and switch
-- the webhook to insert here.

create table if not exists public.pbx_voicemails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid references public.store_channels(id) on delete set null,
  extension_id uuid references public.pbx_extensions(id) on delete set null,
  from_number text,
  recording_url text,
  duration_seconds int,
  is_new boolean default true,
  created_at timestamptz default now()
);

-- The table may already exist from an earlier migration with fewer columns.
-- Bring any missing columns in without disturbing existing data.
alter table public.pbx_voicemails add column if not exists channel_id uuid references public.store_channels(id) on delete set null;
alter table public.pbx_voicemails add column if not exists extension_id uuid references public.pbx_extensions(id) on delete set null;
alter table public.pbx_voicemails add column if not exists from_number text;
alter table public.pbx_voicemails add column if not exists recording_url text;
alter table public.pbx_voicemails add column if not exists duration_seconds int;
alter table public.pbx_voicemails add column if not exists is_new boolean default true;
alter table public.pbx_voicemails add column if not exists created_at timestamptz default now();

-- Older versions of this table had a NOT NULL `call_log_id` column. Our
-- webhook writes voicemails before any pbx_call_logs row exists, so make
-- those legacy columns nullable to avoid silently failing inserts.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pbx_voicemails' and column_name = 'call_log_id'
  ) then
    execute 'alter table public.pbx_voicemails alter column call_log_id drop not null';
  end if;
end$$;

create index if not exists idx_pbx_voicemails_user on public.pbx_voicemails(user_id, created_at desc);

alter table public.pbx_voicemails enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pbx_voicemails' and policyname = 'pbx_voicemails_select_own') then
    execute 'create policy "pbx_voicemails_select_own" on public.pbx_voicemails for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pbx_voicemails' and policyname = 'pbx_voicemails_update_own') then
    execute 'create policy "pbx_voicemails_update_own" on public.pbx_voicemails for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pbx_voicemails' and policyname = 'pbx_voicemails_delete_own') then
    execute 'create policy "pbx_voicemails_delete_own" on public.pbx_voicemails for delete using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pbx_voicemails' and policyname = 'pbx_voicemails_insert_own') then
    execute 'create policy "pbx_voicemails_insert_own" on public.pbx_voicemails for insert with check (auth.uid() = user_id)';
  end if;
end$$;

-- Backfill from old voicemails table if present.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'voicemails') then
    insert into public.pbx_voicemails (id, user_id, channel_id, from_number, recording_url, duration_seconds, created_at)
    select v.id, v.user_id, v.channel_id, v.from_number, v.recording_url, v.duration_seconds, v.created_at
    from public.voicemails v
    where not exists (select 1 from public.pbx_voicemails p where p.id = v.id);
  end if;
end$$;

notify pgrst, 'reload schema';
