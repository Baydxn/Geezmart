import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import TopNavigation from './TopNavigation';
import BottomNavigation from './BottomNavigation';
import CartDrawer from './CartDrawer';
import SearchOverlay from './SearchOverlay';
import ToastViewport from './ToastViewport';
import Footer from './Footer';

/** Restores scroll position and closes overlays on every navigation. */
function useNavigationEffects() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search]);
}

export default function AppShell() {
  const { pathname } = useLocation();
  useNavigationEffects();
  const isProductPage = pathname.startsWith('/product/');

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopNavigation />

      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          id="main"
          className="page page-pad"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>

      {!isProductPage ? <Footer /> : null}

      <BottomNavigation />
      <CartDrawer />
      <SearchOverlay />
      <ToastViewport />
    </div>
  );
}