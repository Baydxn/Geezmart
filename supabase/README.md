# GEEZMART Supabase schema

Complete Postgres schema for the storefront, the admin control centre, cart
recovery and analytics.

## Apply it

1. Open your project -> **SQL Editor** -> **New query**
2. Run each file **in numeric order** (they depend on one another):

   | File | Contents |
   |---|---|
   | `migrations/0001_extensions_enums.sql` | extensions, enums, shared trigger helpers, order-reference sequence |
   | `migrations/0002_catalog_inventory.sql` | categories, brands, products, images, variants, inventory ledger |
   | `migrations/0003_customers.sql` | profiles, addresses, wishlist, carts, **abandoned checkouts** |
   | `migrations/0004_orders_payments_shipping.sql` | coupons, checkout sessions, orders, payments, shipments, analytics views |
   | `migrations/0005_content_reviews_ops.sql` | banners, homepage builder, pages, navigation, reviews, notifications, activity log |
   | `migrations/0006_rls_roles.sql` | role helpers, **row level security**, admin analytics views |
   | `migrations/0007_orders_rpc.sql` | `place_order()`, `adjust_stock()`, `update_order_status()`, `sweep_abandoned_carts()` |
   | `seed.sql` | settings, payment methods, shipping zones, homepage sections, navigation, pages |

Or with the CLI:

```bash
npx supabase link --project-ref ahijotxtncavfnhohxrw
npx supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

## Verify

```bash
npm run check:sql     # static checks: parens, dollar-quotes, table refs, seed columns
```

Then open **Admin -> Settings -> Backend**. It reports whether the schema is
installed and whether the app is running in `supabase` or `local` mode.

## Creating your first admin

Passwords are never stored by this repo. Create the user in Supabase
(**Authentication -> Users -> Add user**, tick "Auto Confirm User"), then set
its role:

```sql
update public.profiles
   set role = 'super_admin', status = 'active'
 where email = 'you@example.com';
```

## How cart recovery works

```
cart_items written ──> track_abandoned_checkout() ──> abandoned_checkouts
checkout step change ─> track_checkout_progress() ─> stage + furthest_step
order placed ──────────> close_abandoned_on_order() -> recovered = true
```

`abandoned_checkouts` has a partial unique index (one OPEN row per cart), so
browsing repeatedly updates one row instead of flooding the table.

## Scheduled cleanup

Enable `pg_cron` in Supabase and schedule the sweep hourly:

```sql
select cron.schedule(
  'sweep-abandoned-carts',
  '0 * * * *',
  $$ select public.sweep_abandoned_carts(45); $$
);
```

## Security model

- RLS is enabled on **all 30+ tables**. The `/admin` guards in the React app are
  UX only and are trivially bypassed — Postgres is the enforcement layer.
- `place_order()` is `SECURITY DEFINER` and **recomputes every price, discount
  and delivery fee from the database**. Amounts sent by the browser are ignored.
- Inventory rows are locked `FOR UPDATE` during checkout, so two shoppers cannot
  oversell the last unit.
- `store_settings.is_secret` rows (payment keys, SMTP password) are unreadable to
  the anon key; only `service_role` can read them.
- `navigation_items.system_route` rows cannot be deleted or repointed — a DB
  trigger raises an exception.
- Never put a service-role key in `VITE_*` / `NEXT_PUBLIC_*`: anything in the
  bundle is public.

## Table reference

30+ tables. Everything below is created by `migrations/0001..0007`.

**Catalogue & inventory**

| Table | Purpose |
|---|---|
| `products` | name, slug, SKU, price, compare-at, cost price, scheduled sale, status, SEO |
| `product_variants` | colour / size / storage / model with its own price, SKU, image |
| `product_images` | ordered gallery, one primary per product (enforced) |
| `categories` | self-referencing tree for subcategories |
| `brands` | first-class brands for filtering |
| `media` | shared image library with kind, size, dimensions, alt text |
| `inventory` | current stock snapshot: on hand, reserved, reorder point |
| `inventory_movements` | immutable audit ledger of every stock change |

**Customers, carts & recovery**

| Table | Purpose |
|---|---|
| `profiles` | customer + admin, role, status, lifetime spend |
| `addresses` | reusable delivery addresses |
| `wishlists` / `wishlist_items` | saved products |
| `carts` / `cart_items` | anonymous-token and customer carts |
| `abandoned_checkouts` | stage, furthest step, value at risk, recovery state |
| `checkout_sessions` | the durable 4-step checkout |

**Orders & money**

| Table | Purpose |
|---|---|
| `orders` / `order_items` | orders with prices frozen at purchase time |
| `order_status_history` | immutable tracking trail for the customer |
| `payments` | one row per attempt, provider payload for reconciliation |
| `shipments` | carrier, tracking number, ETA |
| `coupons` / `coupon_redemptions` | percentage, fixed, free-delivery |
| `shipping_zones` / `shipping_rates` | per-state fees, ETAs, free-delivery thresholds |
| `payment_methods` | configured methods (no secrets) |

**Content & operations**

| Table | Purpose |
|---|---|
| `banners` | hero carousel slides |
| `homepage_sections` / `homepage_section_products` | homepage builder |
| `pages` | About, Shipping, Returns, FAQ, ... |
| `navigation_items` | bottom/header/footer menus, system routes protected |
| `reviews` | moderation queue, only `approved` is public |
| `store_settings` | key/value config; `is_secret` rows unreadable to anon |
| `notifications` | admin alerts (order, low stock, review, customer, cart) |
| `activity_logs` | who changed what, before -> after |

**Views:** `storefront_catalog`, `inventory_available`, `admin_daily_sales`,
`admin_top_products`, `admin_top_categories`, `admin_cart_health`,
`admin_inventory_alerts`.

**Functions:** `place_order`, `adjust_stock`, `update_order_status`,
`sweep_abandoned_carts`, `coupon_is_valid`, `effective_price`,
`next_order_reference`, `is_admin`, `is_super_admin`, `has_role`,
`can_manage_products`, `can_manage_orders`.
