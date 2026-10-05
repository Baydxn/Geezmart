/**
 * GEEZMART data layer.
 *
 * Postgres is the source of truth. `hydrate()` pulls the whole control plane
 * from Supabase into an in-memory snapshot; the storefront and the admin panel
 * both read that snapshot, so an admin change is immediately visible to
 * shoppers. Writes go through the repository in `src/lib/dbRepository.ts`.
 *
 * The localStorage cache is only a cold-start fallback so a reload paints
 * instantly while `hydrate()` is in flight. It is never written while
 * Supabase is configured, which keeps the two from drifting apart.
 */
import type {
  ActivityLog,
  AdminCategory,
  AdminCustomer,
  AdminNotification,
  AdminOrder,
  AdminProduct,
  AdminUser,
  Banner,
  ContentPage,
  Coupon,
  HomepageSection,
  MediaItem,
  Review,
  StoreSettings,
} from '../types/admin';
import { buildSeed, DEFAULT_SETTINGS } from '../data/seed';
import { uid, nowIso } from '../data/dbHelpers';
import {
  createNotification,
  deleteCategory,
  deleteCoupon,
  deletePage,
  deleteProduct,
  isSupabaseConfigured,
  loadSnapshot,
  logActivity as persistActivity,
  markNotificationsRead,
  saveBanner,
  saveCategory,
  saveCoupon,
  saveCustomer,
  saveHomepageSection,
  saveOrderStatus,
  savePage,
  saveProduct,
  saveReviewStatus,
  saveSettings,
  type Snapshot,
} from './dbRepository';

const STORAGE_KEY = 'geezmart.db.v3';

/**
 * An all-empty document.
 *
 * Used as the cold-start state when Supabase is configured: the admin panel
 * then shows its genuine empty states (no products, no orders) until the real
 * rows arrive, instead of pretending demo rows are live data.
 */
function emptyDatabase(): Database {
  return {
    version: 3,
    admins: [],
    products: [],
    categories: [],
    orders: [],
    customers: [],
    coupons: [],
    reviews: [],
    pages: [],
    media: [],
    banners: [],
    homepage: [],
    notifications: [],
    activity: [],
    settings: DEFAULT_SETTINGS,
  };
}

export interface Database {
  version: number;
  admins: AdminUser[];
  products: AdminProduct[];
  categories: AdminCategory[];
  orders: AdminOrder[];
  customers: AdminCustomer[];
  coupons: Coupon[];
  reviews: Review[];
  pages: ContentPage[];
  media: MediaItem[];
  banners: Banner[];
  homepage: HomepageSection[];
  notifications: AdminNotification[];
  activity: ActivityLog[];
  settings: StoreSettings;
}

type Listener = () => void;

let db: Database | null = null;
const listeners = new Set<Listener>();

/** Connection state, surfaced in the admin Settings screen and the footer badge. */
export type DbStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unconfigured';

let status: DbStatus = isSupabaseConfigured ? 'idle' : 'unconfigured';
let statusError: string | null = null;
const statusListeners = new Set<() => void>();

function setStatus(next: DbStatus, error: string | null = null) {
  status = next;
  statusError = error;
  statusListeners.forEach((fn) => fn());
}

/**
 * Reads the in-memory snapshot.
 *
 * Before `hydrate()` resolves this returns the cached document (or the demo
 * seed on a truly cold start) so the first paint is never blocked on the
 * network. Once hydrated, only the Postgres snapshot is returned.
 */
function read(): Database {
  if (db) return db;
  // With a backend connected, never seed demo rows: an empty collections
  // document renders the real "nothing yet" states until hydrate() lands.
  if (isSupabaseConfigured) {
    db = emptyDatabase();
    return db;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed && parsed.version === 3 && Array.isArray(parsed.products)) {
        db = parsed;
        return db;
      }
    }
  } catch {
    /* corrupted or unavailable storage falls through to a fresh seed */
  }
  db = buildSeed();
  return db;
}

/**
 * Persists the cold-start cache. A no-op once Supabase is connected — Postgres
 * owns the data, and caching it locally would resurrect deleted rows.
 */
function persist() {
  if (!db || isSupabaseConfigured) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* quota / private mode - state stays in memory for the session */
  }
}

/** Drops the cached copy so the next cold start re-reads Postgres. */
function clearCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function emit() {
  listeners.forEach((fn) => fn());
}

/**
 * Pulls the live database into the snapshot.
 *
 * Safe to call repeatedly; concurrent calls share one in-flight request so a
 * StrictMode double-mount (or several components mounting at once) issues a
 * single round of queries.
 */
