/**
 * Row <-> domain mapping between Postgres and the admin/storefront types.
 *
 * The database is the source of truth; these functions are the ONLY place that
 * knows a Postgres column is called `delivery_fee` while the UI calls it
 * `delivery`, or that a product's stock lives in a separate `inventory` table.
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
  OrderStatus,
  Review,
  StoreSettings,
} from '../../types/admin';

/** Money arrives from Postgres as numeric strings; the UI works in numbers. */
export const num = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const str = (v: unknown, fallback = ''): string => (v === null || v === undefined ? fallback : String(v));

export const bool = (v: unknown): boolean => v === true || v === 'true' || v === 1;

export const maybeDate = (v: unknown): string | null => (v ? String(v) : null);

/** Postgres enum -> the narrower status union the UI renders. */
export function orderStatus(v: unknown): OrderStatus {
  const s = str(v, 'pending');
  const allowed: OrderStatus[] = [
    'pending', 'confirmed', 'processing', 'shipped',
    'out_for_delivery', 'delivered', 'cancelled', 'refunded',
  ];
  return (allowed as string[]).includes(s) ? (s as OrderStatus) : 'pending';
}

/** Dimensions live as three numeric columns but the UI edits one string. */
export function formatDimensions(l: unknown, w: unknown, h: unknown): string {
  if (l === null || w === null || h === null) return '';
  return `${num(l)} x ${num(w)} x ${num(h)} cm`;
}

export function parseDimensions(value: string): { length: number | null; width: number | null; height: number | null } {
  const parts = String(value).split(/[x×]/i).map((p) => p.replace(/[^0-9.]/g, '').trim());
  if (parts.length !== 3 || parts.some((p) => p === '')) {
    return { length: null, width: null, height: null };
  }
  return { length: num(parts[0]), width: num(parts[1]), height: num(parts[2]) };
}
/* ------------------------------- products ------------------------------- */

export interface ProductRelations {
  brandName?: string;
  categoryName?: string;
  stock?: number;
  reserved?: number;
  reorderPoint?: number;
  images?: { id: string; url: string; filename: string; size: number; uploadedAt: string; primary?: boolean }[];
  variants?: { id: string; name: string; options: string[] }[];
}

export function toProduct(row: Record<string, unknown>, rel: ProductRelations = {}): AdminProduct {
  const price = num(row.price);
  const salePrice = row.sale_price === null || row.sale_price === undefined ? null : num(row.sale_price);
  // The UI drives sales with a percentage; derive it from the sale price.
  const discountPercent = salePrice !== null && price > 0 ? Math.round((1 - salePrice / price) * 100) : 0;

  return {
    id: str(row.id),
    sku: str(row.sku),
    name: str(row.name),
    brand: rel.brandName ?? '',
    categoryId: str(row.category_id),
    subcategoryId: str(row.subcategory_id),
    blurb: str(row.short_description),
    description: str(row.description),
    price,
    compareAtPrice: row.compare_at_price === null || row.compare_at_price === undefined ? null : num(row.compare_at_price),
    costPrice: num(row.cost_price),
    discountPercent,
    saleStart: maybeDate(row.sale_start),
    saleEnd: maybeDate(row.sale_end),
    stock: rel.stock ?? 0,
    reserved: rel.reserved ?? 0,
    lowStockThreshold: rel.reorderPoint ?? 5,
    weightKg: num(row.weight_kg),
    dimensions: formatDimensions(row.length_cm, row.width_cm, row.height_cm),
    status: str(row.status, 'draft') as AdminProduct['status'],
    visual: 'box',
    images: rel.images ?? [],
    variants: rel.variants ?? [],
    seo: {
      title: str(row.seo_title),
      description: str(row.meta_description),
      slug: str(row.slug),
      focusKeyword: str(row.focus_keyword),
      canonicalUrl: str(row.canonical_url),
      ogTitle: str(row.og_title),
      ogDescription: str(row.og_description),
      ogImage: str(row.og_image_url),
    },
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

/** Only the `products` columns; images/variants/inventory are handled separately. */
export function fromProduct(p: AdminProduct): Record<string, unknown> {
  const dims = parseDimensions(p.dimensions);
  const salePrice =
    p.discountPercent > 0 && p.price > 0
      ? Math.round(p.price * (1 - p.discountPercent / 100))
      : null;

  return {
    id: p.id,
    name: p.name,
    slug: p.seo.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    sku: p.sku,
    category_id: p.categoryId || null,
    subcategory_id: p.subcategoryId || null,
    short_description: p.blurb,
    description: p.description,
    price: p.price,
    compare_at_price: p.compareAtPrice,
    cost_price: p.costPrice,
    sale_price: salePrice,
    sale_start: p.saleStart,
    sale_end: p.saleEnd,
    status: p.status,
    weight_kg: p.weightKg || null,
    length_cm: dims.length,
    width_cm: dims.width,
    height_cm: dims.height,
    seo_title: p.seo.title,
    meta_description: p.seo.description,
    focus_keyword: p.seo.focusKeyword,
    canonical_url: p.seo.canonicalUrl || null,
    og_title: p.seo.ogTitle,
    og_description: p.seo.ogDescription,
    og_image_url: p.seo.ogImage || null,
    updated_at: new Date().toISOString(),
  };
}
/* ------------------------------- categories ------------------------------- */

export function toCategory(
  row: Record<string, unknown>,
  children: { id: string; name: string; group: string }[] = [],
): AdminCategory {
  return {
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    icon: str(row.icon, 'shop'),
    tagline: str(row.tagline),
    hidden: bool(row.hidden),
    order: num(row.sort_order),
    subcategories: children,
  };
}

export function fromCategory(c: AdminCategory): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    tagline: c.tagline,
    hidden: c.hidden,
    sort_order: c.order,
  };
}

