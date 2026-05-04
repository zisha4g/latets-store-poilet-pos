-- User profiles + approval workflow
-- Apply via Supabase SQL editor (db push is broken in this project).

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  store_name text,
  business_type text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If table existed from a partial earlier run, ensure all columns exist.
alter table public.user_profiles add column if not exists user_id uuid;
-- Add FK + unique on user_id only if not present yet.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_user_id_fkey'
  ) then
    execute 'alter table public.user_profiles
             add constraint user_profiles_user_id_fkey
             foreign key (user_id) references auth.users(id) on delete cascade';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_user_id_key'
  ) then
    execute 'alter table public.user_profiles
             add constraint user_profiles_user_id_key unique (user_id)';
  end if;
end;
$$;
alter table public.user_profiles add column if not exists full_name text;
alter table public.user_profiles add column if not exists phone text;
alter table public.user_profiles add column if not exists store_name text;
alter table public.user_profiles add column if not exists business_type text;
alter table public.user_profiles add column if not exists approval_status text not null default 'pending';
alter table public.user_profiles add column if not exists rejection_reason text;
alter table public.user_profiles add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.user_profiles add column if not exists reviewed_at timestamptz;
alter table public.user_profiles add column if not exists created_at timestamptz not null default now();
alter table public.user_profiles add column if not exists updated_at timestamptz not null default now();

-- Ensure the check constraint exists (safe to re-add).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_approval_status_check'
  ) then
    execute 'alter table public.user_profiles
             add constraint user_profiles_approval_status_check
             check (approval_status in (''pending'',''approved'',''rejected''))';
  end if;
end;
$$;

create index if not exists user_profiles_status_idx
  on public.user_profiles(approval_status);

alter table public.user_profiles enable row level security;

-- Helper: am I a platform admin?
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Owner policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_profiles'
      and policyname='user_profiles_select_own'
  ) then
    execute 'create policy "user_profiles_select_own" on public.user_profiles
             for select using (auth.uid() = user_id or public.is_platform_admin())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_profiles'
      and policyname='user_profiles_insert_own'
  ) then
    execute 'create policy "user_profiles_insert_own" on public.user_profiles
             for insert with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_profiles'
      and policyname='user_profiles_update_owner_or_admin'
  ) then
    execute 'create policy "user_profiles_update_owner_or_admin" on public.user_profiles
             for update using (auth.uid() = user_id or public.is_platform_admin())
             with check (auth.uid() = user_id or public.is_platform_admin())';
  end if;
end;
$$;

-- updated_at trigger (reuses existing helper if present, else creates one)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();
