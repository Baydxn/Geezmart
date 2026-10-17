import { Link, NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon';
import Logo from './Logo';
import { useCart } from '../store/CartContext';
import { useUI } from '../store/UIContext';

const GLASS_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/categories', label: 'Categories' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/cart', label: 'Cart' },
  { to: '/account', label: 'Account' },
];

export default function GlassNavigation() {
  const { pathname } = useLocation();
  const { itemCount } = useCart();
  const { openSearch, openCart } = useUI();

  return (
    <nav className="glass-nav" aria-label="Primary navigation">
      <div className="glass-nav-inner">
        <div className="glass-brand">
          <Link to="/" aria-label="Geezmart home">
            <Logo height={20} />
          </Link>
        </div>

        <div className="glass-links">
          {GLASS_LINKS.map((link) => {
            const active = pathname === link.to || (link.to !== '/' && pathname.startsWith(link.to));
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={`glass-link${active ? ' glass-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </NavLink>
            );
          })}
        </div>

        <div className="glass-actions">
          <button
            type="button"
            className="glass-icon-btn"
            onClick={openSearch}
            aria-label="Search GEEZMART"
          >
            <Icon name="search" size={18} />
          </button>
          <button
            type="button"
            className="glass-icon-btn cart-btn"
            onClick={openCart}
            aria-label={`Cart, ${itemCount} items`}
          >
            <Icon name="cart" size={18} />
            {itemCount > 0 && (
              <span className="glass-badge">{itemCount > 9 ? '9+' : itemCount}</span>
            )}
          </button>
          <button type="button" className="glass-icon-btn" aria-label="Your account">
            <Icon name="user" size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}