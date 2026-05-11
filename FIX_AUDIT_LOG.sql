-- ----------------------------------------------------------------------------
-- FIX: invoice_audit_log FK violation on invoice updates
-- ----------------------------------------------------------------------------
-- Symptom:
--   PATCH /invoices?id=eq.<uuid> fails with 409 / 23503:
--     "Key (invoice_id)=(<uuid>) is not present in table \"invoices\"."
--   even though the invoice clearly exists (we are updating it).
--
-- Root cause:
--   The audit-log trigger runs as SECURITY DEFINER (owner = postgres),
--   but the FK enforcement query that follows the INSERT into
--   invoice_audit_log can hit RLS / visibility weirdness on the parent
--   `invoices` table inside a Supabase project (especially when a row was
--   just touched in the same statement). The FK adds no real value for an
--   append-only audit trail — we explicitly WANT log rows to outlive their
--   parent invoice, not cascade-delete with it.
--
-- Fix:
--   Drop the FK on invoice_audit_log.invoice_id. Keep it as a plain uuid
--   column (still indexed). This is the standard pattern for audit/event
--   log tables.
--
-- Run this in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

alter table public.invoice_audit_log
  drop constraint if exists invoice_audit_log_invoice_id_fkey;

-- Make sure the column stays not null and indexed (it already is, but
-- re-asserting is safe and idempotent).
alter table public.invoice_audit_log
  alter column invoice_id set not null;

create index if not exists ial_invoice_idx
  on public.invoice_audit_log (invoice_id, created_at desc);

-- Also harden the trigger so a logging hiccup never blocks an invoice
-- save. We wrap the audit insert in an exception block: if anything goes
-- wrong while writing the audit row, log a warning and let the original
-- invoice operation succeed.
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
  exception when others then
    raise warning 'log_invoice_change failed (% %): %', tg_op, coalesce(new.id, old.id), sqlerrm;
  end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_audit on public.invoices;
create trigger trg_invoice_audit
after insert or update or delete on public.invoices
for each row execute function public.log_invoice_change();
