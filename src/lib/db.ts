/**
 * GEEZMART data layer.
 *
 * A single JSON document persisted to localStorage, exposed through a tiny
 * reactive API. It is the CONTROL PLANE: the customer storefront and the admin
 * panel read from the same documents, so an admin change is immediately
 * visible to shoppers.
 *
 * Replacing this module with HTTP calls is the single integration point for a
 * real backend - every consumer already goes through these helpers.
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
import { buildSeed } from '../data/seed';
import { uid, nowIso } from '../data/dbHelpers';

const STORAGE_KEY = 'geezmart.db.v3';

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

function read(): Database {
  if (db) return db;
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
  persist();
  return db;
}

function persist() {
  if (!db) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* quota / private mode - state stays in memory for the session */
  }
}

function emit() {
  listeners.forEach((fn) => fn());
}

export const store = {
  /** Read-only access to the whole document (never mutate the result). */
  read(): Database {
    return read();
  },

  /** Mutate a collection, persist, and notify every subscriber. */
  write<K extends keyof Database>(key: K, updater: (current: Database[K]) => Database[K]) {
    const current = read();
    const next = { ...current, [key]: updater(current[key]) };
    db = next;
    persist();
    emit();
    return next[key];
  },

  /** Replace the singleton document (settings object updates). */
  patch(partial: Partial<Database>) {
    db = { ...read(), ...partial };
    persist();
    emit();
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Factory reset — restores the seeded demo store. */
  reset() {
    db = buildSeed();
    persist();
    emit();
  },

  /** True when the DB has never been persisted (fresh install). */
  isFresh(): boolean {
    return localStorage.getItem(STORAGE_KEY) === null;
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
