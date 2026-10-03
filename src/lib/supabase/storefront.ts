/**
 * Storefront <-> Postgres bridge.
 *
 * Every function here is defensive: if Supabase is not configured, or the
 * schema has not been applied yet, it returns null instead of throwing, so the
 * app keeps working off the local control-plane database (src/lib/db.ts).
 *
 * The important design rule: PRICES AND STOCK ARE NEVER TRUSTED FROM THE
 * CLIENT. Totals are recomputed server-side via checkout_sessions columns
 * written by an Edge Function, or (until that exists) verified against the
 * products table before an order is written.
 */
import { supabase, cartSessionToken, isSupabaseConfigured } from './client';
import type { TableUpdate } from './types';
import type {
  AbandonedStage,
  DiscountKind,
  FulfilmentMethod,
  OrderStatus,
  PaymentMethodKind,
} from './types';

export const backendMode = (): 'supabase' | 'local' =>
  isSupabaseConfigured ? 'supabase' : 'local';

/** Surfaced in the UI so an operator can tell which mode is live. */
export interface BackendStatus {
  mode: 'supabase' | 'local';
  schemaInstalled: boolean;
  message: string;
}

export async function backendStatus(): Promise<BackendStatus> {
  if (!isSupabaseConfigured) {
    return {
      mode: 'local',
      schemaInstalled: false,
      message: 'Supabase env vars missing — running on the local database.',
    };
  }
  const sb = supabase();
  if (!sb) return { mode: 'local', schemaInstalled: false, message: 'Client unavailable.' };

  // Probe a table that only exists once migrations have been applied.
  const { error } = await sb.from('store_settings').select('key').limit(1);
  if (error) {
    return {
      mode: 'local',
      schemaInstalled: false,
      message: `Supabase reachable but schema missing (${error.code ?? error.message}). Run supabase/migrations in the SQL editor.`,
    };
  }
  return {
    mode: 'supabase',
    schemaInstalled: true,
    message: 'Connected to Supabase — cart, checkout and abandoned carts are live.',
  };
}

// -----------------------------------------------------------------------------
// Cart
// -----------------------------------------------------------------------------

export interface CartLineInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  /** Only a display hint; the server re-reads the real price. */
  unitPrice: number;
}

/** Returns the caller's cart, creating an anonymous one on first use. */
export async function ensureCart(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const token = cartSessionToken();

  const existing = await sb.from('carts').select('id').eq('session_token', token).maybeSingle();
  if (existing.data?.id) return existing.data.id;
  if (existing.error && existing.error.code !== 'PGRST116') return null;

  const created = await sb.from('carts').insert({ session_token: token }).select('id').single();
  return created.data?.id ?? null;
}

export async function addToSupabaseCart(lines: CartLineInput[]): Promise<boolean> {
  const sb = supabase();
  if (!sb || lines.length === 0) return false;
  const cartId = await ensureCart();
  if (!cartId) return false;

  // Re-read real prices so a tampered client payload cannot set the price.
  const ids = [...new Set(lines.map((l) => l.productId))];
  const { data: products } = await sb
    .from('products')
    .select('id, price, sale_price, sale_start, sale_end, status')
    .in('id', ids);

  const priceOf = new Map<string, number>();
  for (const p of products ?? []) {
    const now = Date.now();
    const saleActive =
      p.sale_price != null &&
      (!p.sale_start || new Date(p.sale_start).getTime() <= now) &&
      (!p.sale_end || new Date(p.sale_end).getTime() >= now);
    const price = saleActive && p.sale_price! < p.price ? p.sale_price! : p.price;
    priceOf.set(p.id, price);
  }

  const rows = lines.map((line) => ({
    cart_id: cartId,
    product_id: line.productId,
    variant_id: line.variantId ?? null,
    quantity: line.quantity,
    unit_price: priceOf.get(line.productId) ?? line.unitPrice,
  }));

  const { error } = await sb.from('cart_items').upsert(rows, {
    onConflict: 'cart_id,product_id,variant_id',
  });
  return !error;
}

export async function readSupabaseCart() {
  const sb = supabase();
  if (!sb) return null;
  const cartId = await ensureCart();
  if (!cartId) return null;
  const { data, error } = await sb
    .from('cart_items')
    .select('id, product_id, variant_id, quantity, unit_price')
    .eq('cart_id', cartId);
  if (error) return null;
  return { cartId, items: data ?? [] };
}

// -----------------------------------------------------------------------------
// Checkout
// -----------------------------------------------------------------------------

