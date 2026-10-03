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
create index if not exists products_featured_idx   on public.products (featured, sort_order_hint);
create index if not exists products_name_trgm      on public.products using gin (name gin_trgm_ops);
create index if not exists products_search_trgm
  on public.products using gin ((name || ' ' || short_description) gin_trgm_ops);

-- Display ordering hint used by admin "sort_order" columns.
alter table public.products
  add column if not exists sort_order_hint int not null default 0;

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