let inFlight: Promise<void> | null = null;

export function hydrate(options: { force?: boolean } = {}): Promise<void> {
  if (!isSupabaseConfigured) {
    setStatus('unconfigured');
    return Promise.resolve();
  }
  if (inFlight) return inFlight;

  if (status === 'ready' && !options.force) return Promise.resolve();

  setStatus('loading');
  inFlight = loadSnapshot()
    .then((snapshot: Snapshot) => {
      // Settings are stored as one JSON row and are always present after the
      // seed script, but merge over defaults in case they are missing.
      db = {
        version: 3,
        ...snapshot,
        settings: { ...DEFAULT_SETTINGS, ...snapshot.settings },
      };
      clearCache();
      setStatus('ready');
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus('error', message);
      // Keep whatever snapshot is in memory so the UI stays usable; the error
      // is surfaced to the admin rather than swallowed.
    })
    .finally(() => {
      inFlight = null;
      emit();
    });

  return inFlight;
}

/**
 * Collection -> Postgres synchronisation.
 *
 * The admin pages all mutate through `store.write(key, updater)`, which hands
 * back a brand new array. Rather than rewrite ~30 screens to call the repository
 * directly, the previous and next arrays are diffed here and each change is
 * turned into the matching Postgres write. That keeps a single definition of
 * "what a save means" for every screen.
 */

type Row = { id: string };

/** Collections whose rows are plain upserts keyed by id. */
function diffUpsert<T extends Row>(
  before: T[],
  after: T[],
  save: (row: T) => Promise<void>,
  remove: (id: string) => Promise<void> = async () => {},
): Promise<void> {
  const prev = new Map(before.map((row) => [row.id, row]));
  const next = new Set(after.map((row) => row.id));

  const work: Promise<void>[] = [];

  for (const row of after) {
    const old = prev.get(row.id);
    // Unchanged rows are skipped; JSON comparison is cheap and avoids a write
    // storm when a screen re-renders with an equal collection.
    if (old && JSON.stringify(old) === JSON.stringify(row)) continue;
    work.push(save(row));
  }

  for (const row of before) {
    if (!next.has(row.id)) work.push(remove(row.id));
  }

  if (work.length) return Promise.all(work).then(() => undefined);
  return Promise.resolve();
}

const same = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

/** Runs `task`, recording any failure in the shared status so the UI can show it. */
function report(task: Promise<void>): Promise<void> {
  return task.catch((error: unknown) => {
    setStatus('error', error instanceof Error ? error.message : 'Write failed.');
  });
}

/**
 * Pushes one collection change to Postgres. Safe to call when Supabase is not
 * configured — it becomes a no-op and the in-memory snapshot still updates, so
 * a fresh clone stays usable.
 */
function persistCollection<K extends keyof Database>(key: K, before: unknown[], after: unknown[]): Promise<void> {
  if (!isSupabaseConfigured) return Promise.resolve();

  switch (key) {
    case 'products':
      return report(
        diffUpsert(
          before as AdminProduct[],
          after as AdminProduct[],
          saveProduct,
          deleteProduct,
        ),
      );
    case 'categories':
      return report(
        diffUpsert(before as AdminCategory[], after as AdminCategory[], saveCategory, deleteCategory),
      );
    case 'banners':
      return report(diffUpsert(before as Banner[], after as Banner[], saveBanner));
    case 'pages':
      return report(diffUpsert(before as ContentPage[], after as ContentPage[], savePage, deletePage));
    case 'coupons':
      return report(
        diffUpsert(before as Coupon[], after as Coupon[], saveCoupon, deleteCoupon),
      );
    case 'homepage':
      return report(
        diffUpsert(before as HomepageSection[], after as HomepageSection[], saveHomepageSection),
      );
    case 'reviews': {
      // Reviews are append-only in practice: the admin can only change status.
      const prev = new Map((before as Review[]).map((r) => [r.id, r.status]));
      const changed = (after as Review[]).filter((r) => {
        const was = prev.get(r.id);
        return was !== undefined && was !== r.status;
      });
      return report(Promise.all(changed.map((r) => saveReviewStatus(r.id, r.status))).then(() => undefined));
    }
    case 'orders': {
      // Only the fulfilment status is editable from the admin list screen.
      const prev = new Map((before as AdminOrder[]).map((o) => [o.id, o.status]));
      const changed = (after as AdminOrder[]).filter((o) => prev.has(o.id) && prev.get(o.id) !== o.status);
      return report(Promise.all(changed.map((o) => saveOrderStatus(o.id, o.status))).then(() => undefined));
    }
    case 'customers':
      return report(diffUpsert(before as AdminCustomer[], after as AdminCustomer[], saveCustomer));
    case 'notifications': {
      const nowRead = (before as AdminNotification[]).filter((n) => !n.read).length;
      const stillUnread = (after as AdminNotification[]).some((n) => !n.read);
      if (nowRead && !stillUnread) return report(markNotificationsRead());
      const prev = new Map((before as AdminNotification[]).map((n) => [n.id, n]));
      const fresh = (after as AdminNotification[]).filter((n) => !prev.has(n.id));
      return report(Promise.all(fresh.map((n) => createNotification(n))).then(() => undefined));
    }
    case 'activity': {
      const prev = new Set((before as ActivityLog[]).map((a) => a.id));
      const fresh = (after as ActivityLog[]).filter((a) => !prev.has(a.id));
      return report(Promise.all(fresh.map((a) => persistActivity(a))).then(() => undefined));
    }
    default:
      // `admins` and `media` are managed outside these editors.
      return Promise.resolve();
  }
}

