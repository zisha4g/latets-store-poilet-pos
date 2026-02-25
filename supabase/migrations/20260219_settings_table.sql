-- ══════════════════════════════════════════════════════
-- Settings table: ensure it exists with proper schema
-- ══════════════════════════════════════════════════════

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════
-- Unique constraint on (user_id, key) — required for
-- upsert with onConflict: ['user_id', 'key']
-- ══════════════════════════════════════════════════════

-- Drop existing constraint if it exists (safe re-run)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settings_user_id_key_unique'
  ) then
    alter table public.settings
      add constraint settings_user_id_key_unique unique (user_id, key);
  end if;
end;
$$;

-- ══════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════

alter table public.settings enable row level security;

-- Users can only see their own settings
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'settings_select_own' and tablename = 'settings'
  ) then
    execute 'create policy "settings_select_own" on public.settings for select using (auth.uid() = user_id)';
  end if;
end;
$$;

-- Users can insert their own settings
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'settings_insert_own' and tablename = 'settings'
  ) then
    execute 'create policy "settings_insert_own" on public.settings for insert with check (auth.uid() = user_id)';
  end if;
end;
$$;

-- Users can update their own settings
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'settings_update_own' and tablename = 'settings'
  ) then
    execute 'create policy "settings_update_own" on public.settings for update using (auth.uid() = user_id)';
  end if;
end;
$$;

-- Users can delete their own settings
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'settings_delete_own' and tablename = 'settings'
  ) then
    execute 'create policy "settings_delete_own" on public.settings for delete using (auth.uid() = user_id)';
  end if;
end;
$$;

-- ══════════════════════════════════════════════════════
-- Auto-update updated_at on row changes
-- ══════════════════════════════════════════════════════

create or replace function public.update_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists settings_updated_at on public.settings;

create trigger settings_updated_at
  before update on public.settings
  for each row
  execute function public.update_settings_updated_at();
