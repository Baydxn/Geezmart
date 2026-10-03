/**
 * Storefront query layer.
 *
 * Every screen reads through these helpers, and they all read from the shared
 * control-plane database - so an admin edit (price, stock, status, category)
 * is reflected for customers immediately, with no reload and no page-specific
 * wiring. Replacing these bodies with `fetch` is the whole backend migration.
 */
import type {
  CategoryId,
  Filters,
  SortKey,
  Product,
  VisualKind,
} from '../types';
import type { AdminCategory, AdminProduct, HomepageSection } from '../types/admin';
import { store, visibleProducts, activePrice, availableStock, activeBanners, homepageSections } from './db';

const LATENCY = 140;
const wait = <T,>(value: T, ms = LATENCY): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/* ------------------------------ mapping ------------------------------ */

/** Admin record -> storefront product shape. */
export function toProduct(record: AdminProduct): Product {
  const price = activePrice(record);
  return {
    id: record.id,
    slug: record.seo.slug || record.id,
    name: record.name,
    brand: record.brand,
    categoryId: record.categoryId as CategoryId,
    subcategoryId: record.subcategoryId,
    blurb: record.blurb,
    description: record.description,
    price,
    compareAtPrice: price < record.price ? record.price : undefined,
    currency: store.read().settings.currencySymbol,
    rating: 0,
    reviewCount: 0,
    stock: availableStock(record),
    visual: record.visual as VisualKind,
    image: record.images.find((i) => i.primary)?.url ?? record.images[0]?.url,
    gallery: record.images.map((i) => i.url),
    colors: record.variants[0]?.options.map((label, i) => ({
      id: `${record.id}-${i}`,
      label,
      hex: i === 0 ? '#c7ccd3' : '#1b2434',
    })) ?? [{ id: `${record.id}-0`, label: 'Standard', hex: '#c7ccd3' }],
    tags: [record.brand.toLowerCase(), record.categoryId, ...record.name.toLowerCase().split(/\s+/)],
    badges: record.status === 'coming_soon' ? ['Coming Soon'] : [],
    collections: {},
    createdAt: record.createdAt,
    popularity: Math.round(record.stock + record.price / 1000),
  };
}

export function toCategory(record: AdminCategory) {
  return {
    id: record.id as CategoryId,
    name: record.name,
    slug: record.slug,
    icon: record.icon,
    tagline: record.tagline,
    subcategories: record.subcategories,
  };
}

/* ------------------------------ queries ------------------------------ */

export const DEFAULT_FILTERS: Filters = {
  categoryIds: [],
  subcategoryIds: [],
  brands: [],
  minRating: 0,
  inStockOnly: false,
  minPrice: null,
  maxPrice: null,
};

export const emptyFilters: Filters = DEFAULT_FILTERS;

export function activeFilterCount(f: Filters): number {
  return (
    f.categoryIds.length +
    f.subcategoryIds.length +
    f.brands.length +
    (f.minRating > 0 ? 1 : 0) +
    (f.inStockOnly ? 1 : 0) +
    (f.minPrice !== null || f.maxPrice !== null ? 1 : 0)
  );
}

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  recommended: (a, b) => b.popularity - a.popularity,
  newest: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  popular: (a, b) => b.reviewCount - a.reviewCount,
};

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: Low → High' },
  { key: 'price-desc', label: 'Price: High → Low' },
  { key: 'popular', label: 'Most Popular' },
];

export function sortProducts(list: Product[], sort: SortKey = 'recommended'): Product[] {
  return [...list].sort(SORTERS[sort] ?? SORTERS.recommended);
}

export function applyFilters(list: Product[], filters: Partial<Filters>): Product[] {
  const f = { ...emptyFilters, ...filters };
  return list.filter((product) => {
    if (f.categoryIds.length && !f.categoryIds.includes(product.categoryId)) return false;
    if (f.subcategoryIds.length && !f.subcategoryIds.includes(product.subcategoryId)) return false;
    if (f.brands.length && !f.brands.includes(product.brand)) return false;
    if (f.minRating > 0 && product.rating < f.minRating) return false;
    if (f.inStockOnly && product.stock <= 0) return false;
    if (f.minPrice !== null && product.price < f.minPrice) return false;
    if (f.maxPrice !== null && product.price > f.maxPrice) return false;
    return true;
  });
}