/* --------------------------------- orders --------------------------------- */

export interface OrderRelations {
  lines?: AdminOrder['lines'];
  timeline?: AdminOrder['timeline'];
}

export function toOrder(row: Record<string, unknown>, rel: OrderRelations = {}): AdminOrder {
  return {
    id: str(row.id),
    reference: str(row.reference),
    customerId: str(row.customer_id),
    customerName: str(row.customer_name),
    customerEmail: str(row.customer_email),
    customerPhone: str(row.customer_phone),
    address: str(row.address),
    city: str(row.city),
    state: str(row.state),
    lines: rel.lines ?? [],
    subtotal: num(row.subtotal),
    delivery: num(row.delivery_fee),
    discount: num(row.discount),
    total: num(row.total),
    paymentMethod: str(row.payment_method, 'card'),
    paymentStatus: str(row.payment_status, 'pending') as AdminOrder['paymentStatus'],
    couponCode: row.coupon_code ? str(row.coupon_code) : null,
    status: orderStatus(row.status),
    createdAt: str(row.placed_at || row.created_at),
    updatedAt: str(row.updated_at || row.created_at),
    timeline: rel.timeline ?? [],
  };
}

/* ------------------------------- customers ------------------------------- */

export function toCustomer(
  row: Record<string, unknown>,
  addresses: AdminCustomer['addresses'] = [],
): AdminCustomer {
  return {
    id: str(row.id),
    name: str(row.name) || str(row.email, 'Unknown'),
    email: str(row.email),
    phone: str(row.phone),
    status: str(row.status, 'active') === 'suspended' ? 'suspended' : 'active',
    addresses,
    createdAt: str(row.created_at),
    lastOrderAt: maybeDate(row.last_order_at),
    note: str(row.notes),
  };
}

export function fromCustomer(c: AdminCustomer): Record<string, unknown> {
  return { id: c.id, name: c.name, email: c.email, phone: c.phone, status: c.status, notes: c.note };
}

/* --------------------------------- coupons --------------------------------- */

