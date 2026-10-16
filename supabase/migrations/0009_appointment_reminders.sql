-- ============================================================================
-- GDN Style — day-before appointment reminders
-- ============================================================================
-- Safe to run repeatedly: every step checks existence first, and `cron.schedule`
-- replaces its job by name. Apply with `supabase db push` or the SQL editor.
--
-- What this migration does:
--   1. appointments.reminder_sent_at: the stamp that makes a reminder sendable
--      exactly once. The scheduler below and the function it calls both rely on
--      it, and it doubles as the idempotency key that keeps the endpoint safe
--      to expose.
--   2. pg_cron + pg_net: the scheduler and its HTTP client, if the project does
--      not have them yet. The dashboard offers both under Database →
--      Extensions; if the SQL editor refuses to create them, enable them there
--      and run this again.
--   3. A daily job at 06:15 UTC (02:15 in Miami) that calls
--      `send-appointment-reminders`. Reminders go out while everyone sleeps,
--      ready in the inbox by morning.
--
-- The function is deployed with `--no-verify-jwt`: the scheduler cannot hold a
-- user session, and the function is idempotent (it only ever emails
-- appointments that still have no `reminder_sent_at`, then stamps them), so
-- being reachable without a token costs nothing. Operators who want it closed
-- anyway can set the `REMINDER_CRON_SECRET` environment variable and send it as
-- an `x-cron-secret` header.
--
-- ⚠ The URL below carries this project's reference
-- (qzdzjdulvgktzfbspofo, the same one in `.env`). If the project ever changes,
-- edit it here before running the migration.

-- 1. Column -----------------------------------------------------------------
alter table public.appointments
  add column if not exists reminder_sent_at timestamptz;

comment on column public.appointments.reminder_sent_at is
  'When the day-before reminder went out; null until one has been sent.';

-- 2. Extensions ---------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 3. Daily job ---------------------------------------------------------------
-- Both extensions were created (the statement above is Supabase's own), but
-- their objects live in the schemas their own control files pin: `cron` for
-- pg_cron and `net` for pg_net. The two-part qualified names below work
-- whatever the search_path is, including inside the job's own command, where
-- pg_cron does not inherit the caller's settings.
--
-- If the editor still reports that `cron.schedule` or `net.http_post` does not
-- exist, the extensions are not installed: enable pg_cron and pg_net under
-- Database → Extensions and run this again.
select cron.schedule(
  'gdn-appointment-reminders',
  '15 6 * * *',
  $$
  select net.http_post(
    url := 'https://qzdzjdulvgktzfbspofo.supabase.co/functions/v1/send-appointment-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  )
  $$
);
