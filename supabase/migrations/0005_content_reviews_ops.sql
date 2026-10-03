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
