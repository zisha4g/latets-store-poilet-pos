-- =============================================================================
-- StorePilot — Invoices v2 schema upgrade
-- =============================================================================
-- Run this entire file once in the Supabase SQL editor.
-- Idempotent: every statement uses IF NOT EXISTS / CREATE OR REPLACE so it is
-- safe to re-run.
--
-- What this adds:
--   * Extra columns on `invoices` (invoice_number_seq, currency, fx_rate,
--     discount_*, paid_amount, balance_due (generated), issued_at, paid_at,
--     voided_at, void_reason, terms, parent_invoice_id, recurring_template_id,
--     last_emailed_at, email_status).
--   * `invoice_number_sequences` (per-tenant counter).
--   * `invoice_payments` (one row per payment; trigger rolls totals up onto
--     parent invoice and flips status to paid/partial automatically).
--   * `invoice_recurring_templates` (engine for daily/weekly/monthly rebills).
--   * `invoice_audit_log` (created/updated/status changes).
--   * RLS on every new table (auth.uid() = user_id).
--   * RPCs:
--       - allocate_invoice_number(uuid)  -> next sequence value, SECURITY DEFINER
--       - mark_overdue_invoices()        -> flips past-due unpaid invoices
-- =============================================================================
-- ============================================================================
-- Invoicing v2: discounts, payments, recurring, audit log, multi-currency
-- Additive migration. Uses `if not exists` so it's safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend invoices table
-- ----------------------------------------------------------------------------

alter table public.invoices add column if not exists invoice_number_seq bigint;
alter table public.invoices add column if not exists currency text not null default 'USD';
alter table public.invoices add column if not exists fx_rate_to_base numeric(18, 8) not null default 1;
alter table public.invoices add column if not exists discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'fixed'));
alter table public.invoices add column if not exists discount_value numeric(18, 4) not null default 0;
alter table public.invoices add column if not exists discount_amount numeric(18, 4) not null default 0;
alter table public.invoices add column if not exists paid_amount numeric(18, 4) not null default 0;
alter table public.invoices add column if not exists balance_due numeric(18, 4) generated always as (greatest(coalesce(total, 0) - coalesce(paid_amount, 0), 0)) stored;
alter table public.invoices add column if not exists issued_at timestamptz;
alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists voided_at timestamptz;
alter table public.invoices add column if not exists void_reason text;
alter table public.invoices add column if not exists terms text;
alter table public.invoices add column if not exists parent_invoice_id uuid references public.invoices(id) on delete set null;
alter table public.invoices add column if not exists recurring_template_id uuid;
alter table public.invoices add column if not exists last_emailed_at timestamptz;
alter table public.invoices add column if not exists email_status text;

create index if not exists invoices_user_status_idx on public.invoices (user_id, status);
create index if not exists invoices_user_due_date_idx on public.invoices (user_id, due_date);
create index if not exists invoices_user_customer_idx on public.invoices (user_id, customer_id);

-- ----------------------------------------------------------------------------
-- 2. Per-tenant invoice number sequences
-- ----------------------------------------------------------------------------

create table if not exists public.invoice_number_sequences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_value bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.invoice_number_sequences enable row level security;

drop policy if exists "ins_sel_own" on public.invoice_number_sequences;
create policy "ins_sel_own" on public.invoice_number_sequences
  for select using (auth.uid() = user_id);

-- Atomic allocator. SECURITY DEFINER so anon/authenticated callers can
-- increment safely. Returns the value reserved for the caller.
create or replace function public.allocate_invoice_number(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  insert into public.invoice_number_sequences (user_id, next_value)
    values (p_user_id, 1)
    on conflict (user_id) do nothing;

  update public.invoice_number_sequences
     set next_value = next_value + 1,
         updated_at = now()
   where user_id = p_user_id
   returning next_value - 1 into v_next;

  return v_next;
end;
$$;

revoke all on function public.allocate_invoice_number(uuid) from public;
grant execute on function public.allocate_invoice_number(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Invoice payments
-- ----------------------------------------------------------------------------

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(18, 4) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'card', 'check', 'bank', 'other')),
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id);
create index if not exists invoice_payments_user_paid_idx on public.invoice_payments (user_id, paid_at desc);

alter table public.invoice_payments enable row level security;

drop policy if exists "ip_select_own" on public.invoice_payments;
create policy "ip_select_own" on public.invoice_payments for select using (auth.uid() = user_id);
drop policy if exists "ip_insert_own" on public.invoice_payments;
create policy "ip_insert_own" on public.invoice_payments for insert with check (auth.uid() = user_id);
drop policy if exists "ip_update_own" on public.invoice_payments;
create policy "ip_update_own" on public.invoice_payments for update using (auth.uid() = user_id);
drop policy if exists "ip_delete_own" on public.invoice_payments;
create policy "ip_delete_own" on public.invoice_payments for delete using (auth.uid() = user_id);

