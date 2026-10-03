-- =============================================================================
-- GEEZMART — 0004 orders, payments, shipping, coupons
-- Order -> customer -> items -> payment -> delivery
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shipping zones and rates (per-region fees and ETAs)
-- ---------------------------------------------------------------------------
create table if not exists public.shipping_zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,        -- "Lagos", "Other States", "Pickup"
  kind        public.fulfilment_method not null default 'home_delivery',
  states      text[] not null default '{}',-- Nigerian states covered
  fee         numeric(12,2) not null default 0 check (fee >= 0),
  free_over   numeric(12,2) check (free_over is null or free_over >= 0),
  eta_min_days int not null default 1 check (eta_min_days >= 0),
  eta_max_days int not null default 3 check (eta_max_days >= 0),
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.shipping_rates (
  id          uuid primary key default gen_random_uuid(),
  zone_id     uuid not null references public.shipping_zones(id) on delete cascade,
  name        text not null,
  description text not null default '',
  price       numeric(12,2) not null check (price >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists shipping_rates_zone_idx on public.shipping_rates (zone_id);

-- ---------------------------------------------------------------------------
-- Coupons / discounts
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  description       text not null default '',
  kind              public.discount_kind not null default 'percentage',
  value             numeric(12,2) not null default 0 check (value >= 0),
  max_discount      numeric(12,2) check (max_discount is null or max_discount >= 0),
  min_order_value   numeric(12,2) not null default 0 check (min_order_value >= 0),
  usage_limit       int check (usage_limit is null or usage_limit > 0),
  used_count        int not null default 0 check (used_count >= 0),
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  starts_at         timestamptz,
  expires_at        timestamptz,
  active            boolean not null default true,
  -- optional scoping
  category_ids      uuid[] not null default '{}',
  product_ids       uuid[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint coupon_window_valid check (
    starts_at is null or expires_at is null or expires_at > starts_at
  )
);
create index if not exists coupons_active_idx on public.coupons (active, expires_at);

-- The single source of truth for "can this coupon be used right now?".
create or replace function public.coupon_is_valid(p_code text, p_subtotal numeric, p_customer uuid)
returns table (valid boolean, reason text, discount numeric)
language plpgsql
stable
as $$
declare
  c public.coupons%rowtype;
  v_discount numeric := 0;
  v_used_by_customer int := 0;
begin
  select * into c from public.coupons where upper(code) = upper(p_code);
  if c.id is null then return query select false, 'Invalid coupon code.', 0::numeric; return; end if;
  if not c.active then return query select false, 'This coupon is no longer active.', 0::numeric; return; end if;
  if c.starts_at is not null and c.starts_at > now() then return query select false, 'This coupon is not active yet.', 0::numeric; return; end if;
  if c.expires_at is not null and c.expires_at < now() then return query select false, 'This coupon has expired.', 0::numeric; return; end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then return query select false, 'This coupon has reached its usage limit.', 0::numeric; return; end if;
  if p_subtotal < c.min_order_value then return query select false, 'Order does not meet the minimum spend for this coupon.', 0::numeric; return; end if;

  if p_customer is not null and c.per_customer_limit is not null then
    select count(*) into v_used_by_customer
      from public.coupon_redemptions r
      join public.orders o on o.id = r.order_id
     where r.coupon_id = c.id and o.customer_id = p_customer;
    if v_used_by_customer >= c.per_customer_limit then
      return query select false, 'You have already used this coupon.', 0::numeric;
      return;
    end if;
  end if;

  if c.kind = 'percentage' then
    v_discount := round(p_subtotal * c.value / 100, 2);
    if c.max_discount is not null then v_discount := least(v_discount, c.max_discount); end if;
  elsif c.kind = 'fixed_amount' then
    v_discount := least(c.value, p_subtotal);
  else
    v_discount := 0; -- free delivery handled by caller
  end if;

  return query select true, ''::text, v_discount;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkout sessions: the durable 4-step checkout the storefront talks to.
-- ---------------------------------------------------------------------------
create table if not exists public.checkout_sessions (
  id            uuid primary key default gen_random_uuid(),
  cart_id       uuid references public.carts(id) on delete set null,
  customer_id   uuid references public.profiles(id) on delete set null,
  session_token text,

  current_step  int not null default 1 check (current_step between 1 and 4),

  -- Step 1: delivery information
  full_name     text not null default '',
  phone         text not null default '',
  email         text not null default '',
  address       text not null default '',
  city          text not null default '',
  state         text not null default '',

  -- Step 2: delivery method
  fulfilment_method public.fulfilment_method not null default 'home_delivery',
  shipping_zone_id  uuid references public.shipping_zones(id) on delete set null,

  -- Step 3: payment
  payment_method     public.payment_method_kind not null default 'card',
  payment_reference  text not null default '',

  -- Step 4: review
  subtotal           numeric(12,2) not null default 0,
  delivery_fee       numeric(12,2) not null default 0,
  discount           numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  coupon_code        text,

  -- Lifecycle
  completed         boolean not null default false,
  completed_at      timestamptz,
  order_id          uuid,
  -- Analytics: how long the customer actually took
  started_at        timestamptz not null default now(),
  last_active_at    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists checkout_sessions_open_idx
  on public.checkout_sessions (last_active_at desc) where not completed;
create index if not exists checkout_sessions_token_idx on public.checkout_sessions (session_token);

create trigger trg_checkout_sessions_updated_at
  before update on public.checkout_sessions
  for each row execute function public.set_updated_at();

-- Advancing a step is a strong abandonment signal.
create or replace function public.track_checkout_progress()
returns trigger
language plpgsql
as $$
declare
  v_stage public.abandoned_stage;
begin
  v_stage := case
    when new.current_step <= 1 then 'checkout_step_1'::public.abandoned_stage
    when new.current_step = 2 then 'checkout_step_2'::public.abandoned_stage
    when new.current_step = 3 then 'payment_pending'::public.abandoned_stage
    else 'payment_pending'::public.abandoned_stage
  end;

  if new.cart_id is not null then
    update public.abandoned_checkouts
       set stage         = v_stage,
           furthest_step = greatest(furthest_step, new.current_step),
           full_name     = coalesce(nullif(new.full_name, ''), full_name),
           email         = coalesce(nullif(new.email, ''), email),
           phone         = coalesce(nullif(new.phone, ''), phone),
           address       = coalesce(nullif(new.address, ''), address),
           city          = coalesce(nullif(new.city, ''), city),
           state         = coalesce(nullif(new.state, ''), state),
           fulfilment_method = new.fulfilment_method,
           payment_method    = new.payment_method,
           updated_at    = now()
     where cart_id = new.cart_id and recovered = false;
  end if;
  return new;
end;
$$;

create trigger trg_checkout_progress
  after insert or update on public.checkout_sessions
  for each row execute function public.track_checkout_progress();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  reference     text unique default public.next_order_reference(),
  cart_id       uuid references public.carts(id) on delete set null,
  customer_id   uuid references public.profiles(id) on delete set null,
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',

  -- Delivery snapshot (denormalised: orders must survive address edits)
  fulfilment_method public.fulfilment_method not null default 'home_delivery',
  address       text not null default '',
  city          text not null default '',
  state         text not null default '',
  shipping_zone_id uuid references public.shipping_zones(id) on delete set null,

  subtotal      numeric(12,2) not null default 0,
  delivery_fee  numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,

  coupon_code   text,
  coupon_id     uuid references public.coupons(id) on delete set null,

  status        public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  payment_method public.payment_method_kind not null default 'card',

  note          text not null default '',
  cancel_reason text not null default '',

  placed_at     timestamptz not null default now(),
  delivered_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint order_totals_consistent check (total = subtotal + delivery_fee - discount)
);

create index if not exists orders_customer_idx on public.orders (customer_id, placed_at desc);
create index if not exists orders_status_idx   on public.orders (status, placed_at desc);
create index if not exists orders_placed_idx   on public.orders (placed_at desc);
create index if not exists orders_reference_trgm on public.orders using gin (reference gin_trgm_ops);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Order lines keep price/name at purchase time.
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  variant_id   uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_title text not null default '',
  sku          text not null default '',
  image_url    text,
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  quantity     int not null check (quantity > 0),
  line_total   numeric(12,2) not null check (line_total >= 0),
  created_at   timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- Immutable status history; also powers the customer tracking page.
create table if not exists public.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     public.order_status not null,
  note       text not null default '',
  changed_by uuid,
  changed_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists order_history_order_idx
  on public.order_status_history (order_id, created_at);

create or replace function public.record_order_status_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.order_status_history (order_id, status, note)
  values (new.id, new.status,
          case when new.status = 'delivered' then 'Delivered' else '' end);

  if new.status = 'delivered' and new.delivered_at is null then
    new.delivered_at = now();
  end if;

  return new;
end;
$$;

create trigger trg_order_status_history
  before insert or update of status on public.orders
  for each row execute function public.record_order_status_change();

-- Customer lifetime aggregates.
create or replace function public.update_customer_totals()
returns trigger
language plpgsql
as $$
begin
  update public.profiles
     set order_count   = order_count + 1,
         total_spent   = total_spent + new.total,
         last_order_at = new.placed_at
   where id = new.customer_id;

  insert into public.coupon_redemptions (coupon_id, order_id, customer_id, amount)
  select new.coupon_id, new.id, new.customer_id, new.discount
  where new.coupon_id is not null;

  return new;
end;
$$;

create trigger trg_orders_customer_totals
  after insert on public.orders
  for each row execute function public.update_customer_totals();

-- Coupons count only COMPLETED (non-cancelled) orders.
create or replace function public.refresh_coupon_usage()
returns trigger
language plpgsql
as $$
begin
  if new.coupon_id is not null then
    update public.coupons
       set used_count = (
         select count(*) from public.orders
          where coupon_id = new.coupon_id
            and status not in ('cancelled','refunded')
       )
     where id = new.coupon_id;
  end if;
  return new;
end;
$$;

create trigger trg_orders_coupon_usage
  after insert or update of status on public.orders
  for each row execute function public.refresh_coupon_usage();

create table if not exists public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  customer_id uuid references public.profiles(id) on delete set null,
  amount      numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);

-- ---------------------------------------------------------------------------
-- Payments (one row per attempt; an order may have several)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  method       public.payment_method_kind not null,
  amount       numeric(12,2) not null check (amount >= 0),
  status       public.payment_status not null default 'pending',
  reference    text not null default '',      -- provider txn id
  provider     text not null default '',
  -- Raw provider payload for reconciliation. NEVER trust client amounts.
  raw_response jsonb not null default '{}'::jsonb,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments (order_id, created_at desc);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create or replace function public.sync_order_payment_status()
returns trigger
language plpgsql
as $$
begin
  update public.orders o
     set payment_status = (
       select case
                when bool_or(p.status = 'paid') then 'paid'::public.payment_status
                when bool_or(p.status in ('partially_refunded','refunded')) then 'refunded'::public.payment_status
                when bool_or(p.status = 'failed') then 'failed'::public.payment_status
                else 'pending'::public.payment_status
              end
       from public.payments p
       where p.order_id = o.id
     )
   where o.id = new.order_id;
  return new;
end;
$$;

create trigger trg_payments_sync_order
  after insert or update of status on public.payments
  for each row execute function public.sync_order_payment_status();

-- ---------------------------------------------------------------------------
-- Shipments / tracking
-- ---------------------------------------------------------------------------
create table if not exists public.shipments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.orders(id) on delete cascade,
  carrier        text not null default '',
  tracking_number text not null default '',
  tracking_url   text not null default '',
  status         public.order_status not null default 'processing',
  shipped_at     timestamptz,
  estimated_delivery timestamptz,
  delivered_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_shipments_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

-- Close the abandoned-checkout row once the order exists (pairs with 0003).
create or replace function public.close_abandoned_on_order()
returns trigger
language plpgsql
as $$
begin
  if new.cart_id is not null then
    update public.abandoned_checkouts
       set recovered         = true,
           recovered_at      = now(),
           recovered_order_id = new.id
     where cart_id = new.cart_id and recovered = false;
  end if;
  return new;
end;
$$;

create trigger trg_orders_close_abandoned
  after insert on public.orders
  for each row execute function public.close_abandoned_on_order();

-- Sell stock atomically when an order is placed (never on the client).
create or replace function public.reserve_stock_for_order(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select oi.variant_id, oi.product_id, oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id
  loop
    if r.variant_id is not null then
      update public.inventory
         set quantity_reserved = quantity_reserved + r.quantity
       where product_id = r.product_id and variant_id = r.variant_id;
    else
      update public.inventory
         set quantity_reserved = quantity_reserved + r.quantity
       where product_id = r.product_id and variant_id is null;
    end if;
  end loop;
end;
$$;

-- Discount display helper used by the storefront.
create or replace function public.effective_price(p_product public.products)
returns numeric
language plpgsql
stable
as $$
declare
  now_ts timestamptz := now();
begin
  if p_product.sale_price is not null
     and (p_product.sale_start is null or p_product.sale_start <= now_ts)
     and (p_product.sale_end   is null or p_product.sale_end   >= now_ts)
     and p_product.sale_price < p_product.price then
    return p_product.sale_price;
  end if;
  return p_product.price;
end;
$$;

create or replace view public.storefront_catalog as
select
  p.id, p.name, p.slug, p.sku, p.short_description, p.description,
  public.effective_price(p) as price,
  p.compare_at_price,
  b.name as brand,
  c.name as category, c.slug as category_slug,
  sc.name as subcategory,
  p.rating_avg, p.rating_count, p.featured, p.trending, p.is_new_drop, p.mens_pick,
  coalesce(
    (select json_agg(json_build_object('url', pi.url, 'alt', pi.alt_text) order by pi.position)
       from public.product_images pi where pi.product_id = p.id),
    '[]'::json
  ) as images,
  coalesce(
    (select sum(i.quantity_on_hand - i.quantity_reserved)
       from public.inventory i where i.product_id = p.id),
    0
  ) as stock
from public.products p
left join public.brands b     on b.id = p.brand_id
left join public.categories c  on c.id = p.category_id
left join public.categories sc on sc.id = p.subcategory_id
where p.status = 'published';

-- Realtime needs the tables registered for publication.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
exception when duplicate_object then null;
end $$;

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.inventory;
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.abandoned_checkouts;
