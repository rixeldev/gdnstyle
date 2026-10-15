-- ============================================================================
-- GDN Style — payment lifecycle, refunds and storefront tables
-- ============================================================================
-- Safe to run repeatedly: every step checks existence first, so it works on
-- databases that already have some (or all) of these objects from the live
-- Edge Functions. Apply with `supabase db push` or the SQL editor.
--
-- What this migration does:
--   1. Appointments: adds the payment/refund lifecycle columns used by the
--      app (payment_status pending → released → refunded, plus refund
--      request tracking) when they are missing.
--   2. profiles/providers: adds the Stripe customer columns the payment
--      functions write, when missing.
--   3. provider_payments / provider_withdrawals: adds missing columns that
--      the webhooks and withdrawal flow read/write.
--   4. Storefront tables (checkout_sessions, orders, cj_access_tokens) and
--      provider_portfolio: creates the minimal shape the deployed functions
--      expect when the tables are missing.
--   5. Row level security: read access to the catalog tables the app needs.
--   6. RPCs: `request_appointment_cancellation` (client) and
--      `confirm_appointment` (professional), SECURITY DEFINER functions with
--      their own ownership checks for the two new appointment writes.
-- ============================================================================

-- 1) Appointments payment/refund lifecycle -----------------------------------

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.providers add column if not exists stripe_customer_id text;

do $$
begin
  -- Only touch appointments when it exists (a fresh DB without 0001-era
  -- tables should not fail the whole migration).
  if to_regclass('public.appointments') is not null then
    execute $sql$ alter table public.appointments add column if not exists payment_status text $sql$;
    execute $sql$ alter table public.appointments add column if not exists payment_id text $sql$;
    execute $sql$ alter table public.appointments add column if not exists stripe_session_id text $sql$;
    execute $sql$ alter table public.appointments add column if not exists amount_paid numeric $sql$;
    execute $sql$ alter table public.appointments add column if not exists refund_status text $sql$;
    execute $sql$ alter table public.appointments add column if not exists refund_reason text $sql$;
    execute $sql$ alter table public.appointments add column if not exists refund_requested_at timestamptz $sql$;
    execute $sql$ alter table public.appointments add column if not exists refund_resolved_at timestamptz $sql$;

    -- Normalise legacy rows: 'paid' appointments behave like released money.
    execute $sql$
      update public.appointments
      set payment_status = 'released'
      where payment_status is null and payment_id is not null
    $sql$;
    execute $sql$
      update public.appointments
      set refund_status = 'none'
      where refund_status is null
    $sql$;
  end if;
end $$;

-- 2) provider_payments / provider_withdrawals --------------------------------

do $$
begin
  if to_regclass('public.provider_payments') is not null then
    execute $sql$ alter table public.provider_payments add column if not exists id uuid $sql$;
    execute $sql$ alter table public.provider_payments alter column id set default gen_random_uuid() $sql$;
    execute $sql$ alter table public.provider_payments alter column id set not null $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists provider_id uuid $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists appointment_id uuid $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists payment_intent_id text $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists transfer_id text $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists refund_id text $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists amount numeric not null default 0 $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists platform_fee numeric not null default 0 $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists status text not null default 'pending_transfer' $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists refunded_at timestamptz $sql$;
    execute $sql$ alter table public.provider_payments add column if not exists created_at timestamptz not null default now() $sql$;
    execute $sql$ create index if not exists provider_payments_appointment_id_idx on public.provider_payments (appointment_id) $sql$;
    execute $sql$ create index if not exists provider_payments_payment_intent_id_idx on public.provider_payments (payment_intent_id) $sql$;
    execute $sql$ create index if not exists provider_payments_provider_id_idx on public.provider_payments (provider_id) $sql$;
  end if;

  if to_regclass('public.provider_withdrawals') is not null then
    execute $sql$ alter table public.provider_withdrawals add column if not exists id uuid $sql$;
    execute $sql$ alter table public.provider_withdrawals alter column id set default gen_random_uuid() $sql$;
    execute $sql$ alter table public.provider_withdrawals alter column id set not null $sql$;
    execute $sql$ alter table public.provider_withdrawals add column if not exists provider_id uuid $sql$;
    execute $sql$ alter table public.provider_withdrawals add column if not exists amount numeric not null default 0 $sql$;
    execute $sql$ alter table public.provider_withdrawals add column if not exists stripe_payout_id text $sql$;
    execute $sql$ alter table public.provider_withdrawals add column if not exists status text not null default 'pending' $sql$;
    execute $sql$ alter table public.provider_withdrawals add column if not exists requested_at timestamptz $sql$;
    execute $sql$ alter table public.provider_withdrawals add column if not exists created_at timestamptz not null default now() $sql$;
    execute $sql$ create index if not exists provider_withdrawals_provider_id_idx on public.provider_withdrawals (provider_id) $sql$;
  end if;
