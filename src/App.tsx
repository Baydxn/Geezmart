import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import PageLoader from './components/PageLoader';
import { ToastProvider } from './store/ToastContext';
import { UIProvider } from './store/UIContext';
import { CartProvider } from './store/CartContext';
import { WishlistProvider } from './store/WishlistContext';
import { OrdersProvider } from './store/OrdersContext';
import { DbProvider } from './admin/AdminContext';
import Home from './pages/Home';

/* Route-level code splitting keeps the first paint light. */
const Shop = lazy(() => import('./pages/Shop'));
const Categories = lazy(() => import('./pages/Categories'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Orders = lazy(() => import('./pages/Orders'));
const Account = lazy(() => import('./pages/Account'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Tracking = lazy(() => import('./pages/Tracking'));
const NotFound = lazy(() => import('./pages/NotFound'));

/** Admin control centre — same domain, mounted at /admin. */
const AdminRoutes = lazy(() => import('./admin/AdminRoutes'));

/** Exported so the smoke test can render both trees without a browser. */
export function StorefrontRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmed/:orderId" element={<OrderSuccess />} />
          <Route path="/tracking/:id" element={<Tracking />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/account" element={<Account />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<StorefrontRoutes />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <UIProvider>
          <DbProvider>
            <CartProvider>
              <WishlistProvider>
                <OrdersProvider>
                    <AppRoutes />
                  </OrdersProvider>
              </WishlistProvider>
            </CartProvider>
          </DbProvider>
        </UIProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
