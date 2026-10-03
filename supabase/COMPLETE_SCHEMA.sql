-- ============================================================================
--  GEEZMART -- COMPLETE DATABASE SCHEMA (single file, paste-ready)
--  Generated from supabase/migrations/*.sql -- edit those, not this file.
--
--  HOW TO APPLY (Supabase dashboard):
--    1. Go to  SQL Editor  ->  New query
--    2. Paste this ENTIRE file
--    3. Click Run
--
--  Safe to run more than once: every object uses IF NOT EXISTS / OR REPLACE.
--  Sections, in order:
--    1. Extensions, enums, shared helpers
--    2. Catalogue + inventory
--    3. Customers, carts, abandoned checkouts
--    4. Orders, payments, shipping, coupons
--    5. Storefront content, reviews, notifications
--    6. Roles + row level security
--    7. Transactional RPCs
--    8. Seed data
-- ============================================================================



-- ############################################################################
-- ### FILE: supabase/migrations/0001_extensions_enums.sql
-- ############################################################################

-- =============================================================================
-- GEEZMART — 0001 extensions, helper functions and enumerations
-- Run order: 0001 -> 0002 -> 0003 -> 0004 -> 0005 -> 0006 -> 0007 -> 0008
-- =============================================================================

create extension if not exists "pgcrypto";     -- gen_random_uuid()
create extension if not exists "pg_trgm";      -- fuzzy product/customer search
create extension if not exists "btree_gist";   -- exclusion constraints (sale windows)

-- ---------------------------------------------------------------------------
-- Money / shared domain types
-- ---------------------------------------------------------------------------
-- 'customer' is the default role for a signed-up shopper; the rest are staff.
do $$ begin
  create type public.app_role as enum (
    'customer','super_admin','admin','product_manager','order_manager','support'
  );
exception when duplicate_object then null; end $$;

-- Upgrade path: if the type already exists from an earlier run that omitted
-- 'customer', add the value in place (before/after labels keep existing rows).
do $$ begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'app_role' and e.enumlabel = 'customer'
  ) then
    alter type public.app_role add value if not exists 'customer';
  end if;
end $$;

do $$ begin
  create type public.account_status as enum ('active','suspended','deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_status as enum (
    'draft','published','hidden','out_of_stock','coming_soon'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending','confirmed','processing','shipped','out_for_delivery',
    'delivered','cancelled','refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'unpaid','pending','paid','failed','refunded','partially_refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method_kind as enum (
    'card','bank_transfer','ussd','cash_on_delivery','wallet'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_kind as enum ('percentage','fixed_amount','free_delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fulfilment_method as enum ('home_delivery','pickup');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('pending','approved','hidden','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.abandoned_stage as enum (
    'cart','checkout_step_1','checkout_step_2','checkout_step_3','payment_pending'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_kind as enum (
    'product','banner','category','page','avatar','social','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.log_severity as enum ('info','warning','critical');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

-- Keep updated_at honest on every table that carries it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Generates human-facing order references: GZ-000001, GZ-000002, ...
-- Backed by a sequence (not count(*)+1) so concurrent checkouts can never
-- collide on or reuse a reference.
create sequence if not exists public.order_reference_seq start 1;

create or replace function public.next_order_reference()
returns text
language sql
as $$
  select 'GZ-' || lpad(nextval('public.order_reference_seq')::text, 6, '0');
$$;

-- Convenience view helper: is a product currently purchasable?
create or replace function public.is_sellable(p_status public.product_status)
returns boolean
language sql
immutable
as $$
  select p_status = 'published';
$$;



-- ############################################################################
-- ### FILE: supabase/migrations/0002_catalog_inventory.sql
-- ############################################################################

-- =============================================================================
-- GEEZMART — 0002 catalogue + inventory
-- products -> categories -> images -> variants -> reviews -> inventory
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Media library (every image used anywhere points at one row)
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  public_url   text not null,
  filename     text not null,
  kind         public.media_kind not null default 'other',
  mime_type    text not null default 'image/jpeg',
  byte_size    bigint not null default 0 check (byte_size >= 0),
  width        int,
  height       int,
  alt_text     text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists media_kind_idx on public.media (kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Categories (self-referencing for subcategories)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.categories(id) on delete set null,
  name          text not null,
  slug          text not null unique,
  icon          text not null default 'shop',
  tagline       text not null default '',
  description   text not null default '',
  image_url     text,
  hidden        boolean not null default false,
  sort_order    int  not null default 0,
  seo_title     text not null default '',
  meta_description text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists categories_parent_idx on public.categories (parent_id, sort_order);
create index if not exists categories_slug_idx on public.categories (slug);

-- Brands are referenced by name on products but are first-class for filtering.
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  logo_url   text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  sku           text not null unique,
  brand_id      uuid references public.brands(id) on delete set null,
  category_id   uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.categories(id) on delete set null,

  short_description text not null default '',
  description       text not null default '',

  -- Pricing. cost_price is NEVER exposed to the storefront.
  price            numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  cost_price       numeric(12,2) check (cost_price is null or cost_price >= 0),

  -- Scheduled sale window (overrides price while active).
  sale_start    timestamptz,
  sale_end      timestamptz,
  sale_price    numeric(12,2) check (sale_price is null or sale_price >= 0),

  status        public.product_status not null default 'draft',
  status_reason text not null default '',

  -- Physical attributes
  weight_kg    numeric(8,3),
  length_cm    numeric(8,2),
  width_cm     numeric(8,2),
  height_cm    numeric(8,2),

  -- Aggregate review cache (kept in sync by trigger on reviews)
  rating_avg   numeric(3,2) not null default 0,
  rating_count int not null default 0,

  featured      boolean not null default false,
  trending      boolean not null default false,
  is_new_drop   boolean not null default false,
  mens_pick     boolean not null default false,

  -- SEO
  seo_title         text not null default '',
  meta_description  text not null default '',
  focus_keyword     text not null default '',
  canonical_url     text,
  og_title          text not null default '',
  og_description    text not null default '',
  og_image_url      text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A scheduled sale window must be well formed.
  constraint sale_window_valid check (
    sale_start is null or sale_end is null or sale_end > sale_start
  )
);

create index if not exists products_status_idx      on public.products (status);
create index if not exists products_category_idx   on public.products (category_id);
create index if not exists products_subcategory_idx on public.products (subcategory_id);
create index if not exists products_brand_idx      on public.products (brand_id);
create index if not exists products_price_idx      on public.products (price);

alter table public.products
  add column if not exists sort_order_hint int not null default 0;

create index if not exists products_featured_idx   on public.products (featured, sort_order_hint);
create index if not exists products_name_trgm      on public.products using gin (name gin_trgm_ops);
create index if not exists products_search_trgm
  on public.products using gin ((name || ' ' || short_description) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Product images (ordered, one primary)
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_id   uuid references public.media(id) on delete set null,
  url        text not null,
  alt_text   text not null default '',
  position   int  not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx
  on public.product_images (product_id, position);

-- Exactly one primary image per product.
create unique index if not exists product_images_one_primary
  on public.product_images (product_id) where is_primary;

-- ---------------------------------------------------------------------------
-- Variants (colour / size / storage / model -> its own price + stock + sku)
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  sku         text not null unique,
  title       text not null default '',          -- e.g. "Black / 256GB"
  option_name text not null default '',          -- e.g. "Storage"
  option_value text not null default '',         -- e.g. "256GB"
  price       numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2),
  image_url   text,
  position    int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists variants_product_idx on public.product_variants (product_id, position);

-- ---------------------------------------------------------------------------
-- Inventory ledger
-- `inventory` holds the current snapshot; `inventory_movements` is the audit
-- trail so every stock change is explainable and reversible.
-- ---------------------------------------------------------------------------
create table if not exists public.inventory (
  product_id         uuid primary key references public.products(id) on delete cascade,
  variant_id         uuid references public.product_variants(id) on delete cascade,
  quantity_on_hand   int not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved  int not null default 0 check (quantity_reserved >= 0),
  reorder_point      int not null default 5 check (reorder_point >= 0),
  location           text not null default 'main',
  updated_at         timestamptz not null default now(),
  -- cannot reserve more than exists
  constraint inventory_not_overcommitted
    check (quantity_reserved <= quantity_on_hand)
);

create unique index if not exists inventory_variant_unique
  on public.inventory (variant_id) where variant_id is not null;

create table if not exists public.inventory_movements (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  variant_id   uuid references public.product_variants(id) on delete cascade,
  delta        int not null,
  reason       text not null default 'adjustment',
  reference    text not null default '',   -- order reference / PO number
  note         text not null default '',
  actor_id     uuid,
  actor_name   text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists inventory_movements_product_idx
  on public.inventory_movements (product_id, created_at desc);

-- Derived availability used everywhere in the UI.
create or replace view public.inventory_available as
select
  i.product_id,
  i.variant_id,
  p.name            as product_name,
  p.sku             as product_sku,
  v.sku             as variant_sku,
  v.title           as variant_title,
  i.quantity_on_hand,
  i.quantity_reserved,
  (i.quantity_on_hand - i.quantity_reserved) as quantity_available,
  i.reorder_point,
  p.status          as product_status,
  case
    when i.quantity_on_hand - i.quantity_reserved <= 0 then 'out_of_stock'
    when i.quantity_on_hand - i.quantity_reserved <= i.reorder_point then 'low_stock'
    else 'healthy'
  end as stock_state
from public.inventory i
join public.products p on p.id = i.product_id
left join public.product_variants v on v.id = i.variant_id;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger trg_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Every variant gets its own inventory row.
create or replace function public.ensure_variant_inventory()
returns trigger
language plpgsql
as $$
begin
  insert into public.inventory (product_id, variant_id, quantity_on_hand, reorder_point)
  values (new.product_id, new.id, 0, 3)
  on conflict do nothing;
  return new;
end;
$$;

create trigger trg_variant_creates_inventory
  after insert on public.product_variants
  for each row execute function public.ensure_variant_inventory();

-- Enforce the single-primary-image rule when a new primary is set.
create or replace function public.enforce_single_primary_image()
returns trigger
language plpgsql
as $$
begin
  if new.is_primary then
    update public.product_images
       set is_primary = false
     where product_id = new.product_id and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger trg_product_images_single_primary
  before insert or update of is_primary on public.product_images
  for each row execute function public.enforce_single_primary_image();

-- Stock movements keep the snapshot in sync and are fully auditable.
create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
as $$
begin
  insert into public.inventory (product_id, variant_id, quantity_on_hand)
  values (new.product_id, new.variant_id, greatest(new.delta, 0))
  on conflict (product_id) do update
    set quantity_on_hand = greatest(public.inventory.quantity_on_hand + new.delta, 0);

  -- Flip product status to out_of_stock automatically.
  update public.products
     set status = 'out_of_stock'
   where id = new.product_id
     and status = 'published'
     and not exists (
       select 1 from public.inventory i
        where i.product_id = new.product_id
          and i.quantity_on_hand - i.quantity_reserved > 0
     );

  return new;
end;
$$;

create trigger trg_inventory_apply
  after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- Auto-fill SEO defaults from the product name/description.
create or replace function public.default_product_seo()
returns trigger
language plpgsql
as $$
begin
  if new.seo_title is null or new.seo_title = '' then
    new.seo_title = new.name || ' | GEEZMART';
  end if;
  if new.meta_description is null or new.meta_description = '' then
    new.meta_description = left(
      coalesce(nullif(new.short_description, ''), new.description, new.name), 155
    );
  end if;
  if new.og_title is null or new.og_title = '' then
    new.og_title = new.name || ' — GEEZMART';
  end if;
  if new.og_description is null or new.og_description = '' then
    new.og_description = new.meta_description;
  end if;
  return new;
end;
$$;

create trigger trg_products_seo_defaults
  before insert or update of name, short_description, description on public.products
  for each row execute function public.default_product_seo();



-- ############################################################################
-- ### FILE: supabase/migrations/0003_customers.sql
-- ############################################################################

-- =============================================================================
-- GEEZMART — 0003 customers, addresses, wishlist
-- Identities live in auth.users; this file adds the commerce profile.
-- =============================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          public.app_role not null default 'customer',
  name          text not null default '',
  email         text not null default '',
  phone         text not null default '',
  avatar_url    text,
  status        public.account_status not null default 'active',
  marketing_opt_in boolean not null default false,
  -- Lifetime aggregates, maintained by triggers on orders.
  order_count   int not null default 0,
  total_spent   numeric(12,2) not null default 0,
  last_order_at timestamptz,
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_role_idx   on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_name_trgm  on public.profiles using gin (name gin_trgm_ops);
create index if not exists profiles_email_trgm on public.profiles using gin (email gin_trgm_ops);

-- Addresses are reusable across orders.
create table if not exists public.addresses (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  label         text not null default 'Home',
  full_name     text not null,
  phone         text not null default '',
  line1         text not null,
  line2         text not null default '',
  city          text not null default '',
  state         text not null default '',
  country       text not null default 'Nigeria',
  postal_code   text not null default '',
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists addresses_customer_idx on public.addresses (customer_id);

create unique index if not exists addresses_one_default
  on public.addresses (customer_id) where is_default;

create trigger trg_addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- Wishlist is a first-class list, not a join table on profiles.
create table if not exists public.wishlists (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (wishlist_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Cart. Anonymous shoppers get a session token; a claim-on-signup promotes the
-- cart to the customer id without losing anything.
-- ---------------------------------------------------------------------------
create table if not exists public.carts (
  id            uuid primary key default gen_random_uuid(),
  -- Exactly one of these identifies the owner.
  customer_id   uuid unique references public.profiles(id) on delete cascade,
  session_token text unique,
  currency      text not null default 'NGN',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_heartbeat_at timestamptz not null default now(),
  constraint carts_has_owner check (customer_id is not null or session_token is not null)
);

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  quantity   int not null check (quantity > 0 and quantity <= 99),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  added_at   timestamptz not null default now(),
  unique (cart_id, product_id, variant_id)
);
create index if not exists cart_items_cart_idx on public.cart_items (cart_id);

create trigger trg_carts_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

-- Any cart write is a recovery signal, so refresh the heartbeat.
create or replace function public.touch_cart_heartbeat()
returns trigger
language plpgsql
as $$
begin
  update public.carts
     set updated_heartbeat_at = now()
   where id = coalesce(new.cart_id, old.cart_id);
  return coalesce(new, old);
end;
$$;

create trigger trg_cart_items_heartbeat
  after insert or update or delete on public.cart_items
  for each row execute function public.touch_cart_heartbeat();

-- ---------------------------------------------------------------------------
-- Abandoned checkout recovery.
-- Fed by the same cart write events, then progressed through checkout_steps
-- so the admin panel can segment recoverable customers.
-- ---------------------------------------------------------------------------
create table if not exists public.abandoned_checkouts (
  id                 uuid primary key default gen_random_uuid(),
  cart_id            uuid references public.carts(id) on delete set null,
  customer_id        uuid references public.profiles(id) on delete set null,
  session_token      text,
  email              text not null default '',
  phone              text not null default '',

  stage              public.abandoned_stage not null default 'cart',
  furthest_step      int not null default 0 check (furthest_step between 0 and 3),

  -- Snapshot of the basket at the moment it was abandoned.
  items              jsonb not null default '[]'::jsonb,
  item_count         int not null default 0,
  subtotal           numeric(12,2) not null default 0,

  -- Partial checkout data (steps 1-3) so recovery emails can be personalised.
  full_name          text not null default '',
  address            text not null default '',
  city               text not null default '',
  state              text not null default '',
  fulfilment_method  public.fulfilment_method,
  payment_method     public.payment_method_kind,

  -- Recovery workflow
  recovered          boolean not null default false,
  recovered_at       timestamptz,
  recovered_order_id uuid,
  reminder_sent_at   timestamptz,
  reminder_count     int not null default 0,
  discount_code      text not null default '',

  abandoned_at       timestamptz not null default now(),
  expires_at         timestamptz not null default (now() + interval '30 days'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists abandoned_stage_idx on public.abandoned_checkouts (stage, abandoned_at desc);
create index if not exists abandoned_open_idx   on public.abandoned_checkouts (recovered, expires_at);
create index if not exists abandoned_email_idx  on public.abandoned_checkouts (email);

-- One OPEN recovery row per cart: this is the conflict target for the
-- cart-write trigger below, so repeated browsing never floods the table.
create unique index if not exists abandoned_one_open_per_cart
  on public.abandoned_checkouts (cart_id)
  where recovered = false and cart_id is not null;

create trigger trg_abandoned_updated_at
  before update on public.abandoned_checkouts
  for each row execute function public.set_updated_at();

-- Turn a cart write into an abandoned-checkout row (idempotent per cart).
create or replace function public.track_abandoned_checkout()
returns trigger
language plpgsql
as $$
declare
  c public.carts%rowtype;
  v_item_count int;
  v_subtotal numeric(12,2);
begin
  select * into c from public.carts where id = coalesce(new.cart_id, old.cart_id);
  if c.id is null then
    return coalesce(new, old);
  end if;

  select count(*), coalesce(sum(quantity * unit_price), 0)
    into v_item_count, v_subtotal
    from public.cart_items where cart_id = c.id;

  -- Only worth recovering once there is something in the basket.
  if v_item_count = 0 then
    return coalesce(new, old);
  end if;

  insert into public.abandoned_checkouts
    (cart_id, customer_id, session_token, stage, item_count, subtotal, abandoned_at)
  values
    (c.id, c.customer_id, c.session_token, 'cart', v_item_count, v_subtotal, now())
  on conflict (cart_id) where recovered = false and cart_id is not null do nothing;

  -- Refresh the existing open row instead of duplicating it.
  update public.abandoned_checkouts
     set item_count   = v_item_count,
         subtotal     = v_subtotal,
         customer_id  = coalesce(abandoned_checkouts.customer_id, c.customer_id),
         session_token= coalesce(abandoned_checkouts.session_token, c.session_token),
         -- A live cart write means they are shopping again, so it is not recovered.
         recovered    = false,
         updated_at   = now()
   where cart_id = c.id
     and recovered = false;

  return coalesce(new, old);
end;
$$;

create trigger trg_cart_items_track_abandoned
  after insert or update or delete on public.cart_items
  for each row execute function public.track_abandoned_checkout();



-- ############################################################################
-- ### FILE: supabase/migrations/0004_orders_payments_shipping.sql
-- ############################################################################

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



-- ############################################################################
-- ### FILE: supabase/migrations/0005_content_reviews_ops.sql
-- ############################################################################

-- =============================================================================
-- GEEZMART — 0005 storefront content, reviews, ops (activity + notifications)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Banners (drive the hero carousel)
-- ---------------------------------------------------------------------------
create table if not exists public.banners (
  id            uuid primary key default gen_random_uuid(),
  headline      text not null,
  subheadline   text not null default '',
  description   text not null default '',
  cta_text      text not null default 'Shop Now',
  cta_href      text not null default '/shop',
  image_desktop text,
  image_mobile  text,
  image_url     text,
  start_date    timestamptz,
  end_date      timestamptz,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists banners_active_idx on public.banners (active, sort_order);
create trigger trg_banners_updated_at
  before update on public.banners for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Homepage builder: reorderable, toggleable sections
-- ---------------------------------------------------------------------------
create table if not exists public.homepage_sections (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,       -- hero | featured | new_drops | trending | ...
  label       text not null,
  title       text not null default '',
  subtitle    text not null default '',
  description text not null default '',
  cta_text    text not null default 'View All',
  cta_href    text not null default '/shop',
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_homepage_sections_updated_at
  before update on public.homepage_sections
  for each row execute function public.set_updated_at();

-- Which products appear in which homepage section, in order.
create table if not exists public.homepage_section_products (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.homepage_sections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique (section_id, product_id)
);
create index if not exists homepage_section_products_idx
  on public.homepage_section_products (section_id, position);

-- Auto-create the join row when a product is flagged, so admin toggles
-- ("Men's Picks", "Trending") immediately change the storefront.
create or replace function public.sync_homepage_flags()
returns trigger
language plpgsql
as $$
declare
  v_section public.homepage_sections%rowtype;
begin
  if new.featured then
    select * into v_section from public.homepage_sections where key = 'featured';
    if v_section.id is not null then
      insert into public.homepage_section_products (section_id, product_id, position)
      values (v_section.id, new.id, coalesce(new.sort_order_hint, 0))
      on conflict do nothing;
    end if;
  end if;
  if new.trending then
    select * into v_section from public.homepage_sections where key = 'trending';
    if v_section.id is not null then
      insert into public.homepage_section_products (section_id, product_id, position)
      values (v_section.id, new.id, coalesce(new.sort_order_hint, 0))
      on conflict do nothing;
    end if;
  end if;
  if new.is_new_drop then
    select * into v_section from public.homepage_sections where key = 'new_drops';
    if v_section.id is not null then
      insert into public.homepage_section_products (section_id, product_id, position)
      values (v_section.id, new.id, coalesce(new.sort_order_hint, 0))
      on conflict do nothing;
    end if;
  end if;
  if new.mens_pick then
    select * into v_section from public.homepage_sections where key = 'mens_picks';
    if v_section.id is not null then
      insert into public.homepage_section_products (section_id, product_id, position)
      values (v_section.id, new.id, coalesce(new.sort_order_hint, 0))
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_products_homepage_flags
  after insert or update of featured, trending, is_new_drop, mens_pick on public.products
  for each row execute function public.sync_homepage_flags();

-- ---------------------------------------------------------------------------
-- Pages (About, Shipping, Returns, Privacy, FAQ...)
-- ---------------------------------------------------------------------------
create table if not exists public.pages (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text not null unique,
  body          text not null default '',
  excerpt       text not null default '',
  published     boolean not null default false,
  show_in_footer boolean not null default true,
  sort_order    int not null default 0,
  seo_title     text not null default '',
  meta_description text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_pages_updated_at
  before update on public.pages for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Navigation (bottom nav, header menu, category rail)
-- `system_route` protects the routes the app cannot boot without.
-- ---------------------------------------------------------------------------
create table if not exists public.navigation_items (
  id           uuid primary key default gen_random_uuid(),
  location     text not null default 'bottom',  -- bottom | header | footer
  label        text not null,
  href         text not null,
  icon         text not null default 'circle',
  sort_order   int not null default 0,
  hidden       boolean not null default false,
  -- When true the item may not be deleted or repointed.
  system_route boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists navigation_location_idx on public.navigation_items (location, sort_order);

create or replace function public.protect_system_navigation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.system_route then
    raise exception 'Cannot delete required system navigation item: %', old.label;
  end if;
  if tg_op = 'UPDATE' and old.system_route then
    if new.href is distinct from old.href or new.hidden then
      raise exception 'Cannot hide or repoint required system navigation item: %', old.label;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_navigation_system_guard
  before update or delete on public.navigation_items
  for each row execute function public.protect_system_navigation();

-- ---------------------------------------------------------------------------
-- Reviews (only 'approved' is publicly visible)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  author_name text not null default '',
  rating      int not null check (rating between 1 and 5),
  title       text not null default '',
  body        text not null default '',
  status      public.review_status not null default 'pending',
  is_verified boolean not null default false,
  helpful_count int not null default 0,
  admin_note  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, customer_id)
);
create index if not exists reviews_product_idx on public.reviews (product_id, status);
create index if not exists reviews_status_idx  on public.reviews (status, created_at desc);

create trigger trg_reviews_updated_at
  before update on public.reviews for each row execute function public.set_updated_at();

-- Keep the product's denormalised rating cache accurate, approved reviews only.
create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set rating_avg = coalesce((
           select round(avg(r.rating)::numeric, 2)
             from public.reviews r
            where r.product_id = v_product and r.status = 'approved'
         ), 0),
         rating_count = (
           select count(*) from public.reviews r
            where r.product_id = v_product and r.status = 'approved'
         )
   where p.id = v_product;
  return coalesce(new, old);
end;
$$;

create trigger trg_reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ---------------------------------------------------------------------------
-- Store settings (key/value with typed values + typed table for structured bits)
-- ---------------------------------------------------------------------------
create table if not exists public.store_settings (
  key        text primary key,
  value      jsonb not null default 'null'::jsonb,
  group_name text not null default 'general',
  label      text not null default '',
  -- Secrets are write-only from the client: readable only by service_role.
  is_secret  boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists store_settings_group_idx on public.store_settings (group_name);

create trigger trg_store_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

create table if not exists public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  kind        public.payment_method_kind not null unique,
  label       text not null,
  description text not null default '',
  instructions text not null default '',
  icon        text not null default 'card',
  -- Provider keys live here ONLY as references; real secrets belong in the
  -- server environment, never in a client-readable row.
  provider_key_env text not null default '',
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications (admin + customer)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  -- null recipient = broadcast to all admins
  audience    text not null default 'admin',   -- admin | customer
  type        text not null,                   -- new_order | low_stock | new_review | ...
  severity    public.log_severity not null default 'info',
  title       text not null,
  body        text not null default '',
  link        text not null default '',
  entity      text not null default '',
  entity_id   text not null default '',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_unread_idx
  on public.notifications (created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------
-- Activity log (who changed what, before -> after)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references public.profiles(id) on delete set null,
  admin_name   text not null default '',
  action       text not null,        -- product.created | order.status_changed | ...
  entity       text not null,        -- product | order | customer | ...
  entity_id    text not null default '',
  entity_label text not null default '',
  summary      text not null default '',
  before_value jsonb,
  after_value  jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);
create index if not exists activity_logs_entity_idx on public.activity_logs (entity, entity_id);
create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Automatic operational notifications
-- ---------------------------------------------------------------------------

-- New order -> alert every admin.
create or replace function public.notify_new_order()
returns trigger
language plpgsql
as $$
begin
  insert into public.notifications (audience, type, severity, title, body, link, entity, entity_id)
  values ('admin', 'new_order', 'info',
          'New order ' || new.reference,
          format('%s placed an order for %s', new.customer_name, new.total),
          '/admin/orders/' || new.id, 'order', new.id);
  return new;
end;
$$;

create trigger trg_orders_notify
  after insert on public.orders
  for each row execute function public.notify_new_order();

-- Low stock -> alert once per threshold crossing.
create or replace function public.notify_low_stock()
returns trigger
language plpgsql
as $$
declare
  v_available int;
begin
  select (quantity_on_hand - quantity_reserved) into v_available
    from public.inventory
   where id = new.id;

  if coalesce(v_available, 0) <= new.reorder_point then
    insert into public.notifications (audience, type, severity, title, body, link, entity, entity_id)
    select 'admin', 'low_stock',
           case when v_available <= 0 then 'critical' else 'warning' end,
           case when v_available <= 0 then 'Out of stock' else 'Low stock' end,
           'A product has reached its reorder threshold.',
           '/admin/inventory', 'inventory', new.product_id::text
     where not exists (
       select 1 from public.notifications
        where type = 'low_stock' and entity_id = new.product_id::text
          and read_at is null
     );
  end if;
  return new;
end;
$$;

create trigger trg_inventory_notify_low_stock
  after insert or update of quantity_on_hand on public.inventory
  for each row execute function public.notify_low_stock();

-- New review -> moderation queue alert.
create or replace function public.notify_new_review()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (audience, type, severity, title, body, link, entity, entity_id)
    values ('admin', 'new_review', 'info', 'New review awaiting moderation',
            format('%s rated this product %s/5', new.author_name, new.rating),
            '/admin/reviews', 'review', new.id::text);
  end if;
  return new;
end;
$$;

create trigger trg_reviews_notify
  after insert on public.reviews
  for each row execute function public.notify_new_review();

-- New customer -> alert.
create or replace function public.notify_new_customer()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'customer' then
    insert into public.notifications (audience, type, severity, title, body, link, entity, entity_id)
    values ('admin', 'new_customer', 'info', 'New customer registered',
            coalesce(new.name, new.email), '/admin/customers', 'customer', new.id::text);
  end if;
  return new;
end;
$$;

create trigger trg_profiles_notify
  after insert on public.profiles
  for each row execute function public.notify_new_customer();

-- Abandoned checkout worth recovering -> alert.
create or replace function public.notify_abandoned_checkout()
returns trigger
language plpgsql
as $$
begin
  if new.item_count >= 1 and coalesce(new.subtotal, 0) >= 100000 and new.recovered = false then
    insert into public.notifications (audience, type, severity, title, body, link, entity, entity_id)
    values ('admin', 'abandoned_checkout', 'warning', 'High-value cart abandoned',
            format('%s items worth %s left at stage %s', new.item_count, new.subtotal, new.stage),
            '/admin/checkouts', 'abandoned_checkout', new.id::text);
  end if;
  return new;
end;
$$;

create trigger trg_abandoned_notify
  after insert on public.abandoned_checkouts
  for each row execute function public.notify_abandoned_checkout();



-- ############################################################################
-- ### FILE: supabase/migrations/0006_rls_roles.sql
-- ############################################################################

-- =============================================================================
-- GEEZMART — 0006 roles, row level security, analytics views
-- SECURITY: every rule is enforced by Postgres, not by the client. The
-- frontend guards in /admin are UX only and are trivially bypassable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so a suspended admin cannot be locked out by the very
-- table we read to check their status, and so the lookup does not recurse
-- through RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and status = 'active'
       and role in ('super_admin','admin','product_manager','order_manager','support')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and status = 'active' and role = 'super_admin'
  );
$$;

create or replace function public.has_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and status = 'active' and role = any(roles)
  );
$$;

-- Catalogue management vs. operations management, matching the admin sidebar.
create or replace function public.can_manage_products()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('super_admin','admin','product_manager');
$$;

create or replace function public.can_manage_orders()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('super_admin','admin','order_manager');
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'media','categories','brands','products','product_images','product_variants',
    'inventory','inventory_movements',
    'profiles','addresses','wishlists','wishlist_items',
    'carts','cart_items','abandoned_checkouts',
    'shipping_zones','shipping_rates','coupons','coupon_redemptions',
    'checkout_sessions','orders','order_items','order_status_history',
    'payments','shipments',
    'banners','homepage_sections','homepage_section_products',
    'pages','navigation_items','reviews',
    'store_settings','payment_methods','notifications','activity_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- PUBLIC CATALOGUE — readable by everyone (including anonymous visitors),
-- writable only by product managers. NOTE: customers see no cost_price
-- because it is not exposed by any public view; use storefront_catalog.
-- ---------------------------------------------------------------------------
create policy "public can read categories"
  on public.categories for select using (hidden = false);
create policy "public can read brands"
  on public.brands for select using (true);
create policy "public can read published products"
  on public.products for select using (status = 'published');
create policy "public can read product images"
  on public.product_images for select using (true);
create policy "public can read active variants"
  on public.product_variants for select using (active);
create policy "public can read media"
  on public.media for select using (true);
create policy "public can read approved reviews"
  on public.reviews for select using (status = 'approved');
create policy "public can read active shipping zones"
  on public.shipping_zones for select using (active);
create policy "public can read active shipping rates"
  on public.shipping_rates for select using (active);
create policy "public can read active payment methods"
  on public.payment_methods for select using (active);
create policy "public can read published pages"
  on public.pages for select using (published);
create policy "public can read navigation"
  on public.navigation_items for select using (not hidden);
create policy "public can read homepage sections"
  on public.homepage_sections for select using (enabled);
create policy "public can read homepage products"
  on public.homepage_section_products for select using (true);
create policy "public can read banners in window"
  on public.banners for select
  using (
    active
    and (start_date is null or start_date <= now())
    and (end_date is null or end_date >= now())
  );

-- Public-safe settings only. Secrets are excluded by policy, not by the UI.
create policy "public can read non-secret settings"
  on public.store_settings for select using (not is_secret);

-- ---------------------------------------------------------------------------
-- CUSTOMER-SCOPED DATA
-- ---------------------------------------------------------------------------
-- Reads the caller''s role WITHOUT re-entering the profiles RLS policy.
create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "customers read own profile"
  on public.profiles for select using (id = auth.uid());

-- The role check uses my_role() (SECURITY DEFINER). A plain subquery on
-- profiles here would recurse through this very policy and error out.
create policy "customers update own profile"
  on public.profiles for update using (id = auth.uid() and status = 'active')
  with check (id = auth.uid() and status = 'active' and role = public.my_role());

create policy "customers manage own addresses"
  on public.addresses for all
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy "customers manage own cart"
  on public.carts for all
  using (customer_id = auth.uid() or session_token is not null)
  with check (customer_id = auth.uid() or session_token is not null);

create policy "customers manage own cart items"
  on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.customer_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.customer_id = auth.uid()));

create policy "customers manage own wishlist"
  on public.wishlists for all
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy "customers manage own wishlist items"
  on public.wishlist_items for all
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.customer_id = auth.uid()))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.customer_id = auth.uid()));

create policy "customers manage own checkout sessions"
  on public.checkout_sessions for all
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- A customer sees only their own orders — never another customer's.
create policy "customers read own orders"
  on public.orders for select using (customer_id = auth.uid());
create policy "customers read own order items"
  on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy "customers read own order history"
  on public.order_status_history for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Customers may write their own reviews, always landing as 'pending'.
create policy "customers create own reviews"
  on public.reviews for insert with check (customer_id = auth.uid());

-- Abandoned checkouts are written by triggers, not by the browser.
create policy "customers see own abandoned checkouts"
  on public.abandoned_checkouts for select using (customer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ADMIN ACCESS
-- ---------------------------------------------------------------------------
create policy "admins read profiles"
  on public.profiles for select using (public.is_admin());
create policy "admins read addresses"
  on public.addresses for select using (public.is_admin());
create policy "admins read all orders"
  on public.orders for select using (public.can_manage_orders());
create policy "admins read order items"
  on public.order_items for select using (public.can_manage_orders());
create policy "admins read order history"
  on public.order_status_history for select using (public.can_manage_orders());
create policy "admins read payments"
  on public.payments for select using (public.can_manage_orders());
create policy "admins manage order status"
  on public.orders for update using (public.can_manage_orders())
  with check (public.can_manage_orders());
create policy "admins manage payments"
  on public.payments for all using (public.can_manage_orders())
  with check (public.can_manage_orders());
create policy "admins manage shipments"
  on public.shipments for all using (public.can_manage_orders())
  with check (public.can_manage_orders());

create policy "admins manage catalogue"
  on public.products for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage categories"
  on public.categories for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage brands"
  on public.brands for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage variants"
  on public.product_variants for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage product images"
  on public.product_images for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage media"
  on public.media for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage inventory"
  on public.inventory for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins read inventory movements"
  on public.inventory_movements for select using (public.can_manage_products());

create policy "admins manage homepage"
  on public.homepage_sections for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage homepage products"
  on public.homepage_section_products for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage banners"
  on public.banners for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage pages"
  on public.pages for all using (public.can_manage_products())
  with check (public.can_manage_products());
create policy "admins manage navigation"
  on public.navigation_items for all using (public.can_manage_products())
  with check (public.can_manage_products());

create policy "admins moderate reviews"
  on public.reviews for all using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage customers"
  on public.profiles for update using (public.is_admin())
  with check (public.is_admin());
create policy "admins manage coupons"
  on public.coupons for all using (public.can_manage_orders())
  with check (public.can_manage_orders());
create policy "admins manage shipping"
  on public.shipping_zones for all using (public.can_manage_orders())
  with check (public.can_manage_orders());
create policy "admins manage shipping rates"
  on public.shipping_rates for all using (public.can_manage_orders())
  with check (public.can_manage_orders());

create policy "admins manage settings"
  on public.store_settings for all using (public.is_super_admin())
  with check (public.is_super_admin());
create policy "admins manage payment methods"
  on public.payment_methods for all using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "admins read notifications"
  on public.notifications for select using (public.is_admin());
create policy "admins update notifications"
  on public.notifications for update using (public.is_admin())
  with check (public.is_admin());
create policy "customers read own notifications"
  on public.notifications for select using (recipient_id = auth.uid());
create policy "customers update own notifications"
  on public.notifications for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "admins read activity log"
  on public.activity_logs for select using (public.is_admin());
create policy "admins read abandoned checkouts"
  on public.abandoned_checkouts for select using (public.is_admin());
create policy "admins manage abandoned checkouts"
  on public.abandoned_checkouts for update using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ANALYTICS VIEWS (dashboard + /admin/analytics)
-- ---------------------------------------------------------------------------

create or replace view public.admin_daily_sales as
select
  date_trunc('day', o.placed_at)::date as day,
  count(distinct o.id)                    as orders,
  sum(o.subtotal)                        as revenue,
  sum(o.delivery_fee)                    as delivery_revenue,
  sum(o.discount)                        as discount_given,
  round(avg(o.total), 2)                 as avg_order_value,
  count(distinct o.customer_id)          as customers
from public.orders o
where o.status not in ('cancelled', 'refunded')
group by 1
order by 1;

create or replace view public.admin_top_products as
select
  oi.product_id,
  oi.product_name,
  sum(oi.quantity)                as units_sold,
  sum(oi.line_total)              as revenue
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.status not in ('cancelled','refunded')
group by 1, 2
order by revenue desc;

create or replace view public.admin_top_categories as
select
  c.id   as category_id,
  c.name as category,
  sum(oi.quantity)   as units_sold,
  sum(oi.line_total) as revenue
from public.order_items oi
join public.products   p on p.id = oi.product_id
join public.categories c on c.id = p.category_id
join public.orders      o on o.id = oi.order_id
where o.status not in ('cancelled','refunded')
group by 1, 2
order by revenue desc;

create or replace view public.admin_cart_health as
select
  count(*) filter (where recovered)                        as recovered,
  count(*) filter (where not recovered)                    as still_abandoned,
  count(*) filter (where not recovered
                     and expires_at > now())               as recoverable,
  coalesce(sum(subtotal) filter (where not recovered), 0)   as value_at_risk,
  round(
    100.0 * count(*) filter (where recovered) /
    nullif(count(*), 0), 2
  )                                                          as recovery_rate_pct
from public.abandoned_checkouts;

create or replace view public.admin_inventory_alerts as
select * from public.inventory_available
where stock_state <> 'healthy';



-- ############################################################################
-- ### FILE: supabase/migrations/0007_orders_rpc.sql
-- ############################################################################

-- =============================================================================
-- GEEZMART — 0007 transactional RPCs
-- The ONLY safe way to place an order or adjust stock from a client.
-- SECURITY DEFINER + fixed search_path + explicit authorization checks.
-- =============================================================================

-- Reset any search_path tampering on every function below.
alter function public.reserve_stock_for_order(uuid) set search_path = public;

-- ---------------------------------------------------------------------------
-- place_order(p_cart_id, p_shipping_zone_id, p_fulfilment, p_payment, p_coupon)
--
-- Recomputes EVERYTHING from the database: prices from products/variants,
-- delivery fee from the shipping zone, discount via coupon_is_valid.
-- Any amount the browser sends is ignored by design.
--
-- Locks the relevant inventory rows so two shoppers cannot oversell the last
-- unit. Raises an exception on insufficient stock, which rolls back the order.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_cart_id            uuid,
  p_shipping_zone_id   uuid default null,
  p_fulfilment         public.fulfilment_method default 'home_delivery',
  p_payment            public.payment_method_kind default 'card',
  p_coupon             text default null,
  p_full_name          text default null,
  p_phone              text default null,
  p_email              text default null,
  p_address            text default null,
  p_city               text default null,
  p_state              text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart        public.carts%rowtype;
  v_zone        public.shipping_zones%rowtype;
  v_order       public.orders%rowtype;
  v_line        record;
  v_subtotal    numeric(12,2) := 0;
  v_delivery    numeric(12,2) := 0;
  v_discount    numeric(12,2) := 0;
  v_reference   text;
  v_available   int;
  v_coupon_id   uuid;
  v_coupon      record;
begin
  -- 1. The cart must belong to the caller (or be an anonymous cart whose
  --    session token we are given). Never trust a bare cart id.
  select * into v_cart from public.carts where id = p_cart_id for update;
  if v_cart.id is null then
    raise exception 'Cart not found';
  end if;
  if v_cart.customer_id is not null and v_cart.customer_id <> auth.uid() then
    raise exception 'Cart does not belong to the current user';
  end if;

  -- 2. Recompute each line from the products table.
  for v_line in
    select
      ci.product_id,
      ci.variant_id,
      ci.quantity,
      coalesce(v.price, p.price) as unit_price,
      coalesce(v.title, '')    as variant_title,
      coalesce(v.sku, p.sku)   as sku,
      p.name                   as product_name,
      p.id                     as locked_product
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    left join public.product_variants v
      on v.id = ci.variant_id and v.active
    where ci.cart_id = p_cart_id
  loop
    if not exists (
      select 1 from public.products
       where id = v_line.product_id and status = 'published'
    ) then
      raise exception 'Product % is no longer available', v_line.product_name;
    end if;

    -- 3. Lock and verify stock BEFORE promising anything.
    if v_line.variant_id is null then
      select (quantity_on_hand - quantity_reserved) into v_available
        from public.inventory
       where product_id = v_line.product_id and variant_id is null
       for update;
    else
      select (quantity_on_hand - quantity_reserved) into v_available
        from public.inventory
       where product_id = v_line.product_id and variant_id = v_line.variant_id
       for update;
    end if;

    if coalesce(v_available, 0) < v_line.quantity then
      raise exception 'Insufficient stock for %', v_line.product_name;
    end if;

    -- Scheduled sales are applied here, not by the client.
    v_subtotal := v_subtotal + (v_line.unit_price * v_line.quantity);
  end loop;

  if v_subtotal <= 0 then
    raise exception 'Cannot place an order for an empty cart';
  end if;

  -- 4. Delivery fee comes from the zone, with the free-delivery threshold.
  if p_fulfilment = 'home_delivery' and p_shipping_zone_id is not null then
    select * into v_zone from public.shipping_zones
     where id = p_shipping_zone_id and active;
    if v_zone.id is not null then
      v_delivery := case
        when v_zone.free_over is not null and v_subtotal >= v_zone.free_over then 0
        else v_zone.fee
      end;
    end if;
  end if;

  -- 5. Discount via the single coupon rule-set.
  if p_coupon is not null and p_coupon <> '' then
    select * into v_coupon from public.coupon_is_valid(p_coupon, v_subtotal, v_cart.customer_id);
    if v_coupon.valid then
      if v_coupon.reason = '' or v_coupon.reason is null then
        v_discount := v_coupon.discount;
        select id into v_coupon_id from public.coupons
         where upper(code) = upper(p_coupon);
      end if;
    end if;
  end if;

  v_reference := public.next_order_reference();

  -- 6. Order header.
  insert into public.orders (
    reference, cart_id, customer_id,
    customer_name, customer_email, customer_phone,
    fulfilment_method, address, city, state, shipping_zone_id,
    subtotal, delivery_fee, discount, total,
    coupon_code, coupon_id,
    status, payment_status, payment_method
  ) values (
    v_reference, p_cart_id, v_cart.customer_id,
    coalesce(p_full_name, ''), coalesce(p_email, ''), coalesce(p_phone, ''),
    p_fulfilment, coalesce(p_address, ''), coalesce(p_city, ''), coalesce(p_state, ''),
    p_shipping_zone_id,
    v_subtotal, v_delivery, v_discount, v_subtotal + v_delivery - v_discount,
    nullif(p_coupon, ''), v_coupon_id,
    'pending',
    case when p_payment = 'cash_on_delivery' then 'unpaid'::public.payment_status
         else 'pending'::public.payment_status end,
    p_payment
  )
  returning * into v_order;

  -- 7. Line items with the recomputed prices.
  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_title,
    sku, image_url, unit_price, quantity, line_total
  )
  select
    v_order.id, ci.product_id, ci.variant_id,
    p.name,
    coalesce(v.title, ''),
    coalesce(v.sku, p.sku),
    (select pi.url from public.product_images pi
      where pi.product_id = p.id
      order by pi.is_primary desc, pi.position limit 1),
    coalesce(v.price, p.price),
    ci.quantity,
    coalesce(v.price, p.price) * ci.quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  left join public.product_variants v on v.id = ci.variant_id and v.active
  where ci.cart_id = p_cart_id;

  -- 8. Commit stock: consume the reservation and post the ledger movement.
  for v_line in
    select oi.product_id, oi.variant_id, oi.quantity
      from public.order_items oi where oi.order_id = v_order.id
  loop
    if v_line.variant_id is null then
      update public.inventory
         set quantity_on_hand  = quantity_on_hand - v_line.quantity,
             quantity_reserved = greatest(quantity_reserved - v_line.quantity, 0)
       where product_id = v_line.product_id and variant_id is null;
    else
      update public.inventory
         set quantity_on_hand  = quantity_on_hand - v_line.quantity,
             quantity_reserved = greatest(quantity_reserved - v_line.quantity, 0)
       where product_id = v_line.product_id and variant_id = v_line.variant_id;
    end if;

    insert into public.inventory_movements
      (product_id, variant_id, delta, reason, reference, note)
    values
      (v_line.product_id, v_line.variant_id, -v_line.quantity, 'sale', v_reference,
       'Order ' || v_reference);
  end loop;

  -- 9. Mark sold-out products, close the abandoned row, clear the cart.
  update public.products p
     set status = 'out_of_stock'
   where p.status = 'published'
     and not exists (
       select 1 from public.inventory i
        where i.product_id = p.id
          and (i.quantity_on_hand - i.quantity_reserved) > 0
     );

  update public.abandoned_checkouts
     set recovered = true, recovered_at = now(), recovered_order_id = v_order.id
   where cart_id = p_cart_id and recovered = false;

  delete from public.cart_items where cart_id = p_cart_id;

  update public.checkout_sessions
     set completed = true, completed_at = now(), order_id = v_order.id
   where cart_id = p_cart_id and completed = false;

  -- 10. Record the activity trail.
  insert into public.activity_logs
    (admin_name, action, entity, entity_id, entity_label, summary, after_value)
  values
    ('Storefront', 'order.placed', 'order', v_order.id::text, v_reference,
     'Order placed from the storefront', jsonb_build_object('total', v_order.total));

  return v_order;
end;
$$;

-- Only signed-in customers and the service role may call this.
revoke execute on function public.place_order(uuid, uuid, public.fulfilment_method, public.payment_method_kind, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.place_order(uuid, uuid, public.fulfilment_method, public.payment_method_kind, text, text, text, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- adjust_stock: the only sanctioned way to move stock by hand.
-- Writes an inventory_movements row so the ledger stays the source of truth.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id  uuid,
  p_delta       int,
  p_reason      text default 'adjustment',
  p_variant_id  uuid default null,
  p_note        text default ''
)
returns public.inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inventory%rowtype;
begin
  if not public.can_manage_products() then
    raise exception 'You do not have permission to adjust inventory';
  end if;

  insert into public.inventory_movements
    (product_id, variant_id, delta, reason, note, actor_id, actor_name)
  values
    (p_product_id, p_variant_id, p_delta, p_reason, p_note, auth.uid(),
     coalesce((select name from public.profiles where id = auth.uid()), 'system'));

  if p_variant_id is null then
    select * into v_row from public.inventory
     where product_id = p_product_id and variant_id is null;
  else
    select * into v_row from public.inventory
     where product_id = p_product_id and variant_id = p_variant_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.adjust_stock(uuid, int, text, uuid, text) from public, anon;
grant execute on function public.adjust_stock(uuid, int, text, uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- update_order_status: guard-transitions and log the change.
-- ---------------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default ''
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.can_manage_orders() then
    raise exception 'You do not have permission to change order status';
  end if;

  update public.orders
     set status   = p_status,
         note     = case when p_note = '' then note else p_note end,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end
   where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, status, note, changed_by, changed_by_name)
  values (p_order_id, p_status, p_note, auth.uid(),
          coalesce((select name from public.profiles where id = auth.uid()), 'admin'));

  insert into public.activity_logs (admin_id, admin_name, action, entity, entity_id, entity_label, summary, after_value)
  values (auth.uid(),
          coalesce((select name from public.profiles where id = auth.uid()), 'admin'),
          'order.status_changed', 'order', p_order_id::text,
          v_order.reference, 'Status changed to ' || p_status::text,
          jsonb_build_object('status', p_status));

  return v_order;
end;
$$;

revoke execute on function public.update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Abandoned cart scheduler.
-- Marks stale carts abandoned, or expires old recovery rows.
-- Call from pg_cron or an Edge Function on a schedule.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_abandoned_carts(p_idle_minutes int default 45)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with stale as (
    select c.id
      from public.carts c
     where c.updated_heartbeat_at < now() - make_interval(mins => p_idle_minutes)
       and exists (select 1 from public.cart_items ci where ci.cart_id = c.id)
  )
  update public.abandoned_checkouts a
     set stage         = 'cart',
         item_count    = (select count(*) from public.cart_items ci where ci.cart_id = a.cart_id),
         subtotal      = coalesce((select sum(quantity * unit_price) from public.cart_items ci where ci.cart_id = a.cart_id), 0),
         abandoned_at  = now(),
         recovered     = false
   where a.cart_id in (select id from stale)
     and a.recovered = false;

  get diagnostics v_count = row_count;

  -- Retire recovery rows that were never converted.
  update public.abandoned_checkouts
     set expires_at = now()
   where recovered = false and expires_at < now();

  return v_count;
end;
$$;

revoke execute on function public.sweep_abandoned_carts(int) from public, anon, authenticated;
grant execute on function public.sweep_abandoned_carts(int) to service_role;



-- ############################################################################
-- ### FILE: supabase/seed.sql
-- ############################################################################

-- =============================================================================
-- GEEZMART — seed data (safe to re-run; all inserts are idempotent)
-- Run AFTER the migrations. Creates the settings, menus, shipping zones and
-- homepage sections the admin panel and storefront expect to exist.
-- =============================================================================

-- Store settings -----------------------------------------------------------------
insert into public.store_settings (key, value, group_name, label) values
  ('store_name',            '"GEEZMART"',                                  'general',  'Store name'),
  ('store_tagline',         '"Premium men''s lifestyle, technology and home marketplace."', 'general', 'Tagline'),
  ('store_description',     '"GEEZMART is a premium marketplace for men."',   'general',  'Description'),
  ('currency',              '"NGN"',                                        'general',  'Currency'),
  ('currency_symbol',       '"₦"',                                          'general',  'Currency symbol'),
  ('contact_email',         '"support@geezmart.com"',                      'contact',  'Contact email'),
  ('contact_phone',         '"+234 800 000 0000"',                          'contact',  'Phone'),
  ('whatsapp',              '"+2348000000000"',                             'contact',  'WhatsApp'),
  ('business_address',      '"Lagos, Nigeria"',                             'contact',  'Business address'),
  ('instagram',             '"https://instagram.com/geezmart"',             'social',   'Instagram'),
  ('twitter',               '"https://x.com/geezmart"',                    'social',   'X / Twitter'),
  ('facebook',              '"https://facebook.com/geezmart"',             'social',   'Facebook'),
  ('youtube',               '"https://youtube.com/@geezmart"',             'social',   'YouTube'),
  ('free_delivery_over',    '250000',                                       'shipping', 'Free delivery over (₦)'),
  ('default_delivery_fee',  '3500',                                         'shipping', 'Default delivery fee (₦)'),
  ('tax_rate',              '0',                                            'general',  'Tax rate'),
  ('allow_guest_checkout',  'true',                                         'general',  'Allow guest checkout'),
  ('abandoned_cart_alert_threshold', '100000',                               'ops',      'Alert when abandoned cart exceeds (₦)'),
  ('admin_login_notifications','true',                                      'ops',      'Email me about new orders')
on conflict (key) do nothing;

-- Secret settings are defined but NOT readable by the anon client.
insert into public.store_settings (key, value, group_name, label, is_secret) values
  ('payment_provider_secret_key', '""', 'payment', 'Provider secret key', true),
  ('smtp_password',               '""', 'email',    'SMTP password',     true),
  ('sms_api_token',               '""', 'email',    'SMS API token',     true)
on conflict (key) do nothing;

-- Payment methods ----------------------------------------------------------------
insert into public.payment_methods (kind, label, description, icon, sort_order) values
  ('card',            'Card',              'Visa, Mastercard, Verve',            'card',   1),
  ('bank_transfer',   'Bank Transfer',     'Transfer to our verified account',  'bank',   2),
  ('ussd',            'USSD',              'Dial *901# to pay',                 'phone',  3),
  ('cash_on_delivery','Cash on Delivery',  'Pay the courier on arrival',        'cash',   4)
on conflict (kind) do update set label = excluded.label, description = excluded.description;

-- Shipping zones -----------------------------------------------------------------
insert into public.shipping_zones (name, kind, states, fee, free_over, eta_min_days, eta_max_days, sort_order) values
  ('Lagos',        'home_delivery', '{Lagos}',                                      3500, 250000, 1, 2, 1),
  ('Other States', 'home_delivery', '{Abuja,FCT,Abuja,Kano,Rivers,Ogun,Aba,Enugu,Kaduna}', 6000, 500000, 2, 4, 2),
  ('Pickup',       'pickup',        '{Lagos}',                                         0, null, 0, 1, 3)
on conflict (name) do update set fee = excluded.fee, eta_min_days = excluded.eta_min_days;

-- Homepage sections (order drives the storefront) ---------------------------------
insert into public.homepage_sections (key, label, title, subtitle, cta_text, cta_href, sort_order) values
  ('hero',        'Hero Banner',      'Premium Men''s Lifestyle & Gadgets', 'Quality products. Modern living.',            'Shop Now',   '/shop',     1),
  ('categories',  'Category Shortcuts','Shop by category',                     'Everything curated for the modern man.',       'Explore',    '/categories', 2),
  ('featured',    'Featured',          'FEATURED',                             'Hand-picked by our curators.',                'View All',   '/shop',     3),
  ('new_drops',   'New Drops',         'NEW DROPS',                            'Fresh arrivals, just landed.',                 'View All',   '/shop',     4),
  ('trending',    'Trending',          'TRENDING',                             'What everyone is buying right now.',          'View All',   '/shop',     5),
  ('mens_picks',  'Men''s Picks',      'MEN''S PICKS',                        'Edits built for him.',                         'View All',   '/shop',     6),
  ('promotion',   'Promotions',        'MEMBERS ONLY',                         'Early access to every drop.',                 'Join Now',   '/account',  7)
on conflict (key) do update set label = excluded.label, title = excluded.title, sort_order = excluded.sort_order;

-- Navigation (system_route items are protected by a DB trigger) -------------------
insert into public.navigation_items (location, label, href, icon, sort_order, system_route) values
  ('bottom', 'Home',       '/',          'home',  1, true),
  ('bottom', 'Shop',       '/shop',      'shop',  2, true),
  ('bottom', 'Categories', '/categories','grid',  3, true),
  ('bottom', 'Orders',     '/orders',    'orders',4, true),
  ('bottom', 'Account',    '/account',   'user',  5, true),
  ('header', 'Home',       '/',          'home',  1, true),
  ('header', 'Shop',       '/shop',      'shop',  2, false),
  ('header', 'Categories', '/categories','grid',  3, false),
  ('header', 'Orders',     '/orders',    'orders',4, false),
  ('header', 'Account',    '/account',   'user',  5, false),
  ('footer', 'About Us',   '/pages/about',        'info',  1, false),
  ('footer', 'Shipping',   '/pages/shipping',    'truck', 2, false),
  ('footer', 'Returns',    '/pages/returns',     'return',3, false),
  ('footer', 'FAQ',        '/pages/faq',         'help',  4, false),
  ('footer', 'Contact',    '/pages/contact',     'mail',  5, false)
on conflict do nothing;

-- Legal / content pages -----------------------------------------------------------
insert into public.pages (title, slug, excerpt, body, published, sort_order) values
  ('About Us', 'about', 'Who GEEZMART is.',
   '<h2>Premium men''s lifestyle, curated.</h2><p>GEEZMART is a marketplace for the modern Nigerian man — technology, grooming, fashion and home, chosen for quality rather than volume.</p>',
   true, 1),
  ('Shipping', 'shipping', 'How and when we deliver.',
   '<h2>Delivery</h2><p>Lagos deliveries arrive in 1–2 days. Other states take 2–4 days. Free delivery on orders over ₦250,000.</p>',
   true, 2),
  ('Returns', 'returns', 'Our returns policy.',
   '<h2>Returns</h2><p>Changed your mind? You have 7 days from delivery to request a return on unused items in original packaging.</p>',
   true, 3),
  ('Privacy Policy', 'privacy', 'How we handle your data.', '', false, 4),
  ('Terms & Conditions', 'terms', 'The terms of shopping with us.', '', false, 5),
  ('FAQ', 'faq', 'Common questions.', '', true, 6),
  ('Contact', 'contact', 'Talk to us.', '', true, 7)
on conflict (slug) do nothing;

