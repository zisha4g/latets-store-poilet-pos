-- Step 6: WebRTC softphone endpoints.
-- Each logged-in user gets a SIP credential they can register from the browser
-- via JsSIP over WebSocket. The browser then becomes a SIP endpoint and can
-- receive/answer calls dialed at sip:<sip_username>@<sip_domain>.
--
-- The SignalWire side: admin creates a SIP credential per user in the
-- SignalWire dashboard (or via API), copies the username/password into this
-- table. Same pattern as pbx_devices but for the browser.

create table if not exists public.pbx_webrtc_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  sip_username text not null,
  sip_password text not null,
  sip_domain text not null,         -- e.g. "4gonwheels-d3049efc26a8.sip.signalwire.com"
  ws_url text not null,             -- e.g. "wss://4gonwheels-d3049efc26a8.sip.signalwire.com:443/wss"
  display_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pbx_webrtc_endpoints_user_idx
  on public.pbx_webrtc_endpoints(user_id);
create index if not exists pbx_webrtc_endpoints_username_idx
  on public.pbx_webrtc_endpoints(sip_username);

alter table public.pbx_webrtc_endpoints enable row level security;

-- Owners can read their own endpoint (frontend pulls it via the edge function
-- which runs as service role, but defense-in-depth: also gate via RLS).
drop policy if exists "webrtc_endpoints_select_own" on public.pbx_webrtc_endpoints;
create policy "webrtc_endpoints_select_own" on public.pbx_webrtc_endpoints
  for select using (auth.uid() = user_id);

-- Inserts/updates only via service role (admin / edge function).
drop policy if exists "webrtc_endpoints_write_service" on public.pbx_webrtc_endpoints;
create policy "webrtc_endpoints_write_service" on public.pbx_webrtc_endpoints
  for all using (false) with check (false);

create or replace function public.pbx_webrtc_endpoints_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists pbx_webrtc_endpoints_touch on public.pbx_webrtc_endpoints;
create trigger pbx_webrtc_endpoints_touch
  before update on public.pbx_webrtc_endpoints
  for each row execute function public.pbx_webrtc_endpoints_touch_updated_at();

notify pgrst, 'reload schema';
