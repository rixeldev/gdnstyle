-- ============================================================================
-- GDN Style — editable account data: profile address, bio, providers writes
-- ============================================================================
-- Safe to run repeatedly: every step checks existence first, so it works on
-- databases that already carry some of these objects from the live project.
-- Apply with `supabase db push` or the SQL editor.
--
-- What this migration does:
--   1. profiles.address_* + profiles.bio: the account editor now collects a
--      full address and a short bio for both roles. `providers` has carried an
--      address since signup and the professional card renders it, but a
--      customer had nowhere to store one, and the bio existed only in the demo
--      layer -- typing it into the dialog used to be thrown away.
--   2. providers UPDATE for the owner: the professional's public card (name,
--      business name, phone, address, socials) could never be edited from the
--      app. 0002's signup trigger writes that row through `security definer`
--      and no migration ever granted the owner an UPDATE, so every field on it
--      was frozen at the value signup collected.
--
-- Note on `providers`: row level security may be disabled there in the live
-- project (the public directory reads the row from the browser). A policy on a
-- table without RLS is inert -- it grants nothing and revokes nothing -- so
-- this file is safe either way, and only starts restricting if RLS is turned
-- on later.

-- 1. Account columns ---------------------------------------------------------

alter table public.profiles
  add column if not exists address_line1       text;

alter table public.profiles
  add column if not exists address_line2       text;

alter table public.profiles
  add column if not exists address_city        text;

alter table public.profiles
  add column if not exists address_state       text;

alter table public.profiles
  add column if not exists address_postal_code text;

alter table public.profiles
  add column if not exists address_country     text;

alter table public.profiles
  add column if not exists bio                 text;

comment on column public.profiles.address_line1 is
  'Street address of the account holder, edited in the account dialog.';
comment on column public.profiles.bio is
  'Short presentation shown on the account card.';

-- 2. Owner update on providers ----------------------------------------------

drop policy if exists "providers_update_own" on public.providers;

create policy "providers_update_own"
  on public.providers
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
