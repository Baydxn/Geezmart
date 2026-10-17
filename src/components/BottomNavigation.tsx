import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from './Icon';
import { useCart } from '../store/CartContext';
import { useEffect, useState } from 'react';

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
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop/tablet viewport so we never show bottom nav alongside desktop header.
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (isDesktop) return null;

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
              onClick={() => navigate(item.to, { replace: false })}
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