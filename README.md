# GEEZMART

Premium men&apos;s lifestyle, technology, fashion and home marketplace — a mobile-first
React storefront built around a black / white / charcoal design language with soft
bubble-shaped UI, cinematic hero imagery and restrained spring motion.

> **Logo note** — the supplied logo image was not present in this workspace, so the
> wordmark is rendered as a faithful white bubble-letter SVG in
> [`src/components/Logo.tsx`](src/components/Logo.tsx). To drop in the official
> asset, save it as `public/brand/geezmart-logo.png` and flip `USE_IMAGE_MARK`
> to `true` in that single file — nothing else changes.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b + production bundle
npm run preview      # serve the production build
npm run lint         # oxlint
npm run check:smoke  # render every route through SSR to catch runtime errors
```

## Architecture

```
src/
  components/      Reusable UI (TopNav, BottomNav, ProductCard, CartDrawer, ...)
  pages/           Route screens (lazy-loaded)
  store/           Context providers: Cart, Wishlist, Orders, Toast, UI
  data/            Category tree + demo catalogue (the only place products live)
  lib/
    api.ts         API-ready service layer (swap for fetch without touching UI)
    productImage.ts  Deterministic SVG "studio shots" used until real photos exist
    shapes.ts      Metallic product silhouettes for those generated visuals
    format.ts      Currency / date / order-reference helpers
  styles/          Design tokens + component CSS (no utility framework)
  types/           Domain contracts shared by every layer
```

### Data-driven by design
No screen hard-codes products. Everything flows from `src/data/products.ts` through
`src/lib/api.ts`, which exposes async, filter/sort/search-aware queries. The
simulated ~180ms latency is deliberate: it exercises the skeleton loaders and
mirrors the shape a real `/api/products` client would return. To move to a backend,
replace the bodies of the functions in `api.ts` — components stay untouched.

### Adding products
Append an entry to `products` in `src/data/products.ts`. Set `image` and `gallery`
to real URLs and they replace the generated visuals automatically. Collections
(`featured`, `newDrop`, `trending`, `menPick`) drive the homepage sections.

### Adding categories
Append to `categories` in `src/data/categories.ts`. Category shortcuts, the
expanding category menu, the shop filter sheet and search all read from that array.

## Key features

- **Header** — centred GEEZMART wordmark, circular account / search / cart actions,
  glass blur on scroll, animated cart badge and ripple feedback.
- **Hero carousel** — autoplay with progress bar, swipe, drag, arrows and dots.
- **Category expansion** — bubble shortcuts open a spring-animated panel of
  subcategories; selecting another category collapses the previous one.
- **Product detail** — swipeable gallery with thumbnails, colour variants,
  quantity, benefits, animated accordions and related products.
- **Cart** — bottom drawer on mobile / right drawer on desktop, live totals,
  animated quantity and price transitions, empty state.
- **Checkout** — four animated steps (Delivery, Shipping, Payment, Review) with a
  progress indicator, validation and a spring transition between steps.
- **Order confirmation** — animated SVG checkmark draw, order reference, tracking.
- **Search** — full-screen overlay with recent + popular searches, live product and
  category results, and deep links into the shop page.
- **Shop** — horizontal category chips, bottom-sheet filters, sort sheet, 2/3/4
  column responsive grid.
- **Orders** — active / completed / cancelled tabs with an animated delivery tracker.
- **Account / Wishlist** — profile menu, saved products with heart animation.
- **Toasts** — premium pill notifications; no `alert()` anywhere.

## Accessibility & performance

Semantic landmarks, skip link, labelled controls, `aria-expanded` / `aria-pressed`
state, visible focus rings, keyboard-operable quantity and filter controls,
`prefers-reduced-motion` support, lazy route chunks, lazy images, memoised cards
and skeleton loading instead of blank screens.
