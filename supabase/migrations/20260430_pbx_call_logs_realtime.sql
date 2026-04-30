-- Add pbx_call_logs to the supabase_realtime publication so the PBX
-- dashboard receives INSERT/UPDATE events from voice-outbound and
-- voice-events without a manual refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pbx_call_logs'
  ) then
    execute 'alter publication supabase_realtime add table public.pbx_call_logs';
  end if;
end$$;
