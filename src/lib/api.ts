import type { Category, CategoryId, Filters, Product, SortKey } from '../types';
import { categories } from '../data/categories';
import { products } from '../data/products';

/**
 * API-ready service layer.
 *
 * Every screen talks to this module instead of importing the raw arrays, so a
 * real backend can be dropped in later by swapping these bodies for `fetch`
 * calls without touching any component.
 *
 * The simulated latency exists so skeleton loaders are exercised in the UI.
 */
const LATENCY = 180;

const wait = <T,>(value: T, ms = LATENCY): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export interface QueryOptions {
  filters?: Partial<Filters>;
  sort?: SortKey;
  limit?: number;
}

export const DEFAULT_FILTERS: Filters = {
  categoryIds: [],
  subcategoryIds: [],
  brands: [],
  minRating: 0,
  inStockOnly: false,
  minPrice: null,
  maxPrice: null,
};

/** Canonical blank filter state reused by the shop page and filter sheet. */
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

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: Low → High' },
  { key: 'price-desc', label: 'Price: High → Low' },
  { key: 'popular', label: 'Most Popular' },
];

/* ------------------------------ Queries ------------------------------ */

export async function listCategories(): Promise<Category[]> {
  return wait(categories);
}

export async function listProducts(options: QueryOptions = {}): Promise<Product[]> {
  const filtered = applyFilters(products, options.filters ?? {});
  const sorted = sortProducts(filtered, options.sort);
  return wait(options.limit ? sorted.slice(0, options.limit) : sorted);
}

export async function listCollection(
  key: keyof Product['collections'],
  limit = 6,
): Promise<Product[]> {
  return wait(sortProducts(products.filter((p) => p.collections[key])).slice(0, limit));
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return wait(products.find((p) => p.slug === slug));
}

export async function getProductById(id: string): Promise<Product | undefined> {
  return wait(products.find((p) => p.id === id));
}

export async function listRelated(product: Product, limit = 6): Promise<Product[]> {
  return wait(
    products
      .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
      .slice(0, limit),
  );
}

export function listBrands(): string[] {
  return [...new Set(products.map((p) => p.brand))].sort();
}

export function priceBounds(): { min: number; max: number } {
  const prices = products.map((p) => p.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Lightweight fuzzy-ish search used by the search overlay and shop page. */
export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return wait([]);
  const terms = q.split(/\s+/);
  const scored = products
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

/** Category names matching a query — powers the "Categories" tab in search. */
export async function searchCategories(query: string): Promise<Category[]> {
  const q = query.trim().toLowerCase();
  if (!q) return wait(categories);
  return wait(
    categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.subcategories.some((s) => s.name.toLowerCase().includes(q)),
    ),
  );
}

export const POPULAR_SEARCHES = [
  'watch',
  'earbuds',
  'sneakers',
  'iphone',
  'grooming',
  'speaker',
  'couch',
];

export type { CategoryId };