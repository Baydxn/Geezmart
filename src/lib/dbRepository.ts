/**
 * Supabase-backed repository.
 *
 * The admin panel and the storefront share one in-memory snapshot of the
 * database. `hydrate()` loads every collection from Postgres; each mutator
 * writes to Postgres and refreshes the local snapshot, so an admin change is
 * visible to shoppers without a reload.
 *
 * Writes are optimistic: the local snapshot updates immediately and the request
 * is sent in the background. A failed write surfaces through `lastError`.
 */
import { supabase } from './supabase';
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
import {
  bool,
  fromActivity,
  fromBanner,
  fromCategory,
  fromCoupon,
  fromCustomer,
  fromNotification,
  fromPage,
  fromProduct,
  num,
  settingsFromRows,
  settingsToRows,
  str,
  toActivity,
  toAdmin,
  toBanner,
  toCategory,
  toCoupon,
  toCustomer,
  toHomepageSection,
  toMedia,
  toNotification,
  toOrder,
  toPage,
  toProduct,
  toReview,
} from './supabase/mappers';

/** Error surfaced when Postgres is unreachable so the UI can explain itself. */
export class NotConfiguredError extends Error {
  constructor() {
    super(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env, then restart the dev server.',
    );
    this.name = 'NotConfiguredError';
  }
}

export function requireClient() {
  const sb = supabase();
  if (!sb) throw new NotConfiguredError();
  return sb;
}

/** Row helper: PostgREST returns arrays even for `.single()`. */
function one<T>(rows: T[] | null): T | null {
  return rows && rows.length ? rows[0] : null;
}

