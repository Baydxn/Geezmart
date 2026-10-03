/**
 * Admin routing + guards.
 * Routes live under /admin on the same domain as the storefront.
 */
import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAdminAuth } from './AdminContext';
import AdminShell from './components/AdminShell';
import { AdminEmpty } from './components/ui';

const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/AdminProducts'));
const AdminProductForm = lazy(() => import('./pages/AdminProductForm'));
const AdminCategories = lazy(() => import('./pages/AdminCategories'));
const AdminOrders = lazy(() => import('./pages/AdminOrders'));
const AdminOrderDetail = lazy(() => import('./pages/AdminOrders').then((m) => ({ default: m.AdminOrderDetail })));
const AdminCustomers = lazy(() => import('./pages/AdminCustomers'));
const AdminCustomerDetail = lazy(() => import('./pages/AdminCustomers').then((m) => ({ default: m.AdminCustomerDetail })));
const AdminInventory = lazy(() => import('./pages/AdminInventory'));
const AdminCoupons = lazy(() => import('./pages/AdminCoupons'));
const AdminReviews = lazy(() => import('./pages/AdminReviews'));
const AdminHomepage = lazy(() => import('./pages/AdminHomepage'));
const AdminBanners = lazy(() => import('./pages/AdminBanners'));
const AdminPages = lazy(() => import('./pages/AdminPages'));
const AdminMedia = lazy(() => import('./pages/AdminMedia'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminActivity = lazy(() => import('./pages/AdminActivity'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));

/** Requires an authenticated admin session. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAdminAuth();
  const location = useLocation();

  if (!ready) return null;
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** Requires a role permission for the section being opened. */
function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAdminAuth();
  if (!can(permission)) {
    return (
      <AdminEmpty
        icon="shield"
        title="You don't have access to this section"
        body="Ask a Super Admin to grant the required role permission."
      />
    );
  }
  return <>{children}</>;
}

function Section({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  return <RequirePermission permission={permission}>{children}</RequirePermission>;
}

export default function AdminRoutes() {
  return (
    <Suspense fallback={<div className="admin-empty"><p className="admin-hint">Loading…</p></div>}>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminShell />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<Section permission="products"><AdminProducts /></Section>} />
          <Route path="products/new" element={<Section permission="products"><AdminProductForm /></Section>} />
          <Route path="products/:id/edit" element={<Section permission="products"><AdminProductForm /></Section>} />
          <Route path="categories" element={<Section permission="categories"><AdminCategories /></Section>} />
          <Route path="orders" element={<Section permission="orders"><AdminOrders /></Section>} />
          <Route path="orders/:id" element={<Section permission="orders"><AdminOrderDetail /></Section>} />
          <Route path="customers" element={<Section permission="customers"><AdminCustomers /></Section>} />
          <Route path="customers/:id" element={<Section permission="customers"><AdminCustomerDetail /></Section>} />
          <Route path="inventory" element={<Section permission="inventory"><AdminInventory /></Section>} />
          <Route path="coupons" element={<Section permission="products"><AdminCoupons /></Section>} />
          <Route path="reviews" element={<Section permission="reviews"><AdminReviews /></Section>} />
          <Route path="homepage" element={<Section permission="homepage"><AdminHomepage /></Section>} />
          <Route path="banners" element={<Section permission="banners"><AdminBanners /></Section>} />
          <Route path="pages" element={<Section permission="pages"><AdminPages /></Section>} />
          <Route path="media" element={<Section permission="media"><AdminMedia /></Section>} />
          <Route path="analytics" element={<Section permission="analytics"><AdminAnalytics /></Section>} />
          <Route path="activity" element={<Section permission="activity"><AdminActivity /></Section>} />
          <Route path="settings" element={<Section permission="settings"><AdminSettings /></Section>} />
        </Route>

        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}
