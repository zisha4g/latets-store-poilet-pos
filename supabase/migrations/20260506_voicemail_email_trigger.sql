-- Voicemail email notification trigger.
-- On INSERT into pbx_voicemails, call the pbx-voicemail-notify edge function
-- via pg_net. The function was deployed with --no-verify-jwt so no auth
-- header is required, but we send the anon key anyway to satisfy any
-- Supabase-internal gateway checks.

create extension if not exists pg_net with schema extensions;

create or replace function public.pbx_voicemail_notify_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url text := 'https://tjjueyedvxhkvinxsszy.supabase.co/functions/v1/pbx-voicemail-notify';
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'pbx_voicemails',
    'schema', 'public',
    'record', to_jsonb(new),
    'old_record', null
  );

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type','application/json'),
    body := payload,
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  -- Never block the insert if the email send fails.
  raise warning 'pbx_voicemail_notify_trigger error: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists pbx_voicemail_notify_after_insert on public.pbx_voicemails;
create trigger pbx_voicemail_notify_after_insert
  after insert on public.pbx_voicemails
  for each row
  execute function public.pbx_voicemail_notify_trigger();