async function fetchAll(table: string, columns = '*'): Promise<Record<string, unknown>[]> {
  const sb = requireClient();
  const { data, error } = await sb.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return ((data ?? []) as unknown as Record<string, unknown>[]);
}
export interface Snapshot {
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

/**
 * Loads the whole control plane in one pass.
 *
 * Products span four tables (products + brands + inventory + images/variants)
 * and orders span three (orders + order_items + order_status_history), so they
 * are joined in memory rather than with fragile embedded selects.
 */
export async function loadSnapshot(): Promise<Snapshot> {
  const [
    productRows, brandRows, categoryRows, inventoryRows, imageRows, variantRows,
    orderRows, orderItemRows, historyRows, profileRows, addressRows, couponRows,
    reviewRows, pageRows, mediaRows, bannerRows, sectionRows, sectionProductRows,
    notificationRows, activityRows, settingsRows,
  ] = await Promise.all([
    fetchAll('products'),
    fetchAll('brands', 'id, name'),
    fetchAll('categories'),
    fetchAll('inventory', 'product_id, quantity_on_hand, quantity_reserved, reorder_point'),
    fetchAll('product_images', 'id, product_id, url, alt_text, position, is_primary, created_at'),
    fetchAll('product_variants', 'id, product_id, title, option_name, option_value, position, active'),
    fetchAll('orders'),
    fetchAll('order_items'),
    fetchAll('order_status_history'),
    fetchAll('profiles'),
    fetchAll('addresses', 'id, customer_id, label, line1, line2, city, state'),
    fetchAll('coupons'),
    fetchAll('reviews'),
    fetchAll('pages'),
    fetchAll('media'),
    fetchAll('banners'),
    fetchAll('homepage_sections'),
    fetchAll('homepage_section_products', 'section_id, product_id, position'),
    fetchAll('notifications', 'id, type, severity, title, body, link, created_at, read_at, audience'),
    fetchAll('activity_logs'),
    fetchAll('store_settings'),
  ]);

  const brandName = new Map(brandRows.map((b) => [str(b.id), str(b.name)]));
  const productName = new Map(productRows.map((p) => [str(p.id), str(p.name)]));

  const invByProduct = new Map(
    inventoryRows.map((i) => [
      str(i.product_id),
      {
        stock: num(i.quantity_on_hand),
        reserved: num(i.quantity_reserved),
        reorderPoint: num(i.reorder_point, 5),
      },
    ]),
  );

  const imagesByProduct = new Map<string, AdminProduct['images']>();
  for (const row of [...imageRows].sort((a, b) => num(a.position) - num(b.position))) {
    const list = imagesByProduct.get(str(row.product_id)) ?? [];
    list.push({
      id: str(row.id),
      url: str(row.url),
      filename: str(row.url).split('/').pop() ?? 'image',
      size: 0,
      uploadedAt: str(row.created_at),
      primary: bool(row.is_primary),
    });
    imagesByProduct.set(str(row.product_id), list);
  }

  const variantsByProduct = new Map<string, AdminProduct['variants']>();
  for (const row of variantRows) {
    if (!bool(row.active)) continue;
    const list = variantsByProduct.get(str(row.product_id)) ?? [];
    list.push({
      id: str(row.id),
      name: str(row.title) || str(row.option_value),
      options: [str(row.option_name), str(row.option_value)].filter(Boolean),
    });
    variantsByProduct.set(str(row.product_id), list);
  }

  const products = productRows.map((row) => {
    const id = str(row.id);
    const inv = invByProduct.get(id);
    return toProduct(row, {
      brandName: row.brand_id ? brandName.get(str(row.brand_id)) : undefined,
      stock: inv?.stock,
      reserved: inv?.reserved,
      reorderPoint: inv?.reorderPoint,
      images: imagesByProduct.get(id),
      variants: variantsByProduct.get(id),
    });
  });

  // Categories are self-referencing; children become the UI's `subcategories`.
  const childrenByParent = new Map<string, { id: string; name: string; group: string }[]>();
  for (const row of categoryRows) {
    const parent = str(row.parent_id);
    if (!parent) continue;
    const list = childrenByParent.get(parent) ?? [];
    list.push({ id: str(row.id), name: str(row.name), group: str(row.tagline) });
    childrenByParent.set(parent, list);
  }
  const categories = categoryRows
    .filter((row) => !row.parent_id)
    .map((row) => toCategory(row, childrenByParent.get(str(row.id)) ?? []));

  const linesByOrder = new Map<string, AdminOrder['lines']>();
  for (const row of orderItemRows) {
    const list = linesByOrder.get(str(row.order_id)) ?? [];
    list.push({
      productId: str(row.product_id),
      name: str(row.product_name),
      brand: '',
      price: num(row.unit_price),
      quantity: num(row.quantity),
      variantLabel: str(row.variant_title),
      visual: 'box',
      image: str(row.image_url),
    });
    linesByOrder.set(str(row.order_id), list);
  }

  const historyByOrder = new Map<string, AdminOrder['timeline']>();
  for (const row of historyRows) {
    const list = historyByOrder.get(str(row.order_id)) ?? [];
    list.push({ status: str(row.status) as AdminOrder['status'], at: str(row.created_at) });
    historyByOrder.set(str(row.order_id), list);
  }

  const orders = orderRows.map((row) => {
    const id = str(row.id);
    return toOrder(row, { lines: linesByOrder.get(id), timeline: historyByOrder.get(id) });
  });

  const addressesByCustomer = new Map<string, AdminCustomer['addresses']>();
  for (const row of addressRows) {
    const list = addressesByCustomer.get(str(row.customer_id)) ?? [];
    list.push({
      label: str(row.label, 'Home'),
      line: [str(row.line1), str(row.line2)].filter(Boolean).join(', '),
      city: str(row.city),
      state: str(row.state),
    });
    addressesByCustomer.set(str(row.customer_id), list);
  }
  const customers = profileRows.map((row) => toCustomer(row, addressesByCustomer.get(str(row.id)) ?? []));

  const customerName = new Map(profileRows.map((p) => [str(p.id), str(p.name)]));
  const reviews = reviewRows.map((row) =>
    toReview(
      row,
      productName.get(str(row.product_id)) ?? '',
      row.customer_id ? customerName.get(str(row.customer_id)) ?? '' : '',
    ),
  );

  const productsBySection = new Map<string, string[]>();
  for (const row of [...sectionProductRows].sort((a, b) => num(a.position) - num(b.position))) {
    const list = productsBySection.get(str(row.section_id)) ?? [];
    list.push(str(row.product_id));
    productsBySection.set(str(row.section_id), list);
  }
  const homepage = [...sectionRows]
    .sort((a, b) => num(a.sort_order) - num(b.sort_order))
    .map((row) => toHomepageSection(row, productsBySection.get(str(row.id)) ?? []));

  return {
    // Admins are staff accounts only Ã¢â‚¬â€ customers are excluded from the admin roster.
    admins: profileRows.filter((row) => str(row.role) !== 'customer').map(toAdmin),
    products,
    categories,
    orders,
    customers,
    coupons: couponRows.map(toCoupon),
    reviews,
    pages: pageRows.map(toPage),
    media: mediaRows.map(toMedia),
    banners: bannerRows.map(toBanner),
    homepage,
    notifications: notificationRows.filter((row) => !row.recipient_id).map(toNotification),
    activity: activityRows.map(toActivity),
    settings: settingsFromRows(settingsRows) as StoreSettings,
  };
}
/* ------------------------------- mutations ------------------------------- */

/**
 * True when an id was minted client-side and Postgres has never seen it.
 * Postgres uuid columns reject anything that is not a real uuid, so `id` is
 * omitted on insert and the generated id is read back from the result.
 */
function isLocalId(id: string): boolean {
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Resolves a brand name to its uuid, creating the brand row when it is new. */
async function resolveBrandId(name: string): Promise<string | null> {
  if (!name) return null;
  const sb = requireClient();
  const { data: existing } = await sb.from('brands').select('id').eq('name', name).maybeSingle();
  const found = one(existing as { id: string }[] | null)?.id;
  if (found) return found;

  const { data: created, error } = await sb
    .from('brands')
    .insert({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })
    .select('id')
    .single();
  if (error) throw new Error(`brands: ${error.message}`);
  return (created as { id: string }).id;
}

export async function saveProduct(p: AdminProduct): Promise<void> {
  const sb = requireClient();
  const row = { ...fromProduct(p), brand_id: await resolveBrandId(p.brand) };
  const payload = isLocalId(p.id) ? { ...row, id: undefined } : row;

  const { error } = await sb.from('products').upsert(payload as never);
  if (error) throw new Error(`products: ${error.message}`);

  // Inventory is a separate snapshot table keyed by product.
  const { error: invError } = await sb.from('inventory').upsert({
    product_id: p.id,
    quantity_on_hand: p.stock,
    quantity_reserved: p.reserved,
    reorder_point: p.lowStockThreshold,
    location: 'main',
    updated_at: new Date().toISOString(),
  } as never);
  if (invError) throw new Error(`inventory: ${invError.message}`);
}

export async function deleteProduct(id: string): Promise<void> {
  const sb = requireClient();
  // inventory has no cascade from products in the schema, so clear it first.
  await sb.from('inventory').delete().eq('product_id', id);
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) throw new Error(`products: ${error.message}`);
}

export async function saveCategory(c: AdminCategory): Promise<void> {
  const sb = requireClient();
  const payload = isLocalId(c.id) ? { ...fromCategory(c), id: undefined } : fromCategory(c);
  const { error } = await sb.from('categories').upsert(payload as never);
  if (error) throw new Error(`categories: ${error.message}`);
}

export async function deleteCategory(id: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('categories').delete().eq('id', id);
  if (error) throw new Error(`categories: ${error.message}`);
}

export async function saveOrderStatus(orderId: string, status: string, actor = ''): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('orders').update({ status }).eq('id', orderId);
  if (error) throw new Error(`orders: ${error.message}`);
  // The schema has a trigger for this, but writing it explicitly keeps the
  // timeline correct on deployments where the trigger is missing.
  await sb.from('order_status_history').insert({
    order_id: orderId,
    status,
    note: '',
    changed_by_name: actor,
  } as never);
}

