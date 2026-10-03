import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* ============================================================
   UI state — cart drawer, search overlay, filter sheet.
   Lives above the router so overlays survive navigation.
   ============================================================ */

type SheetKind = 'filters' | 'sort' | null;

interface UIContextValue {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  sheet: SheetKind;
  openSheet: (kind: Exclude<SheetKind, null>) => void;
  closeSheet: () => void;
  cartPulse: number;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [cartPulse, setCartPulse] = useState(0);

  // Any navigation should dismiss overlays that live outside the page tree.
  useEffect(() => {
    const onPop = () => setCartOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openSheet = useCallback((kind: Exclude<SheetKind, null>) => setSheet(kind), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const value = useMemo<UIContextValue>(
    () => ({
      cartOpen,
      openCart,
      closeCart,
      searchOpen,
      openSearch,
      closeSearch,
      sheet,
      openSheet,
      closeSheet,
      cartPulse,
      setCartPulse,
    }) as UIContextValue,
    [cartOpen, searchOpen, sheet, cartPulse, openCart, closeCart, openSearch, closeSearch, openSheet, closeSheet],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
}