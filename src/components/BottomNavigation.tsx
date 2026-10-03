import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon, { type IconName } from './Icon';

interface Item {
  to: string;
  label: string;
  icon: IconName;
}

export const NAV_ITEMS: Item[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/shop', label: 'Shop', icon: 'shop' },
  { to: '/categories', label: 'Categories', icon: 'grid' },
  { to: '/orders', label: 'Orders', icon: 'orders' },
  { to: '/account', label: 'Account', icon: 'user' },
];

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to);
}

export default function BottomNavigation() {
  const { pathname } = useLocation();

  return (
    <nav className="bottomnav-wrap" aria-label="Primary">
      <div className="bottomnav">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="bottomnav-item"
              data-active={active}
              aria-current={active ? 'page' : undefined}
            >
              {active ? (
                <motion.span
                  layoutId="bottomnav-bubble"
                  className="bottomnav-bubble"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <motion.span
                whileTap={{ scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="row"
              >
                <Icon name={item.icon} size={19} strokeWidth={active ? 2 : 1.7} />
              </motion.span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}