export const store = {
  /** Read-only access to the whole document (never mutate the result). */
  read(): Database {
    return read();
  },

  /** Mutate a collection, persist, and notify every subscriber. */
  write<K extends keyof Database>(key: K, updater: (current: Database[K]) => Database[K]) {
    const current = read();
    const before = current[key] as unknown[];
    const next = { ...current, [key]: updater(current[key]) };
    db = next;
    persist();
    emit();
    // Fire-and-forget: the UI already shows the optimistic result, and any
    // failure is surfaced through `store.status()` / `store.error()`.
    void persistCollection(key, before, next[key] as unknown[]);
    return next[key];
  },

  /** Replace the singleton document (settings object updates). */
  patch(partial: Partial<Database>) {
    const current = read();
    const before = current.settings;
    db = { ...current, ...partial };
    persist();
    emit();
    if (partial.settings && !same(before, partial.settings)) {
      void report(saveSettings(db.settings));
    }
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Current connection state, for the Settings screen and status badges. */
  status(): DbStatus {
    return status;
  },

  /** Populated when `status()` is 'error'. */
  error(): string | null {
    return statusError;
  },

  /** Re-reads Postgres after a write so the snapshot reflects the server. */
  refresh(): Promise<void> {
    return hydrate({ force: true });
  },

  /** Re-reads the connection state (used by the React binding below). */
  subscribeStatus(listener: () => void) {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  },

  /**
   * Wipes the snapshot and re-reads Postgres. Unlike `reset()` this never
   * restores demo data once a backend is connected.
   */
  async reset() {
    clearCache();
    if (isSupabaseConfigured) {
      await hydrate({ force: true });
      return;
    }
    db = buildSeed();
    persist();
    emit();
  },

  /**
   * True when the DB has never been persisted (fresh install).
   * Only meaningful in the unconfigured path.
   */
  isFresh(): boolean {
    return !isSupabaseConfigured && localStorage.getItem(STORAGE_KEY) === null;
  },
};

export { uid, nowIso };

/* ------------------------------ selectors ------------------------------ */

/** Products the storefront is allowed to show. */
export function visibleProducts(): AdminProduct[] {
  return store.read().products.filter((p) => p.status === 'published' || p.status === 'out_of_stock');
}

export function activePrice(product: AdminProduct, now = Date.now()): number {
  const onSale =
    product.saleStart &&
    product.saleEnd &&
    new Date(product.saleStart).getTime() <= now &&
    new Date(product.saleEnd).getTime() >= now;
  if (onSale && product.discountPercent > 0) {
    return Math.round(product.price * (1 - product.discountPercent / 100));
  }
  return product.price;
}

export function availableStock(product: AdminProduct): number {
  return Math.max(0, product.stock - product.reserved);
}

export function isLowStock(product: AdminProduct): boolean {
  return availableStock(product) <= product.lowStockThreshold;
}

/** Customers may only see their own data. */
export function ordersForCustomer(customerId: string): AdminOrder[] {
  return store.read().orders.filter((o) => o.customerId === customerId);
}

export function activeBanners(now = Date.now()): Banner[] {
  return store.read()
    .banners.filter((b) => {
      if (b.status !== 'published') return false;
      if (b.startDate && new Date(b.startDate).getTime() > now) return false;
      if (b.endDate && new Date(b.endDate).getTime() < now) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

export function homepageSections(): HomepageSection[] {
  return store.read()
    .homepage.filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
}
