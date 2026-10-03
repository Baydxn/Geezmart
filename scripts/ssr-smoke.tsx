/**
 * Render-time smoke test.
 *
 * Renders every route through React's SSR renderer and fails loudly if any
 * screen throws. Run with: npm run check:smoke
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
import { ToastProvider } from '../src/store/ToastContext';
import { UIProvider } from '../src/store/UIContext';
import { CartProvider } from '../src/store/CartContext';
import { WishlistProvider } from '../src/store/WishlistContext';
import { OrdersProvider } from '../src/store/OrdersContext';

const ROUTES = [
  '/',
  '/shop',
  '/shop?category=watches',
  '/categories',
  '/product/quarte-mens-watch',
  '/cart',
  '/wishlist',
  '/checkout',
  '/order-confirmed/o-1001',
  '/orders',
  '/tracking/GZ-000001',
  '/admin/login',
  '/admin',
  '/account',
  '/definitely-not-a-page',
];

export function runSmokeTest(): { route: string; ok: boolean; error?: string }[] {
  return ROUTES.map((route) => {
    try {
      const html = renderToString(
        <MemoryRouter initialEntries={[route]}>
          <ToastProvider>
            <UIProvider>
              <CartProvider>
                <WishlistProvider>
                  <OrdersProvider>
                    <AppRoutes />
                  </OrdersProvider>
                </WishlistProvider>
              </CartProvider>
            </UIProvider>
          </ToastProvider>
        </MemoryRouter>,
      );
      if (!html || html.length < 200) {
        return { route, ok: false, error: 'rendered empty output' };
      }
      return { route, ok: true };
    } catch (error) {
      return { route, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
