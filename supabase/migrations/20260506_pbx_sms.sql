-- pbx_sms_messages — inbound + outbound SMS/MMS for the PBX.
--
-- A "thread" is the conversation between one of our DIDs (channel.inbound_phone_e164)
-- and one external number. We compute thread_key = the external (counterpart) number
-- in E.164 form so inbound and outbound rows in the same conversation share a key.

create table if not exists public.pbx_sms_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid references public.store_channels(id) on delete set null,
  customer_id uuid,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text not null,
  to_number text not null,
  thread_key text not null,                  -- E.164 of the external counterpart
  body text,
  media_urls text[] default '{}',
  num_media int default 0,
  status text default 'queued',              -- queued | sent | delivered | failed | received
  error_code text,
  signalwire_sid text,
  is_read boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_pbx_sms_user_thread
  on public.pbx_sms_messages(user_id, thread_key, created_at desc);
create index if not exists idx_pbx_sms_user_created
  on public.pbx_sms_messages(user_id, created_at desc);
create index if not exists idx_pbx_sms_sid
  on public.pbx_sms_messages(signalwire_sid);

alter table public.pbx_sms_messages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pbx_sms_messages' and policyname='pbx_sms_select_own') then
    execute 'create policy "pbx_sms_select_own" on public.pbx_sms_messages for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pbx_sms_messages' and policyname='pbx_sms_update_own') then
    execute 'create policy "pbx_sms_update_own" on public.pbx_sms_messages for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pbx_sms_messages' and policyname='pbx_sms_delete_own') then
    execute 'create policy "pbx_sms_delete_own" on public.pbx_sms_messages for delete using (auth.uid() = user_id)';
  end if;
  -- Inserts go through edge functions using the service role; no client insert policy.
end$$;

-- Realtime: include in supabase_realtime publication so the UI can subscribe.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pbx_sms_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.pbx_sms_messages';
  end if;
end$$;
