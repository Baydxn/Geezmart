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
