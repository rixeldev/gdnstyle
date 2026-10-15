-- ============================================================================
-- GDN Style — cancellation reason on appointments
-- ============================================================================
-- Safe to run repeatedly: every step checks existence first, so it works on
-- databases that already have some (or all) of these objects from the live
-- project. Apply with `supabase db push` or the SQL editor.
--
-- What this migration does:
--   1. appointments.cancellation_reason: added when missing, so a cancellation
--      always carries the explanation the UI asks for.
--   2. request_appointment_cancellation: now receives that reason alongside the
--      id and stores it on the row, letting the professional read why the
--      client backed out (and vice versa through the same column).
--
-- The one-parameter signature created by migration 0003 is dropped first:
-- Postgres would otherwise keep both as overloads and PostgREST could no
-- longer decide which one a named-argument call means. The new function keeps
-- `p_reason` defaulted, so older callers passing only `p_id` still work.

-- 1. Column -----------------------------------------------------------------
alter table public.appointments
  add column if not exists cancellation_reason text;

comment on column public.appointments.cancellation_reason is
  'Why the appointment was cancelled, entered by whoever cancelled it.';

-- 2. RPC --------------------------------------------------------------------
drop function if exists public.request_appointment_cancellation(uuid);

create or replace function public.request_appointment_cancellation(
  p_id uuid,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client  uuid;
  v_payment text;
  v_refund  text;
  v_reason  text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  -- Blank input must not overwrite a reason that is already stored.
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  select client_id,
         coalesce(payment_status, ''),
         coalesce(refund_status, '')
    into v_client, v_payment, v_refund
    from public.appointments
   where id = p_id;

  if v_client is null or v_client <> auth.uid() then
    raise exception 'appointment not found';
  end if;

  -- Paid money already captured → keep the row and open a refund request.
  if v_payment in ('pending', 'released', 'paid') and v_refund <> 'approved' then
    update public.appointments
       set status = 'cancelled',
           cancelled_at = now(),
           cancellation_reason = coalesce(v_reason, cancellation_reason),
           refund_status = 'requested',
           refund_requested_at = now()
     where id = p_id;
    return 'refund-requested';
  end if;

  update public.appointments
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = coalesce(v_reason, cancellation_reason)
   where id = p_id;

  return 'cancelled';
end;
$$;

revoke execute on function public.request_appointment_cancellation(uuid, text) from public, anon;
grant execute on function public.request_appointment_cancellation(uuid, text) to authenticated;
