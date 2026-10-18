# GEEZMART Admin Panel — Audit & Implementation Plan

**Date:** 2026-10-18 · **Status:** INCOMPLETE — in progress

## 1. Audit summary

### 1.1 Admin entry route
- SPA mounted at `/admin/*` (React Router). `src/App.tsx` → `<Route path="/admin/*" element={<AdminRoutes />} />`.
- `AdminRoutes.tsx`: lazy-loaded pages, `RequireAuth` + `RequirePermission` guards. `index` route → `AdminDashboard`. Deep links survive refresh via `vercel.json` SPA rewrite.
- AdminShell provides: desktop sidebar (`.admin-side-desktop`, `display:flex` on ≥900px) + mobile slide-over drawer (`.admin-mobile-drawer`, `x: -100% → 0`).

### 1.2 The root cause of "fake functionality": an in-memory control plane
- `src/lib/db.ts` + `src/store/store.ts` hold a single in-memory `Database` document. `hydrate()` (from Supabase) populates it on cold start, but **every admin write is purely local** (`store.write(...)`).
- The repo already contains real Supabase mutators in `src/lib/dbRepository.ts` (`saveProduct`, `saveCategory`, `saveBanner`, `saveCoupon`, `saveCustomer`, `savePage`, `saveOrderStatus`, `saveSettings`, `saveHomepageSection`, `saveReviewStatus`, `logActivity`, `deleteProduct`, `deleteCategory`, `deleteCoupon`, `deletePage`, …), but **no admin page ever calls them**. This is why the panel "looks functional but does nothing":
  - README: "Control-centre changes are stored locally in this build. Connect the mutation helpers in src/lib/db.ts to your API."
  - `AdminShell.tsx` footer: "Control-centre changes are stored locally in this build…"
- `db.ts` intentionally keeps a real Supabase snapshot after writes (via `store.refresh()` → `hydrate({ force: true })`), so once pages are wired to the real mutators, changes ARE persisted and reach the storefront.

### 1.3 Dialog / overlay stacking (popup cards)
Confirmed from CSS (src/styles):
- `.toasts` z-index **200** (highest) → paints ABOVE the admin modal and mobile drawer.
- `.admin-modal` z-index 170; `.admin-mobile-drawer` z-index 170; `.sheet-wrapper` 165; `.admin-modal-scrim` 160; `.search` 160.
- Result: toast notifications can obscure admin dialogs/popup cards; bottom "save/publish" bars and sticky footers also compete for the same fixed-slot.
- Fix: re-balance z-index so dialogs (modal ≈ drawer) sit on top of toasts, and toasts sit in a dedicated area that never covers form actions.

### 1.4 Navigation / loading
- React Router + lazy loading + Suspense + `PageLoader` boundary already present. `useDbVersion()` invalidates on snapshot change so pages re-render after a refresh.
- No full-page reloads for internal links (they are `<Link to>`).
- Observable risks: `AdminShell` does not yet surface `_dbStatus === 'error'` to the user, and lazy pages re-show "Loading…" on every navigation if not careful (handled by Suspense). Will confirm + harden.

## 2. Implementation checklist (in priority order)

1. **Persist writes to Supabase** (primary root cause). Wire every existing CRUD page's save to the dbRepository mutators + `store.refresh()`. New shared helper `src/lib/adminCrud.ts`.
2. **Dialog z-index / popup stacking fix** (CSS) — move admin modal/drawer above toasts, keep toasts non-blocking.
3. **Navigation/loading hardening** — surface DB status/error in AdminShell; keep Suspense + PageLoader; prevent duplicate submissions.
4. **Storefront parity** — confirm `visibleProducts()`, `activeBanners()`, `homepageSections()` filters are correct; confirm storefront reads the same `store` snapshot (it does).
5. **Cleanup** — remove leftover untracked helper scripts (`scripts/`, `tsc5.txt`).
6. **Verify** — `npm run lint`, `npm run build`, `npm run check:smoke`.

## 3. Supabase layers already in place
- Migrations (0001–0008) + `supabase/COMPLETE_SCHEMA.sql` define: products/brands/categories/inventory, product_images, product_variants, orders, order_items, order_status_history, profiles, addresses, coupons, reviews, pages, media, banners, homepage_sections, homepage_section_products, notifications, activity_logs, store_settings.
- RLS policies present; publishable (anon) key only in `.env` — no service-role key in the browser.

## 4. What remains open (external creds / additional config)
- Real Supabase project connection is already wired via `.env` (dummy publishable key provided).
- Payment provider integration (payment status/refunds) and carrier APIs (live tracking) are explicitly out of scope for local verification; the storefront should use verified server-side payment records and an honest manual tracking workflow.
- Service-role secrets belong server-side; `checkSupabaseConnection` only uses the publishable key.
