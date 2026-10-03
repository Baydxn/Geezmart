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
