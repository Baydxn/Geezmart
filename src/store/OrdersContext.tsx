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

/* ============================================================
   Orders — customer facing only.
   Seeded with two demo orders so the Orders tab is never empty on first run;
   `placeOrder()` is the single entry point a checkout API would later own.
   ============================================================ */

const STORAGE_KEY = 'geezmart.orders.v1';

export const STATUS_FLOW: OrderStatus[] = ['processing', 'shipped', 'out_for_delivery', 'delivered'];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

const SEED_ORDERS: Order[] = [
  {
    id: 'o-1001',
    reference: orderReference(1),
    placedAt: daysAgo(3),
    status: 'shipped',
    lines: [
      {
        productId: 'g-001',
        name: 'Wireless Earbuds Pro',
        brand: 'Auralis',
        price: 42900,
        quantity: 1,
        variantLabel: 'Arctic White',
        visual: 'earbuds',
      },
      {
        productId: 'gr-003',
        name: "Men's Grooming Kit",
        brand: 'Geezmart Select',
        price: 58900,
        quantity: 1,
        variantLabel: 'Midnight Black',
        visual: 'kit',
      },
    ],
    subtotal: 101800,
    delivery: 3500,
    discount: 0,
    total: 105300,
    deliveryMethod: 'home',
    paymentMethod: 'card',
    customer: {
      name: 'Eriqk Okoro',
      phone: '+234 800 000 0000',
      email: 'eriqk@geezmart.shop',
      address: '12 Admiralty Way',
      city: 'Lekki',
      state: 'Lagos',
    },
    timeline: [
      { status: 'processing', label: 'Processing', at: daysAgo(3) },
      { status: 'shipped', label: 'Shipped', at: daysAgo(1) },
      { status: 'out_for_delivery', label: 'Out for Delivery', at: '' },
      { status: 'delivered', label: 'Delivered', at: '' },
    ],
  },
  {
    id: 'o-1000',
    reference: orderReference(0),
    placedAt: daysAgo(26),
    status: 'delivered',
    lines: [
      {
        productId: 'w-001',
        name: "Quarte Men's Watch",
        brand: 'Quarte',
        price: 89999,
        quantity: 1,
        variantLabel: 'Brushed Steel',
        visual: 'watch',
      },
    ],
    subtotal: 89999,
    delivery: 3500,
    discount: 0,
    total: 93499,
    deliveryMethod: 'home',
    paymentMethod: 'transfer',
    customer: {
      name: 'Eriqk Okoro',
      phone: '+234 800 000 0000',
      email: 'eriqk@geezmart.shop',
      address: '12 Admiralty Way',
      city: 'Lekki',
      state: 'Lagos',
    },
    timeline: [
      { status: 'processing', label: 'Processing', at: daysAgo(26) },
      { status: 'shipped', label: 'Shipped', at: daysAgo(24) },
      { status: 'out_for_delivery', label: 'Out for Delivery', at: daysAgo(23) },
      { status: 'delivered', label: 'Delivered', at: daysAgo(23) },
    ],
  },
];

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
  }) => Order;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Order[];
        if (Array.isArray(parsed) && parsed.length) setOrders(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      /* ignore */
    }
  }, [orders]);

  const placeOrder = useCallback<OrdersContextValue['placeOrder']>((input) => {
    const now = new Date().toISOString();
    const seed = Date.now() % 1_000_000;
    const order: Order = {
      id: `o-${Date.now()}`,
      reference: orderReference(seed || 1),
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
      timeline: [{ status: 'processing', label: 'Processing', at: now }],
    };
    setOrders((current) => [order, ...current]);
    return order;
  }, []);

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