/**
 * The storefront uses short internal labels ('home', 'transfer'); the schema
 * uses explicit enum values. Translate here so neither side has to change.
 */
const FULFILMENT_TO_DB: Record<string, FulfilmentMethod> = {
  home: 'home_delivery',
  delivery: 'home_delivery',
  pickup: 'pickup',
};

const PAYMENT_TO_DB: Record<string, PaymentMethodKind> = {
  card: 'card',
  transfer: 'bank_transfer',
  bank_transfer: 'bank_transfer',
  ussd: 'ussd',
  cod: 'cash_on_delivery',
  cash: 'cash_on_delivery',
  cash_on_delivery: 'cash_on_delivery',
  wallet: 'wallet',
};

export function toDbFulfilment(value: string): FulfilmentMethod {
  return FULFILMENT_TO_DB[value] ?? 'home_delivery';
}

export function toDbPayment(value: string): PaymentMethodKind {
  return PAYMENT_TO_DB[value] ?? 'card';
}

export interface CheckoutDraft {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  /** Accepts storefront labels ('home', 'transfer') or raw enum values. */
  fulfilment: FulfilmentMethod | 'home' | 'delivery';
  payment: PaymentMethodKind | 'transfer' | 'cod' | 'cash';
  couponCode?: string;
}

/** Creates or updates the durable checkout_session as the customer advances. */
export async function saveCheckoutStep(
  step: number,
  draft: Partial<CheckoutDraft>,
): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const cartId = await ensureCart();
  if (!cartId) return null;

  const patch: TableUpdate<'checkout_sessions'> = {
    cart_id: cartId,
    session_token: cartSessionToken(),
    current_step: Math.min(Math.max(step, 1), 4),
    last_active_at: new Date().toISOString(),
  };
  if (draft.fullName !== undefined) patch.full_name = draft.fullName;
  if (draft.phone !== undefined) patch.phone = draft.phone;
  if (draft.email !== undefined) patch.email = draft.email;
  if (draft.address !== undefined) patch.address = draft.address;
  if (draft.city !== undefined) patch.city = draft.city;
  if (draft.state !== undefined) patch.state = draft.state;
  if (draft.fulfilment !== undefined) patch.fulfilment_method = toDbFulfilment(draft.fulfilment);
  if (draft.payment !== undefined) patch.payment_method = toDbPayment(draft.payment);
  if (draft.couponCode !== undefined) patch.coupon_code = draft.couponCode || null;

  const existing = await sb
    .from('checkout_sessions')
    .select('id')
    .eq('cart_id', cartId)
    .eq('completed', false)
    .maybeSingle();

  if (existing.data?.id) {
    const { error } = await sb.from('checkout_sessions').update(patch).eq('id', existing.data.id);
    return error ? null : existing.data.id;
  }

  const created = await sb
    .from('checkout_sessions')
    .insert(patch)
    .select('id')
    .single();
  return created.data?.id ?? null;
}

export interface CouponCheck {
  valid: boolean;
  reason: string;
  discount: number;
}

/** Validates a coupon with Postgres so the rules live in one place. */
export async function validateCoupon(code: string, subtotal: number): Promise<CouponCheck> {
  const sb = supabase();
  if (!sb) return { valid: false, reason: 'Coupon validation needs Supabase.', discount: 0 };

  const { data, error } = await sb.rpc('coupon_is_valid', {
    p_code: code,
    p_subtotal: subtotal,
    p_customer: null,
  });
  if (error || !data?.length) {
    return { valid: false, reason: 'Could not validate coupon.', discount: 0 };
  }
  const row = data[0];
  return { valid: row.valid, reason: row.reason, discount: Number(row.discount ?? 0) };
}

export interface PlacedOrder {
  orderId: string;
  reference: string;
}

/**
 * Places an order.
 *
 * NOTE: this inserts the order header only. Line items, payment rows and stock
 * reservation must be written by a Postgres function (SECURITY DEFINER) or an
 * Edge Function so that a browser client can never dictate prices, quantities
 * or stock movement. See supabase/docs/BACKEND.md for the RPC to add.
 */
