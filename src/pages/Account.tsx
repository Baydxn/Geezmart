import { Link } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import { useWishlist } from '../store/WishlistContext';
import { useOrders } from '../store/OrdersContext';
import { useToast } from '../store/ToastContext';

const USER = {
  name: 'Eriqk Okoro',
  email: 'eriqk@geezmart.shop',
  phone: '+234 800 000 0000',
};

export default function Account() {
  const { items } = useWishlist();
  const { orders } = useOrders();
  const { notify } = useToast();

  const menu: { label: string; icon: IconName; to?: string; value?: string; onClick?: () => void }[] = [
    { label: 'My Orders', icon: 'orders', to: '/orders', value: `${orders.length}` },
    { label: 'Saved Products', icon: 'heart', to: '/wishlist', value: `${items.length}` },
    { label: 'Addresses', icon: 'pin', onClick: () => notify('Address book coming soon') },
    { label: 'Payment Methods', icon: 'card', onClick: () => notify('No saved payment methods yet') },
    { label: 'Notifications', icon: 'bell', onClick: () => notify('Notifications are all caught up') },
    { label: 'Help & Support', icon: 'help', onClick: () => notify('Support: help@geezmart.shop') },
    { label: 'Settings', icon: 'settings', onClick: () => notify('Settings saved automatically') },
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">Profile</p>
          <h1 className="page-title">Account</h1>
        </div>
      </header>

      <section className="account-hero">
        <span className="avatar" aria-hidden="true">
          EO
        </span>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h2 style={{ fontSize: 19 }}>{USER.name}</h2>
          <p className="text-3 t-xs clamp-2">{USER.email}</p>
          <p className="text-3 t-xs">{USER.phone}</p>
        </div>
        <span className="spacer" />
        <span className="status-pill" data-tone="solid">
          Member
        </span>
      </section>

      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <div className="summary" style={{ flex: 1 }}>
          <div className="summary-row">
            <span className="text-3 t-sm">Orders</span>
            <strong>{orders.length}</strong>
          </div>
        </div>
        <div className="summary" style={{ flex: 1 }}>
          <div className="summary-row">
            <span className="text-3 t-sm">Saved</span>
            <strong>{items.length}</strong>
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 10, marginTop: 18 }}>
        {menu.map((item) => {
          const inner = (
            <>
              <span className="menu-icon">
                <Icon name={item.icon} size={18} />
              </span>
              <span className="stack" style={{ gap: 2 }}>
                <span className="semi t-md">{item.label}</span>
                {item.value ? <span className="text-3 t-xs">{item.value} total</span> : null}
              </span>
              <span className="spacer" />
              <Icon name="chevronRight" size={16} className="text-3" />
            </>
          );
          return item.to ? (
            <Link key={item.label} className="menu-card" to={item.to}>
              {inner}
            </Link>
          ) : (
            <button key={item.label} type="button" className="menu-card" onClick={item.onClick}>
              {inner}
            </button>
          );
        })}

        <button
          type="button"
          className="menu-card"
          onClick={() => notify('You have been signed out (demo)')}
        >
          <span className="menu-icon">
            <Icon name="logout" size={18} />
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="semi t-md">Logout</span>
            <span className="text-3 t-xs">Sign out of this device</span>
          </span>
          <span className="spacer" />
          <Icon name="chevronRight" size={16} className="text-3" />
        </button>
      </div>
    </>
  );
}