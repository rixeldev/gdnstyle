-- ============================================================================
-- GDN Style — rate limits for the Edge Functions
-- ============================================================================
-- Safe to run repeatedly: every step checks existence first. Apply with
-- `supabase db push` or the SQL editor.
--
-- What this migration does:
--   1. rate_limits: one row per key, holding a fixed window and a counter.
--   2. consume_rate_limit: the only supported way to touch that table. It
--      advances the window when the previous one expired, returns false once
--      the caller has spent their attempts, and cleans up old rows
--      opportunistically.
--
-- Why the grants are this tight: an open counter is a weapon. Whoever can call
-- the function chooses the key, so a public grant would let anyone spend
-- somebody else's attempts and lock them out of booking. Only the service role
-- may call it — the Edge Functions build the key from an identity they verified
-- themselves (`user:<uuid>`), so a client can never mint a bucket in another
-- user's name.
--
-- Deploy order does not matter: the functions fail open (log and continue)
-- until this migration exists.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
);

comment on table public.rate_limits is
  'Fixed-window request counters, written only by consume_rate_limit.';

alter table public.rate_limits enable row level security;

-- The service role is the only writer, and it bypasses RLS; the default
-- Supabase grants would otherwise leave the table open to anon and
-- authenticated, letting anyone reset a counter by deleting its row.
revoke all on table public.rate_limits from anon, authenticated;

-- 2. RPC ---------------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  -- A misconfigured limit must not block the world.
  if p_key is null or p_key = ''
     or p_max_attempts is null or p_max_attempts < 1
     or p_window_seconds is null or p_window_seconds < 1 then
    return true;
  end if;

  -- The upsert is the whole trick: Postgres locks the row, so two requests
  -- racing for the last attempt cannot both see the old counter. An expired
  -- window restarts at one instead of growing forever.
  insert into rate_limits (key, window_started_at, attempts)
  values (p_key, now(), 1)
  on conflict (key) do update set
    attempts = case
      when rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else rate_limits.attempts + 1
    end,
    window_started_at = case
      when rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else rate_limits.window_started_at
    end
  returning attempts into v_attempts;

  -- Rows whose window ended long ago carry no information; drop about one
  -- percent of them per call so the table never needs a vacuum schedule.
  if random() < 0.01 then
    delete from rate_limits where window_started_at <= now() - interval '1 day';
  end if;

  return v_attempts <= p_max_attempts;
end;
$$;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Spends one attempt from the fixed window of p_key; false once the budget is spent.';

revoke execute on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
