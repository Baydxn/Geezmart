import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type { CartLine, CartTotals, Product } from '../types';
import { toProduct } from '../lib/api';
import { store, visibleProducts } from '../lib/db';
import { useDbVersion } from '../admin/AdminContext';
import { useToast } from './ToastContext';

/* ============================================================
   Cart — persisted to localStorage, ready for a server cart API
   ============================================================ */

const STORAGE_KEY = 'geezmart.cart.v1';
export const DELIVERY_FEE = 3500;
export const PICKUP_FEE = 0;
/** Fallback waiver threshold when the admin has not configured shipping zones. */
const FREE_DELIVERY_THRESHOLD = 250000;

/** Reads the live delivery fee for a method from the admin-managed zones. */
function feeFor(method: 'home' | 'pickup'): number {
  const zones = store.read().settings.shippingZones.filter((z) => z.enabled);
  const match = zones.find((z) =>
    method === 'pickup' ? /pickup/i.test(z.name) : !/pickup/i.test(z.name),
  );
  return match ? match.fee : method === 'pickup' ? PICKUP_FEE : DELIVERY_FEE;
}

/** Free-delivery waiver, derived from the enabled home-delivery zones. */
function freeOver(): number {
  const zones = store.read().settings.shippingZones.filter((z) => z.enabled && !/pickup/i.test(z.name));
  const thresholds = zones.map((z) => z.fee > 0 ? FREE_DELIVERY_THRESHOLD : 0).filter((n) => n > 0);
  return thresholds.length ? Math.min(...thresholds) : FREE_DELIVERY_THRESHOLD;
}

type Action =
  | { type: 'add'; productId: string; variantId: string; quantity: number }
  | { type: 'setQuantity'; lineId: string; quantity: number }
  | { type: 'remove'; lineId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; lines: CartLine[] };

function reducer(state: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case 'hydrate':
      return action.lines;
    case 'add': {
      const lineId = `${action.productId}:${action.variantId}`;
      const existing = state.find((l) => l.lineId === lineId);
      if (existing) {
        return state.map((l) =>
          l.lineId === lineId ? { ...l, quantity: l.quantity + action.quantity } : l,
        );
      }
      return [
        ...state,
        { lineId, productId: action.productId, variantId: action.variantId, quantity: action.quantity, addedAt: Date.now() },
      ];
    }
    case 'setQuantity':
      if (action.quantity <= 0) return state.filter((l) => l.lineId !== action.lineId);
      return state.map((l) => (l.lineId === action.lineId ? { ...l, quantity: action.quantity } : l));
    case 'remove':
      return state.filter((l) => l.lineId !== action.lineId);
    case 'clear':
      return [];
    default:
      return state;
  }
}

/**
 * Reads the published catalogue out of the hydrated database snapshot.
 * Derived on every render so a price or stock edit in the admin panel is
 * reflected in an open cart immediately.
 */
function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    if (!Array.isArray(parsed)) return [];
    // Drop lines whose product no longer exists or is no longer purchasable.
    const catalog = new Set(visibleProducts().map((p) => p.id));
    return parsed.filter((l) => catalog.has(l.productId));
  } catch {
    return [];
  }
}

export interface DetailedCartLine extends CartLine {
  product: Product;
  variantLabel: string;
  lineTotal: number;
}

interface CartContextValue {
  lines: DetailedCartLine[];
  itemCount: number;
  totals: CartTotals;
  isEmpty: boolean;
  deliveryMethod: 'home' | 'pickup';
  setDeliveryMethod: (method: 'home' | 'pickup') => void;
  add: (product: Product, variantId?: string, quantity?: number) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // Re-render whenever the database snapshot changes (admin edits, realtime).
  useDbVersion();
  const [state, dispatch] = useReducer(reducer, [] as CartLine[]);
  const [deliveryMethod, setDeliveryMethodRaw] = useState<'home' | 'pickup'>('home');
  const { notify } = useToast();

  useEffect(() => {
    dispatch({ type: 'hydrate', lines: load() });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable (private mode) — cart stays in memory */
    }
  }, [state]);

  const setDeliveryMethod = useCallback((m: 'home' | 'pickup') => setDeliveryMethodRaw(m), []);

  const lines = useMemo<DetailedCartLine[]>(() => {
    // Derive the catalogue fresh so prices/variants reflect the latest snapshot.
    const catalog = new Map(visibleProducts().map((p) => [p.id, toProduct(p)]));
    return state.flatMap((line) => {
      const product = catalog.get(line.productId);
      if (!product) return [];
      return [
        {
          ...line,
          product,
          variantLabel: product.colors.find((c) => c.id === line.variantId)?.label ?? 'Standard',
          lineTotal: product.price * line.quantity,
        },
      ];
    });
  }, [state]);

  const totals = useMemo<CartTotals>(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const delivery = lines.length === 0 ? 0 : feeFor(deliveryMethod);
    const threshold = freeOver();
    const discount = delivery > 0 && subtotal >= threshold ? delivery : 0;
    return {
      subtotal,
      delivery,
      discount,
      total: Math.max(0, subtotal + delivery - discount),
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    };
  }, [lines, deliveryMethod]);

  const add = useCallback(
    (product: Product, variantId?: string, quantity = 1) => {
      const variant = variantId ?? product.colors[0]?.id ?? 'default';
      dispatch({ type: 'add', productId: product.id, variantId: variant, quantity });
      notify(`Added to cart — ${product.name}`, 'success');
    },
    [notify],
  );

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    dispatch({ type: 'setQuantity', lineId, quantity });
  }, []);

  const remove = useCallback(
    (lineId: string) => {
      const name = lines.find((l) => l.lineId === lineId)?.product.name;
      dispatch({ type: 'remove', lineId });
      notify(`Removed from cart${name ? ` — ${name}` : ''}`);
    },
    [lines, notify],
  );

  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: totals.itemCount,
      totals,
      isEmpty: lines.length === 0,
      deliveryMethod,
      setDeliveryMethod,
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, totals, deliveryMethod, setDeliveryMethod, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}