export async function saveCustomer(c: AdminCustomer): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('profiles').update(fromCustomer(c) as never).eq('id', c.id);
  if (error) throw new Error(`profiles: ${error.message}`);
}

export async function saveCoupon(c: Coupon): Promise<void> {
  const sb = requireClient();
  const payload = isLocalId(c.id) ? { ...fromCoupon(c), id: undefined } : fromCoupon(c);
  const { error } = await sb.from('coupons').upsert(payload as never);
  if (error) throw new Error(`coupons: ${error.message}`);
}

export async function deleteCoupon(id: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('coupons').delete().eq('id', id);
  if (error) throw new Error(`coupons: ${error.message}`);
}

export async function saveReviewStatus(id: string, status: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('reviews').update({ status }).eq('id', id);
  if (error) throw new Error(`reviews: ${error.message}`);
}

export async function savePage(p: ContentPage): Promise<void> {
  const sb = requireClient();
  const payload = isLocalId(p.id) ? { ...fromPage(p), id: undefined } : fromPage(p);
  const { error } = await sb.from('pages').upsert(payload as never);
  if (error) throw new Error(`pages: ${error.message}`);
}

export async function deletePage(id: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('pages').delete().eq('id', id);
  if (error) throw new Error(`pages: ${error.message}`);
}

