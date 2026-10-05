import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Order, OrderLine, OrderStatus } from '../types';
import { orderReference } from '../lib/format';
import { placeOrder as placeOrderRemote, trackOrder } from '../lib/supabase/storefront';
import { subscribeToTable } from '../lib/supabase';
import { useToast } from './ToastContext';

/* ============================================================
   Orders — the customer's own order history.
   Backed by Supabase so admin status changes show up live.
   ============================================================ */

/** The fulfilment pipeline, in order. Shared with Tracking / admin screens. */
export const STATUS_FLOW: OrderStatus[] = [
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/**
 * Orders placed in this browser.
 *
 * Supabase RLS restricts order reads to the owning customer, so we cannot ask
 * for "every order in this session". We remember the references we created and
 * look those up; anything without a server reference is a guest order that only
 * ever existed on this device.
 */
const STORAGE_KEY = 'geezmart.orders.v1';

interface StoredOrder extends Order {
  /** True while the order has no Postgres reference to reconcile against. */
  guest: boolean;
}

interface OrdersContextValue {
  orders: Order[];
  active: Order[];
  completed: Order[];
  cancelled: Order[];
  placeOrder: (input: {
    lines: OrderLine[];
    subtotal: number;
    delivery: number;
    discount: number;
    total: number;
    deliveryMethod: 'home' | 'pickup';
    paymentMethod: 'card' | 'transfer' | 'wallet';
    customer: Order['customer'];
    couponCode?: string;
  }) => Promise<Order>;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

function loadStored(): StoredOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const { notify } = useToast();

  useEffect(() => {
    setOrders(loadStored());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      /* storage unavailable (private mode) — orders stay in memory */
    }
  }, [orders]);

  /** Re-reads server-backed orders so admin status changes surface live. */
  const refreshFromServer = useCallback(async (local: StoredOrder[]) => {
    const merged = [...local];
    for (const order of local) {
      if (order.guest) continue;
      try {
        const live = await trackOrder(order.reference);
        if (!live) continue;
        const status = live.order.status as OrderStatus;
        const idx = merged.findIndex((o) => o.id === order.id);
        if (idx < 0) continue;
        merged[idx] = {
          ...merged[idx],
          status: STATUS_LABELS[status] ? status : merged[idx].status,
          timeline: live.history.map((h) => ({
            status: h.status as OrderStatus,
            label: STATUS_LABELS[h.status as OrderStatus] ?? h.status,
            at: h.created_at,
          })),
        };
      } catch {
        /* keep the cached copy when the network is unavailable */
      }
    }
    setOrders(merged);
  }, []);

  // A status change made in /admin/orders must reach the customer immediately.
  useEffect(() => {
    const unsubscribe = subscribeToTable('orders', () => {
      void refreshFromServer(loadStored());
    });
    return () => unsubscribe?.();
  }, [refreshFromServer]);

  const placeOrder = useCallback<OrdersContextValue['placeOrder']>(async (input) => {
    const now = new Date().toISOString();

    // Write to Postgres first so the order is real, then reflect it locally.
    let reference: string | null = null;
    try {
      const placed = await placeOrderRemote({
        draft: {
          fullName: input.customer.name,
          phone: input.customer.phone,
          email: input.customer.email,
          address: input.customer.address,
          city: input.customer.city,
          state: input.customer.state,
          fulfilment: input.deliveryMethod === 'pickup' ? 'pickup' : 'home_delivery',
          payment:
            input.paymentMethod === 'transfer' ? 'bank_transfer' : input.paymentMethod === 'wallet' ? 'wallet' : 'card',
          couponCode: input.couponCode,
        },
        lines: input.lines.map((line) => ({
          productId: line.productId,
          name: line.name,
          variantLabel: line.variantLabel,
          imageUrl: line.image,
          unitPrice: line.price,
          quantity: line.quantity,
        })),
        subtotal: input.subtotal,
        deliveryFee: input.delivery,
        discount: input.discount,
        total: input.total,
      });
      reference = placed?.reference ?? null;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not reach the order service.');
    }

    const order: StoredOrder = {
      id: reference ?? `o-${Date.now()}`,
      reference: reference ?? orderReference((Date.now() % 1_000_000) || 1),
      placedAt: now,
      status: 'processing',
      lines: input.lines,
      subtotal: input.subtotal,
      delivery: input.delivery,
      discount: input.discount,
      total: input.total,
      deliveryMethod: input.deliveryMethod,
      paymentMethod: input.paymentMethod,
      customer: input.customer,
      timeline: [{ status: 'processing', label: STATUS_LABELS.processing, at: now }],
      guest: !reference,
    };
    setOrders((current) => [order, ...current]);
    return order;
  }, [notify]);

  const value = useMemo<OrdersContextValue>(
    () => ({
      orders,
      active: orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled'),
      completed: orders.filter((o) => o.status === 'delivered'),
      cancelled: orders.filter((o) => o.status === 'cancelled'),
      placeOrder,
    }),
    [orders, placeOrder],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used inside <OrdersProvider>');
  return ctx;
}