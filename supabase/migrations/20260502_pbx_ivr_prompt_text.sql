-- IVR menus: support typed prompt text + voice + speed in addition to a
-- pre-uploaded audio file (prompt_audio_id, already on the table).
-- Apply via Supabase SQL editor.

alter table public.pbx_ivr_menus
  add column if not exists prompt_text text,
  add column if not exists prompt_voice text,
  add column if not exists prompt_rate text;

-- Optional sanity check on values we accept from the UI. Loose enough to allow
-- raw provider voice ids (e.g. "Polly.Joanna") later without another migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pbx_ivr_menus_prompt_rate_check'
  ) then
    execute 'alter table public.pbx_ivr_menus
             add constraint pbx_ivr_menus_prompt_rate_check
             check (prompt_rate is null or prompt_rate in (''x-slow'',''slow'',''medium'',''fast'',''x-fast''))';
  end if;
end;
$$;