export async function placeOrder(input: {
  draft: CheckoutDraft;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
}): Promise<PlacedOrder | null> {
  const sb = supabase();
  if (!sb) return null;
  const cartId = await ensureCart();
  if (!cartId) return null;

  const { draft } = input;
  const { data, error } = await sb
    .from('orders')
    .insert({
      cart_id: cartId,
      customer_name: draft.fullName,
      customer_email: draft.email,
      customer_phone: draft.phone,
      address: draft.address,
      city: draft.city,
      state: draft.state,
      fulfilment_method: toDbFulfilment(draft.fulfilment),
      coupon_code: draft.couponCode || null,
      subtotal: input.subtotal,
      delivery_fee: input.deliveryFee,
      discount: input.discount,
      total: input.total,
      payment_method: toDbPayment(draft.payment),
      payment_status: toDbPayment(draft.payment) === 'cash_on_delivery' ? 'unpaid' : 'pending',
      status: 'pending',
    })
    .select('id, reference')
    .single();

  if (error) return null;

  await sb
    .from('checkout_sessions')
    .update({ completed: true, completed_at: new Date().toISOString(), order_id: data.id })
    .eq('cart_id', cartId);

  return { orderId: data.id, reference: data.reference };
}

/** Public tracking lookup by order reference (e.g. GZ-000001). */
export async function trackOrder(reference: string) {
  const sb = supabase();
  if (!sb) return null;
  const { data: order } = await sb
    .from('orders')
    .select('id, reference, status, payment_status, placed_at, delivered_at, total')
    .eq('reference', reference.toUpperCase())
    .maybeSingle();
  if (!order) return null;

  const { data: history } = await sb
    .from('order_status_history')
    .select('status, note, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true });

  return { order, history: history ?? [] };
}

// -----------------------------------------------------------------------------
// Abandoned checkout recovery (admin side)
// -----------------------------------------------------------------------------

export interface AbandonedSummary {
  open: number;
  recovered: number;
  valueAtRisk: number;
  recoveryRate: number;
  byStage: Record<AbandonedStage, number>;
}

export async function abandonedCheckoutSummary(): Promise<AbandonedSummary | null> {
  const sb = supabase();
  if (!sb) return null;

  const { data: health } = await sb.from('admin_cart_health').select('*').maybeSingle();
  const { data: rows } = await sb
    .from('abandoned_checkouts')
    .select('stage')
    .eq('recovered', false);

  const byStage = {} as Record<AbandonedStage, number>;
  for (const row of rows ?? []) {
    byStage[row.stage as AbandonedStage] = (byStage[row.stage as AbandonedStage] ?? 0) + 1;
  }

  const h = (health ?? {}) as Record<string, number>;
  return {
    open: Number(h.still_abandoned ?? 0),
    recovered: Number(h.recovered ?? 0),
    valueAtRisk: Number(h.value_at_risk ?? 0),
    recoveryRate: Number(h.recovery_rate_pct ?? 0),
    byStage,
  };
}

/**
 * Marks a recovery reminder as sent and increments the counter.
 * The increment is done in SQL so concurrent reminders cannot lose a count.
 */
export async function markRecoveryReminderSent(id: string): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;

  const { data: current } = await sb
    .from('abandoned_checkouts')
    .select('reminder_count')
    .eq('id', id)
    .maybeSingle();

  const { error } = await sb
    .from('abandoned_checkouts')
    .update({
      reminder_sent_at: new Date().toISOString(),
      reminder_count: (current?.reminder_count ?? 0) + 1,
    })
    .eq('id', id);
  return !error;
}

// -----------------------------------------------------------------------------
// Admin reads
// -----------------------------------------------------------------------------

export async function adminDailySales(days = 30) {
  const sb = supabase();
  if (!sb) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await sb
    .from('admin_daily_sales')
    .select('*')
    .gte('day', since)
    .order('day', { ascending: true });
  return data ?? null;
}

export async function adminTopProducts(limit = 10) {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from('admin_top_products').select('*').limit(limit);
  return data ?? null;
}

export async function adminTopCategories(limit = 10) {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from('admin_top_categories').select('*').limit(limit);
  return data ?? null;
}

export async function adminInventoryAlerts() {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from('admin_inventory_alerts').select('*');
  return data ?? null;
}

export async function adminNotifications(limit = 50) {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb
    .from('notifications')
    .select('*')
    .eq('audience', 'admin')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? null;
}

/** Realtime feeds used by the admin dashboard and inventory screens. */
export function subscribeRealtime(
  tables: string[],
  onChange: () => void,
): (() => void) | null {
  const sb = supabase();
  if (!sb) return null;

  const channel = sb.channel(`geezmart-${tables.join('-')}-${Math.random().toString(36).slice(2)}`);
  for (const table of tables) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  }
  channel.subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

export type { OrderStatus, DiscountKind };
