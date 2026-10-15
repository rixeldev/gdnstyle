-- ============================================================================
-- GDN Style — roles catalog, DB-backed role assignment, richer signup
-- ============================================================================
-- Safe to run whether or not 0001_init_profiles.sql was applied: every step
-- is idempotent. Apply with the Supabase CLI (`supabase db push`) or paste
-- the whole file into the SQL editor.
--
-- What this migration does:
--   1. Creates `public.roles` (customer / professional / admin) with the
--      permissions each role grants, readable by signed-in visitors.
--   2. Makes `profiles.role` a plain text foreign key into that catalog
--      (converting the 0001 enum when present) so the database — not the
--      frontend — owns role assignment.
--   3. Recreates `handle_new_user` so signup validates the requested role
--      against the catalog, stores the extra signup data (phone, city,
--      socials) and creates the `providers` row for professionals up front.
--   4. Backfills existing professionals (users that already own a providers
--      row) to role = 'professional'.
-- ============================================================================

-- 1) Roles catalog -----------------------------------------------------------

create table if not exists public.roles (
  key         text primary key,
  name        text not null,
  permissions text[] not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.roles enable row level security;

-- Signed-in visitors may read the catalog (labels + permission checks);
-- writes are reserved for the service role (no policy = no client access).
drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
  on public.roles for select
  to authenticated
  using (true);

insert into public.roles (key, name, permissions) values
  ('customer', 'Cliente', array[
    'book_appointment',
    'cancel_appointment',
    'rebook_appointment',
    'manage_favorites',
    'write_review',
    'manage_payment_methods',
    'edit_profile'
  ]),
  ('professional', 'Profesional', array[
    'manage_venues',
    'manage_services',
    'manage_schedule',
    'view_appointments',
    'update_appointment_status',
    'edit_profile'
  ]),
  ('admin', 'Administración', array[
    'manage_users',
    'manage_roles',
    'manage_content',
    'view_reports'
  ])
on conflict (key) do update set
  name        = excluded.name,
  permissions = excluded.permissions;

-- 2) profiles: table, role column, catalog constraint ------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  phone      text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

alter table public.profiles add column if not exists role text;

-- 0001 created `role` as the user_role enum; convert it to plain text so it
-- can reference the roles catalog.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'role'
      and udt_name     = 'user_role'
  ) then
    alter table public.profiles alter column role drop default;
    alter table public.profiles alter column role type text using role::text;
  end if;
end $$;

alter table public.profiles alter column role set default 'customer';
update public.profiles set role = 'customer' where role is null;
alter table public.profiles alter column role set not null;

-- Pre-catalog rows may use legacy names ('client', 'provider') or arbitrary
-- values; map the known aliases and force anything the catalog doesn't know
-- to 'customer' so the foreign key below always holds.
update public.profiles p
set role = case
  when p.role = 'client'   then 'customer'
  when p.role = 'provider' then 'professional'
  when exists (select 1 from public.roles r where r.key = p.role) then p.role
  else 'customer'
end
where p.role not in (select key from public.roles);

-- Unknown roles are rejected by the database itself from now on.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_fkey
      foreign key (role) references public.roles (key)
      on update cascade on delete restrict;
  end if;
end $$;

-- Self-service profile policies (kept in sync with 0001 for databases that
-- never applied it).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3) Signup trigger: validated role + full professional record ---------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
  display_name   text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );
  signup_phone   text := nullif(new.raw_user_meta_data ->> 'phone', '');
begin
  -- A malformed or unknown role name never casts and never blocks signup.
  if not exists (select 1 from public.roles r where r.key = requested_role) then
    requested_role := 'customer';
  end if;

  insert into public.profiles (id, email, full_name, phone, role)
  values (new.id, new.email, display_name, signup_phone, requested_role)
  on conflict (id) do nothing;

  -- A professional owns a providers row from day one (full_name/email are
  -- NOT NULL there), so the role is real data, not an frontend inference.
  if requested_role = 'professional' then
    begin
      insert into public.providers (user_id, full_name, email, phone, address_city, social_instagram, social_tiktok)
      select
        new.id,
        display_name,
        new.email,
        signup_phone,
        nullif(new.raw_user_meta_data ->> 'city', ''),
        nullif(new.raw_user_meta_data ->> 'instagram', ''),
        nullif(new.raw_user_meta_data ->> 'tiktok', '')
      where not exists (
        select 1 from public.providers p where p.user_id = new.id
      );
    exception when others then
      -- Never let a directory hiccup abort the account itself.
      raise warning 'providers row not created for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Backfill: users that already own a providers row are professionals ------

update public.profiles p
set role = 'professional'
from public.providers pv
where pv.user_id = p.id
  and p.role <> 'professional';

-- 5) Retire the enum type when nothing references it anymore -----------------

do $$
begin
  begin
    drop type if exists public.user_role;
  exception when dependent_objects_still_exist then
    raise notice 'user_role enum is still referenced; left in place';
  end;
end $$;
