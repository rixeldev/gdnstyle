-- ============================================================================
-- GDN Style — roles, profiles and row-level security
-- ============================================================================
-- Apply this migration once, either with the Supabase CLI:
--     supabase db push
-- or by pasting it in the Supabase SQL editor.
--
-- Requirements before running it:
--   * Auth > Providers > Email must be enabled.
--   * Auth > URL Configuration > Site URL should point to the app origin so
--     verification emails return correctly (see /auth/callback).
-- ============================================================================

create type public.user_role as enum ('customer', 'professional');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null default 'customer',
  full_name  text,
  email      text,
  phone      text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can only read/insert/update their own profile row.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
-- The role comes from `options.data.role` sent by the sign-up form and
-- defaults to 'customer'. A malformed role name never casts: it falls back.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    case
      when new.raw_user_meta_data ->> 'role' = 'professional' then 'professional'::public.user_role
      else 'customer'::public.user_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();