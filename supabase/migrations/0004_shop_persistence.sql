-- ============================================================================
-- 0004 — Persistencia de la tienda:
--   * shipping_addresses: libreta de direcciones de envío por usuario.
--   * shop_cart_items:    carrito en servidor (espejo del localStorage).
--
-- Requiere 0003 (catálogo products con RLS). Idempotente: se puede re-ejecutar
-- desde el SQL Editor sin daño.
-- ============================================================================

-- 1) Direcciones de envío guardadas ------------------------------------------

create table if not exists public.shipping_addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  phone       text not null,
  address     text not null,
  city        text not null,
  country     text not null default 'NY',
  postal_code text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists shipping_addresses_user_id_idx
  on public.shipping_addresses (user_id);

alter table public.shipping_addresses enable row level security;
drop policy if exists "shipping_addresses_select_own" on public.shipping_addresses;
create policy "shipping_addresses_select_own"
  on public.shipping_addresses for select
  to authenticated
  using (user_id = auth.uid());
drop policy if exists "shipping_addresses_insert_own" on public.shipping_addresses;
create policy "shipping_addresses_insert_own"
  on public.shipping_addresses for insert
  to authenticated
  with check (user_id = auth.uid());
drop policy if exists "shipping_addresses_update_own" on public.shipping_addresses;
create policy "shipping_addresses_update_own"
  on public.shipping_addresses for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "shipping_addresses_delete_own" on public.shipping_addresses;
create policy "shipping_addresses_delete_own"
  on public.shipping_addresses for delete
  to authenticated
  using (user_id = auth.uid());

-- 2) Carrito en servidor (espejo del carrito local cuando hay sesión) -------

create table if not exists public.shop_cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null,
  quantity   integer not null default 1 check (quantity > 0),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- `products.id` es uuid en el 99% de los casos; la FK se adjunta solo si el
-- catálogo realmente usa uuid, para que la migración nunca rompa.
do $$
declare id_type text;
begin
  select data_type into id_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
      and column_name = 'id';

  if id_type = 'uuid' and not exists (
    select 1 from pg_constraint where conname = 'shop_cart_items_product_id_fkey'
  ) then
    execute $sql$
      alter table public.shop_cart_items
        add constraint shop_cart_items_product_id_fkey
        foreign key (product_id) references public.products (id) on delete cascade
    $sql$;
  end if;
end $$;

create index if not exists shop_cart_items_user_id_idx
  on public.shop_cart_items (user_id);

alter table public.shop_cart_items enable row level security;
drop policy if exists "shop_cart_select_own" on public.shop_cart_items;
create policy "shop_cart_select_own"
  on public.shop_cart_items for select
  to authenticated
  using (user_id = auth.uid());
drop policy if exists "shop_cart_insert_own" on public.shop_cart_items;
create policy "shop_cart_insert_own"
  on public.shop_cart_items for insert
  to authenticated
  with check (user_id = auth.uid());
drop policy if exists "shop_cart_update_own" on public.shop_cart_items;
create policy "shop_cart_update_own"
  on public.shop_cart_items for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "shop_cart_delete_own" on public.shop_cart_items;
create policy "shop_cart_delete_own"
  on public.shop_cart_items for delete
  to authenticated
  using (user_id = auth.uid());
