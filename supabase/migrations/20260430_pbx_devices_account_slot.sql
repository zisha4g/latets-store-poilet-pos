-- Add account_slot column for Yealink line slot (1-16). Default = 1.
alter table public.pbx_devices
  add column if not exists account_slot smallint not null default 1
  check (account_slot between 1 and 16);