-- Recompute paid_amount + status whenever a payment row changes.
create or replace function public.recompute_invoice_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_paid numeric(18, 4);
  v_total numeric(18, 4);
  v_status text;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(amount), 0) into v_paid
    from public.invoice_payments
   where invoice_id = v_invoice_id;

  select total, status into v_total, v_status
    from public.invoices
   where id = v_invoice_id;

  if v_status not in ('void') then
    if v_paid <= 0 then
      v_status := case when v_status in ('paid', 'partial') then 'sent' else v_status end;
    elsif v_paid >= coalesce(v_total, 0) then
      v_status := 'paid';
    else
      v_status := 'partial';
    end if;
  end if;

  update public.invoices
     set paid_amount = v_paid,
         paid_at = case when v_paid >= coalesce(v_total, 0) and v_paid > 0 then now() else null end,
         status = v_status
   where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_invoice_payments_recompute on public.invoice_payments;
create trigger trg_invoice_payments_recompute
after insert or update or delete on public.invoice_payments
for each row execute function public.recompute_invoice_payment_status();

-- ----------------------------------------------------------------------------
-- 4. Recurring templates
-- ----------------------------------------------------------------------------

create table if not exists public.invoice_recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_run_at timestamptz not null,
  end_date date,
  active boolean not null default true,
  template_json jsonb not null,
  last_run_at timestamptz,
  last_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists irt_user_active_idx on public.invoice_recurring_templates (user_id, active, next_run_at);

alter table public.invoice_recurring_templates enable row level security;

drop policy if exists "irt_select_own" on public.invoice_recurring_templates;
create policy "irt_select_own" on public.invoice_recurring_templates for select using (auth.uid() = user_id);
drop policy if exists "irt_insert_own" on public.invoice_recurring_templates;
create policy "irt_insert_own" on public.invoice_recurring_templates for insert with check (auth.uid() = user_id);
drop policy if exists "irt_update_own" on public.invoice_recurring_templates;
create policy "irt_update_own" on public.invoice_recurring_templates for update using (auth.uid() = user_id);
drop policy if exists "irt_delete_own" on public.invoice_recurring_templates;
create policy "irt_delete_own" on public.invoice_recurring_templates for delete using (auth.uid() = user_id);

-- FK from invoices.recurring_template_id (added above) -> templates.id
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'invoices_recurring_template_id_fkey'
  ) then
    alter table public.invoices
      add constraint invoices_recurring_template_id_fkey
      foreign key (recurring_template_id)
      references public.invoice_recurring_templates(id)
      on delete set null;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Audit log
-- ----------------------------------------------------------------------------

create table if not exists public.invoice_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ial_invoice_idx on public.invoice_audit_log (invoice_id, created_at desc);
create index if not exists ial_user_idx on public.invoice_audit_log (user_id, created_at desc);

alter table public.invoice_audit_log enable row level security;

drop policy if exists "ial_select_own" on public.invoice_audit_log;
create policy "ial_select_own" on public.invoice_audit_log for select using (auth.uid() = user_id);
-- Insert is performed server-side (trigger uses SECURITY DEFINER), but allow
-- authenticated users to insert their own rows for completeness.
drop policy if exists "ial_insert_own" on public.invoice_audit_log;
create policy "ial_insert_own" on public.invoice_audit_log for insert with check (auth.uid() = user_id);

create or replace function public.log_invoice_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_actor uuid;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_user := new.user_id; v_actor := auth.uid(); v_action := 'created';
    insert into public.invoice_audit_log (user_id, invoice_id, actor_id, action, before, after)
      values (v_user, new.id, v_actor, v_action, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    v_user := new.user_id; v_actor := auth.uid();
    if old.status is distinct from new.status then
      v_action := 'status:' || coalesce(new.status, 'null');
    else
      v_action := 'updated';
    end if;
    insert into public.invoice_audit_log (user_id, invoice_id, actor_id, action, before, after)
      values (v_user, new.id, v_actor, v_action, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    v_user := old.user_id; v_actor := auth.uid(); v_action := 'deleted';
    insert into public.invoice_audit_log (user_id, invoice_id, actor_id, action, before, after)
      values (v_user, old.id, v_actor, v_action, to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_invoice_audit on public.invoices;
create trigger trg_invoice_audit
after insert or update or delete on public.invoices
for each row execute function public.log_invoice_change();

-- ----------------------------------------------------------------------------
-- 6. Auto-overdue marker
-- ----------------------------------------------------------------------------
-- Marks unpaid, sent invoices as 'overdue' when due_date < today.
-- Called by the scheduled run-recurring-invoices function (see edge function).

create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.invoices
     set status = 'overdue'
   where status in ('sent', 'partial')
     and due_date is not null
     and due_date < current_date
     and coalesce(paid_amount, 0) < coalesce(total, 0);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_overdue_invoices() from public;
grant execute on function public.mark_overdue_invoices() to authenticated, service_role;

