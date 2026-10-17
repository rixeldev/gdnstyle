-- ============================================================================
-- GDN Style — every professional keeps their own wall clock
-- ============================================================================
-- Safe to run repeatedly: the column is added once, the constraint and the
-- view are recreated idempotently. Apply with the SQL editor.
--
-- What this migration does:
--
--   Appointment times are stored as naive venue wall-clock (`HH:MM`), and
--   everything that compares them against "now" — the 1h30m change window
--   (migration 0011) and the day-before reminders (0009) — read the clock in
--   a hardcoded America/New_York. A professional outside the Eastern zone
--   would lock and remind hours off.
--
--     1. `providers.timezone` holds the IANA zone the venue's stored hours
--        are written in (default America/New_York, which covers the whole
--        current catalog). The account dialog offers a curated US list.
--     2. The change window — both the cancellation RPC and the client UPDATE
--        policy — now reads the clock in that provider's zone.
--     3. The `provider_public` view projects the column, so the browser can
--        classify a booking (overdue, 1h30m lock) with the same clock the
--        database uses. The policy reads the timezone through that view on
--        purpose: the table itself answers only its owner, but the view runs
--        with its owner's rights and would hide nothing from the predicate.
--
-- The column carries a shape check only: a CHECK cannot look a zone up in
-- pg_timezone_names, and a provider pointing at a bogus zone can only break
-- their own bookings. The dialog offers real zones and the reminder job
-- skips a row whose zone will not parse.

-- 1) The column --------------------------------------------------------------
alter table public.providers
  add column if not exists timezone text not null default 'America/New_York';

alter table public.providers
  drop constraint if exists providers_timezone_shape;
alter table public.providers
  add constraint providers_timezone_shape
  check (timezone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$');

comment on column public.providers.timezone is
  'IANA zone the stored HH:MM appointment times are written in; America/New_York unless the professional picks another one.';

-- 2) The public projection carries it (new column appended last) -------------
create or replace view public.provider_public
with (security_invoker = false) as
  select id,
         user_id,
         full_name,
         business_name,
         email,
         phone,
         photo,
         rating,
         reviews,
         charges_enabled,
         stripe_onboarding_completed,
         identity_verified,
         address_line1,
         address_line2,
         address_city,
         address_state,
         address_postal_code,
         address_country,
         social_facebook,
         social_instagram,
         social_tiktok,
         social_twitter,
         social_youtube,
         social_whatsapp,
         created_at,
         timezone
    from public.providers;

comment on view public.provider_public is
  'What the marketplace may show about a professional: card, contact, address, socials and the zone its schedule is written in. Stripe ids, tax id, birth date and verification artifacts stay on the table for its owner and the service role.';

grant select on public.provider_public to anon, authenticated;

-- 3) The cancellation RPC reads the provider's clock -------------------------
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
  v_zone    text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  -- Blank input must not overwrite a reason that is already stored.
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  select a.client_id,
         coalesce(a.payment_status, ''),
         coalesce(a.refund_status, ''),
         a.scheduled_date + a.scheduled_time,
         coalesce(a.status, ''),
         coalesce(
           (select v.timezone from public.provider_public v where v.id = a.provider_id),
           'America/New_York'
         )
    into v_client, v_payment, v_refund, v_start, v_status, v_zone
    from public.appointments a
   where a.id = p_id;

  if v_client is null or v_client <> auth.uid() then
    raise exception 'appointment not found';
  end if;

  -- The 1h30m window, enforced with the server clock in the venue's own zone.
  -- An already-cancelled row is exempt so its reason can still be stored.
  if v_status <> 'cancelled'
     and v_start < (now() at time zone v_zone) + interval '90 minutes' then
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
  'Cancels the caller''s own appointment and stores the reason; raises SQLSTATE GDN90 inside the last 1h30m before it starts, measured in the provider''s timezone.';

revoke execute on function public.request_appointment_cancellation(uuid, text) from public, anon;
grant execute on function public.request_appointment_cancellation(uuid, text) to authenticated;

-- 4) The same window, written into the client UPDATE policy ------------------
-- The timezone comes from `provider_public` for the same reason as above: the
-- predicate runs as the client, who may not read another professional's row.
drop policy if exists "Clients can update their appointments until the lock closes" on public.appointments;

create policy "Clients can update their appointments until the lock closes"
  on public.appointments
  for update
  to authenticated
  using (
    client_id = auth.uid()
    and (
      status = 'cancelled'
      or scheduled_date + scheduled_time
         >= (now() at time zone coalesce(
               (select v.timezone from public.provider_public v where v.id = provider_id),
               'America/New_York'
             )) + interval '90 minutes'
    )
  )
  with check (
    client_id = auth.uid()
    and (
      status = 'cancelled'
      or scheduled_date + scheduled_time
         >= (now() at time zone coalesce(
               (select v.timezone from public.provider_public v where v.id = provider_id),
               'America/New_York'
             )) + interval '90 minutes'
    )
  );

comment on policy "Clients can update their appointments until the lock closes" on public.appointments is
  'The client owns the row and either it is already cancelled (reason can still be stored) or the 1h30m window, measured in the provider''s timezone, is still open.';
