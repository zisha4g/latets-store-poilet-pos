-- pbx_ring_events — short-lived feed of incoming-call signal events the
-- frontend listens to via Supabase Realtime postgres_changes. Used for
-- screen-pop notifications when an extension rings on a logged-in user.
--
-- A single inbound call typically produces:
--   1) ring_start  — extension dial initiated (popup appears)
--   2) ring_stop   — call answered/timeout/declined (popup dismisses)
-- The frontend is in charge of dedup using call_session_id.

create table if not exists public.pbx_ring_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('ring_start','ring_stop','answered','declined','timeout')),
  call_session_id uuid,
  channel_id uuid references public.store_channels(id) on delete set null,
  extension_id uuid references public.pbx_extensions(id) on delete set null,
  extension_number text,
  from_number text,
  caller_name text,
  ring_timeout_secs int,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists pbx_ring_events_user_idx on public.pbx_ring_events(user_id, created_at desc);
create index if not exists pbx_ring_events_assigned_idx on public.pbx_ring_events(assigned_user_id, created_at desc);
create index if not exists pbx_ring_events_session_idx on public.pbx_ring_events(call_session_id);

alter table public.pbx_ring_events enable row level security;

drop policy if exists "ring_events_select_own" on public.pbx_ring_events;
create policy "ring_events_select_own" on public.pbx_ring_events
  for select using (auth.uid() = user_id or auth.uid() = assigned_user_id);

drop policy if exists "ring_events_insert_service" on public.pbx_ring_events;
-- Only service-role inserts (the voice webhook). No public/end-user inserts.
create policy "ring_events_insert_service" on public.pbx_ring_events
  for insert with check (false);

-- Add to the realtime publication so postgres_changes subscriptions fire.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pbx_ring_events'
    ) then
      execute 'alter publication supabase_realtime add table public.pbx_ring_events';
    end if;
  end if;
end$$;

-- Auto-cleanup: keep table small. Anything older than 24h is just audit junk.
-- (We rely on this rather than TTL since the popup only needs ~ring_timeout
-- seconds of liveness, but historic rows are useful for debugging for a day.)
create or replace function public.pbx_ring_events_prune_old()
returns void language plpgsql as $$
begin
  delete from public.pbx_ring_events where created_at < now() - interval '24 hours';
end$$;

notify pgrst, 'reload schema';
