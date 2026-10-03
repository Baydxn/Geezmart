/**
 * Admin shell — sidebar (desktop) / slide-over (mobile), sticky header with
 * notification centre and admin profile.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon, { type IconName } from '../../components/Icon';
import Logo from '../../components/Logo';
import { useAdminAuth, useDbVersion } from '../AdminContext';
import { store } from '../../lib/db';
import { ROLE_LABELS } from '../../types/admin';
import { relativeTime } from '../../data/dbHelpers';
import { IntegrationNote } from './ui';

function SidebarLink({
  href,
  label,
  icon,
  active,
  disabled,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  disabled?: boolean;
  onNavigate?: () => void;
}) {
  const className = `admin-nav-item${disabled ? ' is-disabled' : ''}`;
  const content = (
    <>
      {active ? (
        <motion.span
          layoutId="admin-nav"
          className="admin-nav-bubble"
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        />
      ) : null}
      <Icon name={icon} size={17} />
      <span>{label}</span>
    </>
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        <Icon name={icon} size={17} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <Link to={href} className={className} data-active={active} onClick={onNavigate}>
      {content}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  useDbVersion();
  const { can, logout, session } = useAdminAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const nav = store.read().settings.adminNav.filter((item) => !item.hidden);
  const lowStock = store
    .read()
    .products.filter((p) => p.stock - p.reserved <= p.lowStockThreshold).length;

  return (
    <>
      <div className="admin-side-brand">
        <Link to="/admin" onClick={onNavigate} aria-label="GEEZMART admin home">
          <Logo height={18} />
        </Link>
        <span className="admin-side-badge">ADMIN</span>
      </div>

      <p className="admin-side-group">Control center</p>
      <nav className="stack" style={{ gap: 2 }} aria-label="Admin sections">
        {nav.map((item) => {
          const section = item.href.split('/')[2] ?? 'dashboard';
          const allowed = section === 'admin' ? true : can(section);
          const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <SidebarLink
              key={item.id}
              href={item.href}
              label={item.label}
              icon={item.icon as IconName}
              active={active}
              disabled={!allowed}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>

      <div className="spacer" />

      {lowStock ? (
        <Link to="/admin/inventory" className="list-row" onClick={onNavigate} style={{ marginBottom: 10 }}>
          <Icon name="bell" size={15} />
          <div style={{ minWidth: 0 }}>
            <p className="t-sm semi">{lowStock} low stock</p>
            <p className="admin-hint">Needs restocking</p>
          </div>
        </Link>
      ) : null}

      <Link to="/" className="admin-nav-item" onClick={onNavigate} style={{ marginBottom: 4 }}>
        <Icon name="home" size={17} />
        <span>View storefront</span>
      </Link>

      <button
        type="button"
        className="admin-nav-item"
        onClick={() => {
          logout();
          navigate('/admin/login');
        }}
      >
        <Icon name="logout" size={17} />
        <span>Logout</span>
      </button>

      <p className="admin-hint" style={{ padding: '10px 12px 0' }}>
        Signed in as {ROLE_LABELS[session?.role ?? 'support']}
      </p>
    </>
  );
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  useDbVersion();
  const notifications = store.read().notifications;
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <motion.button
        type="button"
        className="admin-modal-scrim"
        aria-label="Close notifications"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17 }}>Notifications</h2>
          <div className="row" style={{ gap: 8 }}>
            {unread ? (
              <button
                type="button"
                className="tool-btn"
                style={{ height: 30 }}
                onClick={() => store.write('notifications', (list) => list.map((n) => ({ ...n, read: true })))}
              >
                Mark all read
              </button>
            ) : null}
            <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        <div className="stack" style={{ gap: 8, maxHeight: '58vh', overflowY: 'auto' }}>
          {notifications.length ? (
            notifications.map((n) => (
              <Link
                key={n.id}
                to={n.href}
                onClick={() => {
                  store.write('notifications', (list) =>
                    list.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
                  );
                  onClose();
                }}
                className="list-row"
              >
                {n.read ? <span style={{ width: 7, flex: '0 0 7px' }} /> : <span className="notif-dot" />}
                <div style={{ minWidth: 0 }}>
                  <p className="t-sm semi">{n.title}</p>
                  <p className="admin-hint clamp-2">{n.body}</p>
                  <p className="admin-hint">{relativeTime(n.createdAt)}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="admin-hint">No notifications.</p>
          )}
        </div>
      </motion.div>
    </>
  );
}

function SidebarHost({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="admin-side">
      <SidebarContent onNavigate={onNavigate} />
    </aside>
  );
}

export default function AdminShell({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { user, session } = useAdminAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useDbVersion();
  const unread = store.read().notifications.filter((n) => !n.read).length;
  const settings = store.read().settings;

  useEffect(() => {
    setMenuOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  return (
    <div className="admin-root">
      <div className="admin-side-desktop">
        <SidebarHost />
      </div>

      <div className="admin-main">
        <header className="admin-head">
          <button
            type="button"
            className="icon-btn icon-btn-sm admin-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="grid" size={16} />
          </button>

          <div className="stack" style={{ gap: 1, minWidth: 0 }}>
            <span className="admin-kicker">Control center</span>
            <span className="t-sm semi" style={{ whiteSpace: 'nowrap' }}>
              {settings.storeName}
            </span>
          </div>

          <span className="spacer" />

          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => navigate('/shop')}
            aria-label="Open storefront"
            title="Open storefront"
          >
            <Icon name="home" size={16} />
          </button>

          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => setNotifOpen(true)}
            aria-label={`Notifications, ${unread} unread`}
            style={{ position: 'relative' }}
          >
            <Icon name="bell" size={16} />
            {unread ? (
              <span className="cart-badge" style={{ top: -2, right: -2 }}>
                {unread}
              </span>
            ) : null}
          </button>

          <div className="row" style={{ gap: 8, paddingLeft: 4 }}>
            <span className="avatar" style={{ width: 34, height: 34, flex: '0 0 34px', fontSize: 13 }}>
              {user?.avatarInitials ?? 'A'}
            </span>
            <span className="stack admin-user-meta" style={{ gap: 0 }}>
              <span className="t-sm semi nowrap">{user?.name ?? 'Admin'}</span>
              <span className="admin-hint nowrap">{user ? ROLE_LABELS[user.role] : ''}</span>
            </span>
          </div>
        </header>

        <main className="admin-body">
          {children ?? <Outlet />}
          <div style={{ marginTop: 26 }}>
            <IntegrationNote>
              Control-centre changes are stored locally in this build. Connect the mutation helpers in{' '}
              <code>src/lib/db.ts</code> to your API and every action becomes server-validated.
            </IntegrationNote>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.button
              type="button"
              className="admin-modal-scrim"
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="admin-side admin-mobile-side admin-mobile-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            >
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>{notifOpen ? <NotificationsPanel onClose={() => setNotifOpen(false)} /> : null}</AnimatePresence>

      <span className="sr-only" aria-live="polite">
        Signed in as {user?.name} ({session ? ROLE_LABELS[session.role] : ''})
      </span>
    </div>
  );
}
