# GEEZMART

**Storefront + Control Center.** A premium men's lifestyle marketplace (black / white / charcoal,
bubble-shaped UI) paired with a full admin panel mounted at `/admin` on the same domain.

- Customer site: `https://geezmart.com/`
- Admin panel: `https://geezmart.com/admin`

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173  (admin at /admin)
npm run build      # tsc -b + production bundle
npm run lint       # oxlint
npm run check:smoke# SSR-renders all routes to catch runtime errors
```

### Admin sign-in

The admin panel at `/admin` is protected by Supabase Auth. Sign in with a Supabase Auth account
that also carries a **staff role** in the `profiles` table (any role other than `customer`).
Non-staff accounts are rejected even when the password is correct, and every privileged action is
additionally enforced by Postgres row-level security — the frontend guards are UX only.

> **No credentials are stored in this repository.** Create your own staff account in Supabase and
> assign it a staff role; never commit passwords.

## Architecture

```
src/
  admin/                 Control center (same design language, denser layout)
    AdminRoutes.tsx      /admin routes + auth + per-role permission guards
    auth.ts              Supabase Auth sign-in, sessions, login rate limiting
    AdminContext.tsx     useAdminAuth + useDbVersion (re-renders on data changes)
    components/          AdminShell, DataTable, SalesChart, RichTextEditor,
                          ImageUploader, SeoEditor, Modal/ConfirmDialog, ui kit
    pages/               dashboard, products, product form, categories, orders,
                          customers, inventory, coupons, reviews, homepage,
                          banners, pages, media, analytics, activity, settings, login
  pages/                 Customer storefront screens
  components/            Storefront UI (header, bottom nav, cards, drawers, ...)
  store/                 Cart, Wishlist, Orders, Toast, UI contexts
  data/                  seed + categories + helpers
  lib/
    db.ts                THE CONTROL PLANE - one shared, reactive data document
    api.ts               Storefront query layer (reads the control plane)
    supabase.ts          Supabase client, connection probe, realtime, schema SQL
    productImage.ts      Generated cinematic product visuals
  styles/                Design tokens + component CSS (incl. admin.css)
```

### The control plane (`src/lib/db.ts`)

Both halves of the app read and write **one** document through `store.read()` / `store.write()`:

- Change a price in `/admin/products` → the storefront shows the new price immediately
- Hide a product → it disappears from home, shop, search and category pages
- Reorder homepage sections → the customer homepage renders in the new order
- Change an order status → `/tracking/:id` updates instantly

`store.subscribe()` powers the `useDbVersion()` hook, so every screen re-renders the moment data
changes — no page reload, no stale cache.

**To connect a real backend**, replace the bodies of the helpers in `db.ts` / `api.ts` with your
API calls. No component changes required.

## Supabase

Copy `.env.example` to `.env` and fill in your project's values (local), and set the same
variables in your host's dashboard (production):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

- `src/lib/supabase.ts` creates the client, probes the connection, exposes realtime helpers and
  exports `SUPABASE_SCHEMA_SQL` (tables + RLS policies) to run once in the SQL editor.
- The app **degrades gracefully**: without credentials the local control plane keeps every screen
  working, so a fresh clone runs with zero setup.
- Admin → Settings → Backend shows live connection status and a "copy SQL" button.
- Only *publishable* keys belong here. Service-role keys stay server-side and are never bundled
  into the client.

## Deploying

The repo is already connected. Required settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `20` or newer (env var `NODE_VERSION=20`) |
| Env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

Supporting files already committed:

- `vercel.json` — SPA rewrite so deep links like `/admin/products` work on refresh
- `wrangler.toml` — Cloudflare Workers/Pages config (`not_found_handling = "single-page-application"`)
- `public/_headers` — security headers + immutable asset caching
- `build` script wraps the bundler with `NODE_OPTIONS=--max-old-space-size=4096` via `cross-env`,
  which fixes the heap-exhaustion failure some hosts were showing

## Security notes

- Admin routes are guarded (`RequireAuth`) and section access is role-gated (`RequirePermission`).
  **The frontend guards are UX only — Postgres RLS is the real security boundary.**
- Login is rate limited with lockout; sessions are short-lived tokens in sessionStorage (or
  localStorage with "remember me"), never passwords.
- A visitor's public Account page exposes no link or hint to the admin panel.
- Cost prices, margin figures and customer notes never render on the storefront.
- Uploaded files are validated by type and size before they enter the library.
- Secrets are referenced by env-var name only (`PAYMENT_CARD_SECRET_KEY`); never stored client-side.
