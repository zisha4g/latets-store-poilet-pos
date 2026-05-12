-- pbx_email_accounts + pbx_email_messages
--
-- Single Gmail account per user. Email metadata is mirrored locally for fast
-- listing/search and to power a unified inbox alongside pbx_sms_messages.
-- Full bodies + attachments are fetched live from Gmail on demand.

create table if not exists public.pbx_email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  google_sub text,                                  -- Google account sub claim
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  history_id bigint,                                -- last Gmail history id we've synced
  watch_expiration timestamptz,                     -- when current users.watch() expires
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_pbx_email_accounts_email on public.pbx_email_accounts(email);

alter table public.pbx_email_accounts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pbx_email_accounts' and policyname='pbx_email_accounts_select_own') then
    execute 'create policy "pbx_email_accounts_select_own" on public.pbx_email_accounts for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pbx_email_accounts' and policyname='pbx_email_accounts_delete_own') then
    execute 'create policy "pbx_email_accounts_delete_own" on public.pbx_email_accounts for delete using (auth.uid() = user_id)';
  end if;
  -- Inserts/updates of tokens go through edge functions (service role).
end$$;

-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pbx_email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.pbx_email_accounts(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  from_addr text,
  from_name text,
  to_addrs text[] default '{}',
  cc_addrs text[] default '{}',
  subject text,
  snippet text,
  internal_date timestamptz not null,
  labels text[] default '{}',
  is_read boolean default false,
  has_attachments boolean default false,
  in_reply_to text,
  references_header text,
  message_id_header text,
  created_at timestamptz not null default now(),
  unique (account_id, gmail_message_id)
);

create index if not exists idx_pbx_email_user_date
  on public.pbx_email_messages(user_id, internal_date desc);
create index if not exists idx_pbx_email_user_thread
  on public.pbx_email_messages(user_id, gmail_thread_id, internal_date desc);
create index if not exists idx_pbx_email_unread
  on public.pbx_email_messages(user_id, is_read) where is_read = false;

alter table public.pbx_email_messages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pbx_email_messages' and policyname='pbx_email_messages_select_own') then
    execute 'create policy "pbx_email_messages_select_own" on public.pbx_email_messages for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pbx_email_messages' and policyname='pbx_email_messages_update_own') then
    execute 'create policy "pbx_email_messages_update_own" on public.pbx_email_messages for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pbx_email_messages' and policyname='pbx_email_messages_delete_own') then
    execute 'create policy "pbx_email_messages_delete_own" on public.pbx_email_messages for delete using (auth.uid() = user_id)';
  end if;
end$$;

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pbx_email_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.pbx_email_messages';
  end if;
end$$;
