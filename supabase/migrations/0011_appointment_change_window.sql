-- ============================================================================
-- GDN Style — the change window closes in the database, not in the browser
-- ============================================================================
-- Safe to run repeatedly: every function and policy is dropped before being
-- (re)created. Apply with the SQL editor.
--
-- What this migration does:
--   The 1h30m rule ("a client may edit or cancel only with at least one hour
--   and a half left") was enforced by reading the clock in the browser. A
--   modified client, a wrong clock or a direct PostgREST call skipped it. The
--   rule now lives next to the data:
--
--     1. `request_appointment_cancellation` refuses inside the window and
--        raises the custom SQLSTATE GDN90, which the dashboard translates
--        into its "changes locked" toast.
--     2. The client UPDATE policy carries the same predicate, so the direct
--        update fallbacks (and anything else talking to PostgREST) are
--        refused the same way. RLS hides the row instead of failing, so the
--        service reads the row back and reports it as too late.
--     3. The window only binds the client: the professional keeps their own
--        UPDATE policy and may confirm or cancel at any hour.
--
-- Two more appointments policies are fixed on the way:
--     4. INSERT: a client may create only their own, still-pending rows (the
--        Edge Functions use the service role and are unaffected).
--     5. The venue-wide SELECT ("Clients can view occupied time slots") let
--        every signed-in visitor read every booking's client name, email,
--        phone and notes just to draw the availability grid. The grid now
--        reads the `occupied_appointment_slots` RPC below, which answers with
--        times and durations only, and client DELETE is gone: a cancellation
--        must leave its row behind (reason, refund, history).
--
-- Times are naive venue wall-clock (`America/New_York`), the same convention
-- the reminder cron (migration 0009) assumes.

-- 1) Occupied slots: what the availability grid may know --------------------
create or replace function public.occupied_appointment_slots(
  p_provider_id uuid,
  p_date date,
  p_exclude_id uuid default null
)
returns table (scheduled_time time, duration_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select a.scheduled_time, a.duration_minutes
    from public.appointments a
   where a.provider_id = p_provider_id
     and a.scheduled_date = p_date
     and a.status <> 'cancelled'
     and (p_exclude_id is null or a.id <> p_exclude_id);
$$;

comment on function public.occupied_appointment_slots(uuid, date, uuid) is
  'Booked start times and durations of one professional on one day: the only appointment data the availability grid needs.';

revoke execute on function public.occupied_appointment_slots(uuid, date, uuid) from public, anon;
grant execute on function public.occupied_appointment_slots(uuid, date, uuid) to authenticated;

-- 2) Cancellation RPC with the window --------------------------------------
-- The one-parameter overload from migration 0003 stays gone so PostgREST can
-- keep resolving the named-argument call; `p_reason` keeps its default.
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
  v_start   timestamp;
  v_status  text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  -- Blank input must not overwrite a reason that is already stored.
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  select client_id,
         coalesce(payment_status, ''),
         coalesce(refund_status, ''),
         scheduled_date + scheduled_time,
         coalesce(status, '')
    into v_client, v_payment, v_refund, v_start, v_status
    from public.appointments
   where id = p_id;

  if v_client is null or v_client <> auth.uid() then
    raise exception 'appointment not found';
  end if;

  -- The 1h30m window, enforced with the server clock. An already-cancelled
  -- row is exempt so its reason can still be filled in afterwards.
  if v_status <> 'cancelled'
     and v_start < (now() at time zone 'America/New_York') + interval '90 minutes' then
    raise exception 'the appointment can no longer be changed'
      using errcode = 'GDN90';
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

comment on function public.request_appointment_cancellation(uuid, text) is
  'Cancels the caller''s own appointment and stores the reason; raises SQLSTATE GDN90 inside the last 1h30m before it starts.';

revoke execute on function public.request_appointment_cancellation(uuid, text) from public, anon;
grant execute on function public.request_appointment_cancellation(uuid, text) to authenticated;

-- 3) INSERT: only your own, still-pending rows -----------------------------
drop policy if exists "Authenticated users can create appointments" on public.appointments;

create policy "Clients can book their own appointments"
  on public.appointments
  for insert
  to authenticated
  with check (client_id = auth.uid() and status = 'pending');

-- 4) The grid no longer reads the table ------------------------------------
drop policy if exists "Clients can view occupied time slots" on public.appointments;

-- 5) UPDATE: the window, written into the policy ---------------------------
drop policy if exists "Clients can update their appointments" on public.appointments;

create policy "Clients can update their appointments until the lock closes"
  on public.appointments
  for update
  to authenticated
  using (
    client_id = auth.uid()
    and (
      status = 'cancelled'
      or scheduled_date + scheduled_time
         >= (now() at time zone 'America/New_York') + interval '90 minutes'
    )
  )
  with check (
    client_id = auth.uid()
    and (
      status = 'cancelled'
      or scheduled_date + scheduled_time
         >= (now() at time zone 'America/New_York') + interval '90 minutes'
    )
  );

comment on policy "Clients can update their appointments until the lock closes" on public.appointments is
  'The client owns the row and either it is already cancelled (reason can still be stored) or the 1h30m window is still open.';

-- 6) DELETE: a cancelled appointment must leave its row behind -------------
drop policy if exists "Clients can delete their appointments" on public.appointments;
