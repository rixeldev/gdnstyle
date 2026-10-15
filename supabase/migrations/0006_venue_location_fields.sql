-- ============================================================================
-- GDN Style — venue address fields and owner photo upload
-- ============================================================================
-- Safe to run repeatedly: every step checks existence first, so it works on
-- databases that already have some (or all) of these objects from the live
-- project. Apply with `supabase db push` or the SQL editor.
--
-- What this migration does:
--   1. locations.postal_code: the venue form now collects a full US address
--      (address, city, state, country), and the ZIP had nowhere to go. It may
--      already exist if it was added from the dashboard -- hence `if not
--      exists` rather than assuming either case.
--   2. locations UPDATE for the owner: the address used to be write-once.
--      Insert was allowed and SELECT is public, but no UPDATE policy existed,
--      so a professional could publish a venue and never correct its address,
--      its photos or its name afterwards. `locations` has no owner column of
--      its own -- ownership lives in `provider_locations` -- so the policy
--      reads it through `providers.user_id = auth.uid()`.
--   3. storage.objects INSERT for venue photos: the form uploads a custom
--      photo from the browser into the public `portfolio` bucket (the one
--      marketplace photos already come from, allow-listed for next/image in
--      next.config.ts), under `venues/<provider id>/`.
--
-- Only INSERT is granted on storage: a new photo is always a new object, so
-- nothing is overwritten and nothing needs DELETE. Existing policies are left
-- alone -- Supabase ORs the policies of a role, so an added one can only widen
-- access for the case it describes, never break another.

-- 1. Column -----------------------------------------------------------------
alter table public.locations
  add column if not exists postal_code text;

comment on column public.locations.postal_code is
  'ZIP / postal code of the venue address, edited in the venue form.';

-- 2. Owner update ------------------------------------------------------------
drop policy if exists "locations_update_owner" on public.locations;

create policy "locations_update_owner"
  on public.locations
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.provider_locations link
        join public.providers provider on provider.id = link.provider_id
       where link.location_id = locations.id
         and provider.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.provider_locations link
        join public.providers provider on provider.id = link.provider_id
       where link.location_id = locations.id
         and provider.user_id = auth.uid()
    )
  );

-- 3. Venue photo uploads -----------------------------------------------------
drop policy if exists "venue_images_insert_own" on storage.objects;

create policy "venue_images_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = 'venues'
    and owner = auth.uid()
  );