end $$;

-- 3) Storefront tables the shop functions expect -----------------------------

create table if not exists public.checkout_sessions (
  stripe_session_id        text primary key,
  stripe_payment_intent_id text,
  user_id                  uuid,
  cart_items               jsonb not null default '[]'::jsonb,
  shipping_info            jsonb not null default '{}'::jsonb,
  total                    numeric not null default 0,
  status                   text not null default 'pending',
  created_at               timestamptz not null default now(),
  completed_at             timestamptz
);

create table if not exists public.orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid,
  stripe_payment_intent_id text,
  cart_items               jsonb not null default '[]'::jsonb,
  shipping_info            jsonb not null default '{}'::jsonb,
  total                    numeric not null default 0,
  status                   text not null default 'pending_fulfillment',
  cj_order_id              text,
  cj_tracking_number       text,
  cj_order_data            jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists public.cj_access_tokens (
  id           integer primary key default 1,
  access_token text,
  expires_at   timestamptz,
  updated_at   timestamptz not null default now()
);

create table if not exists public.provider_portfolio (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null,
  image_url       text not null,
  title           text,
  description     text,
  likes_count     integer not null default 0,
  comments_count  integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists provider_portfolio_provider_id_idx
  on public.provider_portfolio (provider_id);

-- 4) Row level security for the tables the browser reads ---------------------

alter table public.orders enable row level security;
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid());

alter table public.provider_portfolio enable row level security;
drop policy if exists "portfolio_public_select" on public.provider_portfolio;
create policy "portfolio_public_select"
  on public.provider_portfolio for select
  using (true);
drop policy if exists "portfolio_insert_own" on public.provider_portfolio;
create policy "portfolio_insert_own"
  on public.provider_portfolio for insert
  to authenticated
  with check (provider_id = auth.uid());
drop policy if exists "portfolio_update_own" on public.provider_portfolio;
create policy "portfolio_update_own"
  on public.provider_portfolio for update
  to authenticated
  using (provider_id = auth.uid());
drop policy if exists "portfolio_delete_own" on public.provider_portfolio;
create policy "portfolio_delete_own"
  on public.provider_portfolio for delete
  to authenticated
  using (provider_id = auth.uid());

-- Shop catalog: public read of purchasable products (the storefront page).
do $$
begin
  if to_regclass('public.products') is not null then
    execute $sql$ alter table public.products enable row level security $sql$;
    execute $sql$
      drop policy if exists "products_public_select" on public.products
    $sql$;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products'
        and column_name = 'available_for_sale'
    ) then
      execute $sql$
        create policy "products_public_select"
          on public.products for select
          using (coalesce(available_for_sale, true))
      $sql$;
    else
      execute $sql$
        create policy "products_public_select"
          on public.products for select
          using (true)
      $sql$;
    end if;
  end if;
end $$;

-- 5) Authorised RPCs for the two new appointment writes -----------------------
-- The browser cancels (client) and confirms (professional) appointments
-- through these SECURITY DEFINER functions instead of relying on unknown
-- per-column RLS: ownership is checked inside and only the specific columns
-- of the lifecycle are ever written. The app falls back to a direct update
-- when the function does not exist yet (migration not applied).

create or replace function public.request_appointment_cancellation(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client  uuid;
  v_payment text;
  v_refund  text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select client_id,
         coalesce(payment_status, ''),
         coalesce(refund_status, '')
    into v_client, v_payment, v_refund
    from public.appointments
   where id = p_id;

  if v_client is null or v_client <> auth.uid() then
    raise exception 'appointment not found';
  end if;

  -- Paid money already captured → keep the row and open a refund request.
  if v_payment in ('pending', 'released', 'paid') and v_refund <> 'approved' then
    update public.appointments
       set status = 'cancelled',
           cancelled_at = now(),
           refund_status = 'requested',
           refund_requested_at = now()
     where id = p_id;
    return 'refund-requested';
  end if;

  update public.appointments
     set status = 'cancelled',
         cancelled_at = now()
   where id = p_id;

  return 'cancelled';
end;
$$;

revoke execute on function public.request_appointment_cancellation(uuid) from public, anon;
grant execute on function public.request_appointment_cancellation(uuid) to authenticated;

create or replace function public.confirm_appointment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select id into v_provider
    from public.providers
   where user_id = auth.uid();

  if v_provider is null then
    raise exception 'provider not found';
  end if;

  -- Confirming releases a pending payment (the visible "completed" step).
  update public.appointments
     set status = 'confirmed',
         payment_status = case
           when coalesce(payment_status, '') = 'pending' then 'released'
           else payment_status
         end
   where id = p_id
     and provider_id = v_provider;
end;
$$;

revoke execute on function public.confirm_appointment(uuid) from public, anon;
grant execute on function public.confirm_appointment(uuid) to authenticated;
