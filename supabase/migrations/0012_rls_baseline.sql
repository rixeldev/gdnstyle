-- ============================================================================
-- GDN Style — RLS baseline: every table has an owner, nothing reads itself
-- ============================================================================
-- Safe to run repeatedly: policies are dropped before being (re)created and
-- views/grants are idempotent. Apply with the SQL editor.
--
-- What this migration does, from the diagnostic dump of the live database:
--
--   1. `favorites` and `product_images` had row level security off, so any
--      visitor with the publishable key could read and rewrite every row.
--   2. `profiles` let any signed-in visitor read every column of every
--      profile: email, phone, birthday, address, expo push token and
--      `stripe_customer_id`. No screen in the app reads someone else's row.
--   3. `providers` was publicly readable in full, which included
--      `stripe_account_id`, `stripe_customer_id`, `tax_id_last4`,
--      `date_of_birth` and `verification_report_id`. The public screens need
--      the card, the contact chips and the address — nothing else — so they
--      now read the `provider_public` view below while the table answers only
--      its owner (and the service role).
--   4. `provider_payments` and `provider_withdrawals` let a professional
--      insert and update their own money rows. Every real row comes from the
--      Stripe webhooks through the service role, so those policies could only
--      ever be used to forge a ledger.
--   5. `business_categories` could be edited or deleted by any signed-in
--      visitor; no app path writes that table.
--   6. `locations` accepted a venue from any signed-in visitor. Creating one
--      is a professional's action, so the insert now requires owning a
--      `providers` row.
--   7. Three `provider_locations` policies compared `providers.id` against
--      `auth.uid()`, which never matches (the auth uid lives in
--      `providers.user_id`). The subquery policies beside them are the ones
--      that actually work, so the dead trio goes.
--
-- Left alone on purpose: `checkout_sessions`, `cj_access_tokens` and
-- `rate_limits` keep RLS on with no policies at all — only the service role
-- (webhooks, cron, the rate-limit RPC) touches them.

-- 1) favorites: owned rows only ---------------------------------------------
alter table public.favorites enable row level security;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own
  on public.favorites
  for select to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own
  on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid()::text);

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own
  on public.favorites
  for delete to authenticated
  using (user_id = auth.uid()::text);

-- 2) product_images: locked to the service role (nothing reads it yet) ------
alter table public.product_images enable row level security;

-- 3) profiles: only the owner reads a profile --------------------------------
drop policy if exists "Allow authenticated users to read profile names" on public.profiles;

-- 4) providers: public data moves to a view, the table stays with its owner --
drop policy if exists "Permitir lectura pública de providers" on public.providers;
drop policy if exists "public_read_providers" on public.providers;

-- A view runs with its owner's rights (no `security_invoker`), so it can
-- project the public columns while `providers` itself stops answering anyone
-- but the owner. Financial and identity columns are simply not in the list.
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
         created_at
    from public.providers;

comment on view public.provider_public is
  'What the marketplace may show about a professional: card, contact, address and socials. Stripe ids, tax id, birth date and verification artifacts stay on the table for its owner and the service role.';

grant select on public.provider_public to anon, authenticated;

-- The lookup behind the venue-creation policy below (and behind the session
-- load, which reads the provider row by user id) stops being a scan.
create index if not exists providers_user_id_idx
  on public.providers (user_id);

-- 5) Money rows: only the service role writes them --------------------------
drop policy if exists "Providers can insert their payments" on public.provider_payments;
drop policy if exists "Providers can update their payments" on public.provider_payments;

drop policy if exists "Providers can create withdrawals" on public.provider_withdrawals;
drop policy if exists "Providers can update their withdrawals" on public.provider_withdrawals;

-- 6) business_categories: read-only for the app --------------------------------
drop policy if exists business_categories_update on public.business_categories;
drop policy if exists business_categories_delete on public.business_categories;

-- 7) locations: only a professional may publish a venue ----------------------
drop policy if exists authenticated_insert_locations on public.locations;

create policy authenticated_insert_locations
  on public.locations
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.providers p
       where p.user_id = auth.uid()
    )
  );

-- 8) provider_locations: drop the policies that can never match ---------------
drop policy if exists providers_insert_own_location on public.provider_locations;
drop policy if exists providers_read_own_location on public.provider_locations;
drop policy if exists providers_update_own_location on public.provider_locations;
