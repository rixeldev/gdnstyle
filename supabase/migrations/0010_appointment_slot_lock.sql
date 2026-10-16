-- ============================================================================
-- GDN Style — one hour, one appointment: the no-overlap lock
-- ============================================================================
-- Safe to run repeatedly: the extension, the indexes and the constraint are
-- each created only when missing. Apply with the SQL editor.
--
-- What this migration does:
--   Until now a taken hour was refused by a read-then-check in the
--   `create-appointment` Edge Function: read the day's appointments, decide in
--   JavaScript, then insert. Two requests racing for the same hour could both
--   pass the check and both insert a row. This migration moves the rule into
--   the database, where it cannot race:
--
--     an EXCLUDE constraint rejects any second non-cancelled row whose
--     [start, end) window overlaps an existing one for the same professional.
--
--   Postgres reports the rejection as SQLSTATE 23P01 (exclusion violation).
--   The Edge Function answers it with `code: SLOT_TAKEN` and the dashboard
--   throws its `SlotUnavailableError`, so both show the localized "slot
--   taken" message instead of a generic failure.
--
-- Scope notes:
--   * The lock is per professional (`provider_id`), not per venue: one
--     professional cannot be in two places at once, while two professionals
--     may work the same venue at the same hour.
--   * `tsrange` is half-open `[)`, so back-to-back services (9:00-9:30 and
--     9:30-10:00) do not collide — the slot builder never offers overlap.
--   * Cancelled rows are excluded, so cancelling frees the hour again.
--   * `scheduled_date + scheduled_time` is naive venue wall-clock time, the
--     same convention the reminder cron (migration 0009) assumes.

-- 1) GiST can only hold equality on scalars (our `provider_id with =`) with
--    the operator classes btree_gist adds.
create extension if not exists btree_gist with schema extensions;

-- 2) The two lookups that feed every booking screen, answered by plain btree
--    scans: the availability RPC reads by provider+date, the dashboard by
--    client+date.
create index if not exists appointments_provider_date_idx
  on public.appointments (provider_id, scheduled_date);

create index if not exists appointments_client_date_idx
  on public.appointments (client_id, scheduled_date desc);

-- 3) Refuse to install the lock on top of overlaps the app already made.
do $$
declare
  v_overlaps bigint;
begin
  select count(*)
    into v_overlaps
    from public.appointments a
    join public.appointments b
      on a.provider_id = b.provider_id
     and a.id < b.id
     and a.status <> 'cancelled'
     and b.status <> 'cancelled'
     and tsrange(a.scheduled_date + a.scheduled_time,
                 a.scheduled_date + a.scheduled_time
                   + a.duration_minutes * interval '1 minute')
      && tsrange(b.scheduled_date + b.scheduled_time,
                 b.scheduled_date + b.scheduled_time
                   + b.duration_minutes * interval '1 minute');

  if v_overlaps > 0 then
    raise exception
      'appointments holds % overlapping pair(s); cancel one side of each pair (same join as this block) and re-run the migration',
      v_overlaps;
  end if;
end $$;

-- 4) The lock itself.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.appointments'::regclass
       and conname = 'appointments_no_overlap'
  ) then
    alter table public.appointments
      add constraint appointments_no_overlap
      exclude using gist (
        provider_id with =,
        tsrange(scheduled_date + scheduled_time,
                scheduled_date + scheduled_time
                  + duration_minutes * interval '1 minute') with &&
      )
      where (status <> 'cancelled');
  end if;
end $$;

comment on constraint appointments_no_overlap on public.appointments is
  'One professional cannot hold two overlapping appointments; inserts, updates and reschedules all check it.';
