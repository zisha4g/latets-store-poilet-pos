-- Allow multiple IVR flows per user, with naming and on/off toggles.
-- Adds name, is_active, is_primary columns. Drops the user_id unique constraint
-- and replaces it with a partial unique index that enforces "exactly one primary
-- flow per user". Phone calls always trigger the primary active+published flow.

alter table public.ivr_flow_configs
  add column if not exists name text,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_primary boolean not null default false;

-- Backfill existing rows: name them "Main flow" and mark them primary.
update public.ivr_flow_configs
  set name = coalesce(nullif(trim(name), ''), 'Main flow')
  where name is null or trim(name) = '';

update public.ivr_flow_configs c
  set is_primary = true
  where is_primary = false
    and not exists (
      select 1 from public.ivr_flow_configs c2
      where c2.user_id = c.user_id and c2.is_primary = true
    );

-- Make name not-null after backfill.
alter table public.ivr_flow_configs alter column name set default 'Untitled flow';
alter table public.ivr_flow_configs alter column name set not null;

-- Drop the old "one row per user" unique constraint (its name follows pg's default).
do $$
declare
  c record;
  cols text[];
begin
  for c in
    select conname, conkey from pg_constraint
    where conrelid = 'public.ivr_flow_configs'::regclass
      and contype = 'u'
  loop
    select array_agg(attname order by attnum)
      into cols
      from pg_attribute
      where attrelid = 'public.ivr_flow_configs'::regclass
        and attnum = any(c.conkey);
    if cols = array['user_id'] then
      execute format('alter table public.ivr_flow_configs drop constraint %I', c.conname);
    end if;
  end loop;
end;
$$;

-- Enforce: at most one primary flow per user.
create unique index if not exists ivr_flow_configs_one_primary_per_user
  on public.ivr_flow_configs(user_id)
  where is_primary;

-- Useful index for listing.
create index if not exists idx_ivr_flow_configs_user_active
  on public.ivr_flow_configs(user_id, is_active);