/** Collections are derived from the admin record so homepage picks stay live. */
function collectionOf(record: AdminProduct): Product['collections'] {
  const now = Date.now();
  const age = now - new Date(record.createdAt).getTime();
  return {
    featured: record.stock > 8 && record.price < 200000,
    newDrop: age < 120 * 86_400_000,
    trending: record.stock < 60 && record.stock > 0,
    menPick: ['fashion', 'grooming', 'accessories', 'watches'].includes(record.categoryId),
  };
}

function withCollections(records: AdminProduct[]): Product[] {
  return records.map((r) => ({ ...toProduct(r), collections: collectionOf(r) }));
}

export async function listCategories() {
  return wait(store.read().categories.filter((c) => !c.hidden).sort((a, b) => a.order - b.order).map(toCategory));
}

export async function getCategory(id: string) {
  const record = store.read().categories.find((c) => c.id === id);
  return wait(record ? toCategory(record) : undefined);
}

export async function listProducts(options: { filters?: Partial<Filters>; sort?: SortKey; limit?: number } = {}) {
  const all = withCollections(visibleProducts());
  const filtered = applyFilters(all, options.filters ?? {});
  const sorted = sortProducts(filtered, options.sort);
  return wait(options.limit ? sorted.slice(0, options.limit) : sorted);
}

export async function listCollection(
  key: keyof Product['collections'],
  limit = 6,
): Promise<Product[]> {
  return wait(
    withCollections(visibleProducts())
      .filter((p) => p.collections[key])
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit),
  );
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const record = store.read().products.find((p) => (p.seo.slug || p.id) === slug);
  if (!record || (record.status !== 'published' && record.status !== 'out_of_stock')) return wait(undefined);
  return wait({ ...toProduct(record), collections: collectionOf(record) });
}

export async function listRelated(product: Product, limit = 6): Promise<Product[]> {
  return wait(
    withCollections(visibleProducts())
      .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
      .slice(0, limit),
  );
}

export function listBrands(): string[] {
  return [...new Set(store.read().products.map((p) => p.brand))].sort();
}

export function priceBounds() {
  const prices = store.read().products.map((p) => activePrice(p));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return wait([]);
  const terms = q.split(/\s+/);
  const scored = withCollections(visibleProducts())
    .map((product) => {
      const name = product.name.toLowerCase();
      const brand = product.brand.toLowerCase();
      const haystack = [name, brand, product.blurb, ...product.tags].join(' ');
      let score = 0;
      for (const term of terms) {
        if (name.startsWith(term)) score += 6;
        else if (name.includes(term)) score += 4;
        if (brand.includes(term)) score += 3;
        if (haystack.includes(term)) score += 1;
      }
      return { product, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.product.popularity - a.product.popularity)
    .map((r) => r.product);
  return wait(scored);
}

export async function searchCategories(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return wait(store.read().categories.filter((c) => !c.hidden).map(toCategory));
  return wait(
    store
      .read()
      .categories.filter(
        (c) =>
          !c.hidden &&
          (c.name.toLowerCase().includes(q) || c.subcategories.some((s) => s.name.toLowerCase().includes(q))),
      )
      .map(toCategory),
  );
}

export const POPULAR_SEARCHES = ['watch', 'earbuds', 'sneakers', 'iphone', 'grooming', 'speaker', 'couch'];

/* ------------------------- homepage composition ------------------------- */

export interface StorefrontHome {
  banners: ReturnType<typeof bannerToSlide>[];
  sections: HomepageSection[];
}

function bannerToSlide(b: ReturnType<typeof activeBanners>[number]) {
  return {
    id: b.id,
    eyebrow: b.eyebrow,
    title: b.headline,
    highlight: b.subheadline,
    subtitle: b.ctaText,
    cta: b.ctaText,
    to: b.ctaHref,
    visual: b.visual as VisualKind,
    tint: b.tint,
    image: b.desktopImage,
  };
}

export async function listHomeSections(): Promise<HomepageSection[]> {
  return wait(homepageSections());
}

export async function listHeroSlides() {
  return wait(activeBanners().map(bannerToSlide));
}

export type { CategoryId };