export function toCoupon(row: Record<string, unknown>): Coupon {
  const kind = str(row.kind, 'percentage');
  return {
    id: str(row.id),
    code: str(row.code),
    type: kind === 'fixed_amount' ? 'fixed' : kind === 'free_delivery' ? 'free_delivery' : 'percentage',
    value: num(row.value),
    minOrder: num(row.min_order_value),
    maxDiscount: row.max_discount === null || row.max_discount === undefined ? null : num(row.max_discount),
    usageLimit: row.usage_limit === null || row.usage_limit === undefined ? 0 : num(row.usage_limit),
    usedCount: num(row.used_count),
    expiresAt: maybeDate(row.expires_at),
    enabled: bool(row.active),
    categoryIds: Array.isArray(row.category_ids) ? (row.category_ids as string[]) : [],
    productIds: Array.isArray(row.product_ids) ? (row.product_ids as string[]) : [],
    createdAt: str(row.created_at),
  };
}

export function fromCoupon(c: Coupon): Record<string, unknown> {
  return {
    id: c.id,
    code: c.code,
    description: '',
    kind: c.type === 'fixed' ? 'fixed_amount' : c.type,
    value: c.value,
    max_discount: c.maxDiscount,
    min_order_value: c.minOrder,
    usage_limit: c.usageLimit || null,
    expires_at: c.expiresAt,
    active: c.enabled,
    category_ids: c.categoryIds,
    product_ids: c.productIds,
    updated_at: new Date().toISOString(),
  };
}

/* --------------------------------- reviews --------------------------------- */

export function toReview(row: Record<string, unknown>, productName = '', customerName = ''): Review {
  const status = str(row.status, 'pending');
  return {
    id: str(row.id),
    productId: str(row.product_id),
    productName,
    customerName: str(row.author_name) || customerName,
    rating: num(row.rating),
    body: str(row.body),
    status: (['pending', 'approved', 'hidden'].includes(status) ? status : 'pending') as Review['status'],
    createdAt: str(row.created_at),
  };
}

/* ---------------------------------- pages ---------------------------------- */

export function toPage(row: Record<string, unknown>): ContentPage {
  return {
    id: str(row.id),
    slug: str(row.slug),
    title: str(row.title),
    body: str(row.body),
    status: bool(row.published) ? 'published' : 'draft',
    updatedAt: str(row.updated_at || row.created_at),
  };
}

export function fromPage(p: ContentPage): Record<string, unknown> {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    body: p.body,
    published: p.status === 'published',
    updated_at: new Date().toISOString(),
  };
}

/* ---------------------------------- media ---------------------------------- */

export function toMedia(row: Record<string, unknown>): MediaItem {
  const kind = str(row.kind, 'other');
  return {
    id: str(row.id),
    url: str(row.public_url),
    filename: str(row.filename),
    size: num(row.byte_size),
    uploadedAt: str(row.created_at),
    width: num(row.width),
    height: num(row.height),
    kind: (['product', 'banner', 'category', 'page', 'social'].includes(kind) ? kind : 'product') as MediaItem['kind'],
  };
}

/* --------------------------------- banners --------------------------------- */

export function toBanner(row: Record<string, unknown>): Banner {
  return {
    id: str(row.id),
    headline: str(row.headline),
    subheadline: str(row.subheadline),
    ctaText: str(row.cta_text, 'Shop Now'),
    ctaHref: str(row.cta_href, '/shop'),
    eyebrow: str(row.description),
    visual: 'box',
    tint: '',
    desktopImage: str(row.image_desktop || row.image_url),
    mobileImage: str(row.image_mobile || row.image_url),
    startDate: maybeDate(row.start_date),
    endDate: maybeDate(row.end_date),
    status: bool(row.active) ? 'published' : 'draft',
    order: num(row.sort_order),
  };
}

export function fromBanner(b: Banner): Record<string, unknown> {
  return {
    id: b.id,
    headline: b.headline,
    subheadline: b.subheadline,
    description: b.eyebrow,
    cta_text: b.ctaText,
    cta_href: b.ctaHref,
    image_desktop: b.desktopImage || null,
    image_mobile: b.mobileImage || null,
    start_date: b.startDate,
    end_date: b.endDate,
    active: b.status === 'published',
    sort_order: b.order,
    updated_at: new Date().toISOString(),
  };
}

