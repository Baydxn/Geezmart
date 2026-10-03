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
