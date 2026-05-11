-- Add a desk-phone SIP user alongside the existing browser SIP user so
-- click-to-call (and future ring-all-devices flows) can reach the actual
-- Yealink instead of just the browser softphone.

alter table public.pbx_webrtc_endpoints
  add column if not exists desk_sip_username text;

-- Best-effort default: if the row already has a "web-NNN" username, the
-- matching desk user is just "NNN" without the prefix.
update public.pbx_webrtc_endpoints
   set desk_sip_username = regexp_replace(sip_username, '^web-', '')
 where desk_sip_username is null
   and sip_username like 'web-%';
