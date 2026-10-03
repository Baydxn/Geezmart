import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Product } from '../types';
import { products } from '../data/products';
import { useToast } from './ToastContext';

/* ============================================================
   Wishlist / saved products
   ============================================================ */

const STORAGE_KEY = 'geezmart.wishlist.v1';

interface WishlistContextValue {
  ids: string[];
  items: Product[];
  has: (productId: string) => boolean;
  toggle: (product: Product) => void;
  remove: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const { notify } = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, [ids]);

  const has = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback(
    (product: Product) => {
      setIds((current) => {
        const exists = current.includes(product.id);
        notify(exists ? `Removed from wishlist — ${product.name}` : `Saved — ${product.name}`, exists ? 'default' : 'success');
        return exists ? current.filter((id) => id !== product.id) : [product.id, ...current];
      });
    },
    [notify],
  );

  const remove = useCallback((productId: string) => {
    setIds((current) => current.filter((id) => id !== productId));
    notify('Removed from wishlist');
  }, [notify]);

  const items = useMemo(
    () => ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)),
    [ids],
  );

  const value = useMemo(() => ({ ids, items, has, toggle, remove }), [ids, items, has, toggle, remove]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return ctx;
}