-- Relax user_profiles so admin approve/reject works on legacy auth users
-- with no profile row. Apply via Supabase SQL Editor.

-- 1) Make id auto-generate
alter table public.user_profiles
  alter column id set default gen_random_uuid();

-- 2) Make optional fields nullable (loop through, ignore if column doesn't exist)
do $$
declare
  col text;
begin
  foreach col in array array['email','full_name','phone','store_name','business_type']
  loop
    begin
      execute format('alter table public.user_profiles alter column %I drop not null', col);
    exception when undefined_column then
      -- column doesn't exist, skip
      null;
    end;
  end loop;
end;
$$;

-- 3) Backfill any existing NULL emails from auth.users (safe even if email col absent)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_profiles' and column_name='email'
  ) then
    execute $sql$
      update public.user_profiles p
      set email = u.emailre_NQFmaYem_5kUt3b9Vb1WKMhCC4dbN7kKn
      from auth.users u
      where p.user_id = u.id and (p.email is null or p.email = '')
    $sql$;
  end if;
end;
$$;
