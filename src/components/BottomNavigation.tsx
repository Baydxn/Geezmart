import { NavLink, useLocation } from 'react-router-dom';
import Icon, { type IconName } from './Icon';
import { useCart } from '../store/CartContext';

interface Item {
  to: string;
  label: string;
  icon: IconName;
}

export const NAV_ITEMS: Item[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/categories', label: 'Categories', icon: 'grid' },
  { to: '/wishlist', label: 'Wishlist', icon: 'heart' },
  { to: '/cart', label: 'Cart', icon: 'cart' },
  { to: '/account', label: 'Account', icon: 'user' },
];

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to);
}

export default function BottomNavigation() {
  const { pathname } = useLocation();
  const { itemCount } = useCart();

  return (
    <nav className="bottomnav-wrap" aria-label="Primary navigation">
      <div className="bottomnav">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.to);
          const showBadge = item.to === '/cart' && itemCount > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="bottomnav-item"
              data-active={active}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
            >
              <span className="icon-circle" data-active={active}>
                <Icon name={item.icon} size={20} strokeWidth={active ? 2 : 1.5} />
                {showBadge && (
                  <span className="nav-badge">{itemCount > 9 ? '9+' : itemCount}</span>
                )}
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}