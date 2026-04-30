alter table if exists public.ivr_flow_configs
  add column if not exists voice_settings jsonb not null default '{}'::jsonb;
