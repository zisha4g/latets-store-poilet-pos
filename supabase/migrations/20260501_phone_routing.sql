-- Multi-number support per user + per-number call routing tree.
-- Each store_channels row gets a `routing` jsonb tree describing what to do
-- when a call arrives. The voice-webhook resolves this tree before
-- dispatching to a voice-ordering flow. Existing rows are backfilled to
-- the safe default ("run primary flow") so behavior is unchanged for them.

-- 1. New columns.
alter table public.store_channels
  add column if not exists label text,
  add column if not exists routing jsonb not null default '{"type":"flow","flowId":null}'::jsonb,
  add column if not exists configured boolean not null default false;

-- 2. Backfill existing rows: keep them working without owner action.
update public.store_channels
  set label = coalesce(nullif(trim(label), ''), 'Main line')
  where label is null or trim(label) = '';

update public.store_channels
  set configured = true
  where configured = false;

-- 3. Drop the user_id unique constraint to allow multiple numbers per user.
do $$
declare
  c record;
  cols text[];
begin
  for c in
    select conname, conkey from pg_constraint
    where conrelid = 'public.store_channels'::regclass
      and contype = 'u'
  loop
    select array_agg(attname order by attnum)
      into cols
      from pg_attribute
      where attrelid = 'public.store_channels'::regclass
        and attnum = any(c.conkey);
    if cols = array['user_id'] then
      execute format('alter table public.store_channels drop constraint %I', c.conname);
    end if;
  end loop;
end;
$$;

-- 4. Helpful indexes for listing.
create index if not exists idx_store_channels_user_active
  on public.store_channels(user_id, is_active);

-- 5. Voicemail recordings table (recordings stored at provider URLs;
-- inbox UI is a follow-up).
create table if not exists public.voicemails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid references public.store_channels(id) on delete set null,
  from_number text,
  recording_url text,
  duration_seconds integer,
  transcription text,
  created_at timestamptz not null default now()
);

alter table public.voicemails enable row level security;

create index if not exists idx_voicemails_user_id on public.voicemails(user_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'voicemails' and policyname = 'voicemails_select_own'
  ) then
    execute 'create policy "voicemails_select_own" on public.voicemails for select using (auth.uid() = user_id)';
  end if;
end;
$$;