/* -------------------------------- settings -------------------------------- */

/** `store_settings` is a key/value table; settings are persisted as JSON groups. */
export const SETTINGS_KEY = 'admin_settings';

export function settingsFromRows(rows: Record<string, unknown>[]): Partial<StoreSettings> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    if (str(row.key) === SETTINGS_KEY) {
      const value = row.value;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(out, value as Record<string, unknown>);
      }
    }
  }
  return out as Partial<StoreSettings>;
}

export function settingsToRows(settings: StoreSettings): Record<string, unknown>[] {
  return [
    {
      key: SETTINGS_KEY,
      value: settings,
      group_name: 'general',
      label: 'Admin panel settings',
      is_secret: false,
      updated_at: new Date().toISOString(),
    },
  ];
}

/* ------------------------------ notifications ------------------------------ */

export function toNotification(row: Record<string, unknown>): AdminNotification {
  const type = str(row.type, 'order');
  const kind = (['order', 'stock', 'customer', 'review', 'payment', 'refund'].includes(type) ? type : 'order') as AdminNotification['kind'];
  return {
    id: str(row.id),
    kind,
    title: str(row.title),
    body: str(row.body),
    createdAt: str(row.created_at),
    read: Boolean(row.read_at),
    href: str(row.link),
  };
}

export function fromNotification(n: AdminNotification): Record<string, unknown> {
  return {
    audience: 'admin',
    type: n.kind,
    severity: 'info',
    title: n.title,
    body: n.body,
    link: n.href,
    created_at: n.createdAt,
  };
}

/* ------------------------------- activity log ------------------------------- */

export function toActivity(row: Record<string, unknown>): ActivityLog {
  const before = row.before_value;
  const after = row.after_value;
  return {
    id: str(row.id),
    adminId: str(row.admin_id, 'sys'),
    adminName: str(row.admin_name, 'System'),
    action: str(row.action),
    entity: str(row.entity),
    entityId: str(row.entity_id),
    detail: str(row.summary) || str(row.entity_label),
    before: before ? JSON.stringify(before) : undefined,
    after: after ? JSON.stringify(after) : undefined,
    createdAt: str(row.created_at),
  };
}

export function fromActivity(a: ActivityLog): Record<string, unknown> {
  return {
    id: a.id.startsWith('act-') ? undefined : a.id,
    admin_id: null,
    admin_name: a.adminName,
    action: a.action,
    entity: a.entity,
    entity_id: a.entityId,
    entity_label: '',
    summary: a.detail,
    created_at: a.createdAt,
  };
}

/* ---------------------------------- admins ---------------------------------- */

/**
 * Admin accounts are Supabase Auth users; the role lives on `profiles.role`.
 * Passwords are never held client-side.
 */
export function toAdmin(row: Record<string, unknown>): AdminUser {
  const name = str(row.name) || str(row.email, 'Admin');
  return {
    id: str(row.id),
    name,
    email: str(row.email),
    role: str(row.role, 'support') as AdminUser['role'],
    avatarInitials: name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join(''),
    createdAt: str(row.created_at),
  };
}

/* ---------------------------- homepage sections ---------------------------- */

export function toHomepageSection(
  row: Record<string, unknown>,
  productIds: string[] = [],
): HomepageSection {
  const config = (row.config ?? {}) as Record<string, unknown>;
  const type = str(row.key, 'products');
  return {
    id: str(row.id),
    type: (['hero', 'categories', 'products', 'promo', 'trust'].includes(type) ? type : 'products') as HomepageSection['type'],
    enabled: bool(row.enabled),
    order: num(row.sort_order),
    title: str(row.title) || str(row.label),
    kicker: str(row.subtitle),
    description: str(row.description),
    ctaText: str(row.cta_text, 'View All'),
    ctaHref: str(row.cta_href, '/shop'),
    // `featured`, `new_drops`, `trending`, `mens_picks`, or an explicit custom list.
    collection: str(config.collection, type) as HomepageSection['collection'],
    productIds,
  };
}