export async function saveBanner(b: Banner): Promise<void> {
  const sb = requireClient();
  const payload = isLocalId(b.id) ? { ...fromBanner(b), id: undefined } : fromBanner(b);
  const { error } = await sb.from('banners').upsert(payload as never);
  if (error) throw new Error(`banners: ${error.message}`);
}

export async function deleteBanner(id: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('banners').delete().eq('id', id);
  if (error) throw new Error(`banners: ${error.message}`);
}

export async function saveHomepageSection(s: HomepageSection): Promise<void> {
  const sb = requireClient();
  // `key` is unique and drives the trigger that syncs product flags, so a
  // custom section gets a key derived from its own identity.
  const key =
    s.collection === 'custom' ? `custom_${s.id.replace(/[^a-z0-9]/gi, '').slice(-8)}` : s.collection;
  const payload = isLocalId(s.id) ? { id: undefined } : { id: s.id };

  const { data, error } = await sb
    .from('homepage_sections')
    .upsert({
      ...payload,
      key,
      label: s.title || s.collection,
      title: s.title,
      subtitle: s.kicker,
      description: s.description,
      cta_text: s.ctaText,
      cta_href: s.ctaHref,
      enabled: s.enabled,
      sort_order: s.order,
      config: { collection: s.collection, type: s.type },
      updated_at: new Date().toISOString(),
    } as never)
    .select('id');
  if (error) throw new Error(`homepage_sections: ${error.message}`);

  const sectionId = one(data as { id: string }[] | null)?.id ?? s.id;

  // Only custom sections own an explicit product list.
  if (s.collection === 'custom' && !isLocalId(sectionId)) {
    await sb.from('homepage_section_products').delete().eq('section_id', sectionId);
    if (s.productIds.length) {
      const { error: linkError } = await sb.from('homepage_section_products').insert(
        s.productIds.map((productId, position) => ({ section_id: sectionId, product_id: productId, position })),
      );
      if (linkError) throw new Error(`homepage_section_products: ${linkError.message}`);
    }
  }
}

export async function deleteHomepageSection(id: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('homepage_sections').delete().eq('id', id);
  if (error) throw new Error(`homepage_sections: ${error.message}`);
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('store_settings').upsert(settingsToRows(settings) as never);
  if (error) throw new Error(`store_settings: ${error.message}`);
}

export async function logActivity(entry: ActivityLog): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('activity_logs').insert(fromActivity(entry) as never);
  if (error) throw new Error(`activity_logs: ${error.message}`);
}

export async function createNotification(n: AdminNotification): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('notifications').insert(fromNotification(n) as never);
  if (error) throw new Error(`notifications: ${error.message}`);
}

export async function markNotificationsRead(): Promise<void> {
  const sb = requireClient();
  const { error } = await sb
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(`notifications: ${error.message}`);
}

/** Appends a product image and makes it the product's primary image. */
export async function addProductImage(productId: string, url: string, alt = ''): Promise<void> {
  const sb = requireClient();
  const { data, error } = await sb
    .from('product_images')
    .insert({ product_id: productId, url, alt_text: alt, position: Date.now() % 10000, is_primary: false })
    .select('id');
  if (error) throw new Error(`product_images: ${error.message}`);

  const imageId = one(data as { id: string }[] | null)?.id;
  if (imageId) {
    // The schema allows exactly one primary image per product.
    await sb.from('product_images').update({ is_primary: true }).eq('id', imageId);
    await sb.from('product_images').update({ is_primary: false }).eq('product_id', productId).neq('id', imageId);
  }
}

export async function removeProductImage(imageId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.from('product_images').delete().eq('id', imageId);
  if (error) throw new Error(`product_images: ${error.message}`);
}

export { isSupabaseConfigured } from './supabase';
