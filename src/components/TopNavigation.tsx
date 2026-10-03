/** Detail pages get a back-arrow variant of the same header. */
export function BackHeader({ fallback = -1 }: { fallback?: number | string }) {
  const { openSearch, openCart } = useUI();
  const navigate = useNavigate();
  const { itemCount } = useCart();

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="topnav-side">
          <button
            type="button"
            className="nav-circle"
            aria-label="Go back"
            onClick={() => navigate(fallback as number)}
          >
            <Icon name="chevronLeft" size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="brand-center">
          <Link to="/" aria-label="GEEZMART home">
            <Logo height={19} />
          </Link>
        </div>
        <div className="topnav-side right">
          <button
            type="button"
            className="nav-circle"
            onClick={openSearch}
            aria-label="Search GEEZMART"
          >
            <Icon name="search" size={18} />
          </button>
          <button
            type="button"
            className="nav-circle cart-btn"
            onClick={openCart}
            aria-label={`Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
          >
            <Icon name="cart" size={18} />
            {itemCount > 0 ? <span className="cart-badge">{itemCount}</span> : null}
          </button>
        </div>
      </div>
    </header>
  );
}
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';
import Logo from './Logo';
import { useCart } from '../store/CartContext';
import { useUI } from '../store/UIContext';

const DESK_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/categories', label: 'Categories' },
  { to: '/orders', label: 'Orders' },
  { to: '/account', label: 'Account' },
];

export default function TopNavigation() {
  const [scrolled, setScrolled] = useState(false);
  const [ripple, setRipple] = useState(false);
  const { itemCount } = useCart();
  const { openCart, openSearch } = useUI();
  const { pathname } = useLocation();
  const prevCount = useRef(itemCount);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Subtle cart feedback whenever the item count changes.
  useEffect(() => {
    if (itemCount > prevCount.current) {
      setRipple(true);
      const t = window.setTimeout(() => setRipple(false), 420);
      prevCount.current = itemCount;
      return () => window.clearTimeout(t);
    }
    prevCount.current = itemCount;
  }, [itemCount]);

  return (
    <header className="topnav" data-scrolled={scrolled}>
      <div className="topnav-inner">
        {/* LEFT: account + desktop nav */}
        <div className="topnav-side">
          <Link to="/account" className="nav-circle" aria-label="Your account">
            <Icon name="user" size={18} />
          </Link>
          <nav className="desknav" aria-label="Primary">
            {DESK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="desknav-link"
                data-active={pathname === link.to}
              >
                {pathname === link.to ? (
                  <motion.span
                    layoutId="desknav-bubble"
                    className="desknav-bubble"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* CENTER: logo dominates the bar */}
        <div className="brand-center">
          <Link to="/" aria-label="GEEZMART home" onClick={() => window.scrollTo({ top: 0 })}>
            <Logo height={21} />
          </Link>
        </div>

        {/* RIGHT: search + cart */}
        <div className="topnav-side right">
          <button
            type="button"
            className="nav-circle"
            onClick={openSearch}
            aria-label="Search GEEZMART"
          >
            <Icon name="search" size={18} />
          </button>
          <button
            type="button"
            className="nav-circle cart-btn"
            onClick={openCart}
            aria-label={`Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
          >
            <AnimatePresence>
              {ripple ? (
                <motion.span
                  key="ripple"
                  className="cart-ripple"
                  initial={{ scale: 0.7, opacity: 0.85 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              ) : null}
            </AnimatePresence>
            <motion.span
              animate={ripple ? { scale: [1, 1.18, 1] } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}
              className="row"
            >
              <Icon name="cart" size={18} />
            </motion.span>
            <AnimatePresence>
              {itemCount > 0 ? (
                <motion.span
                  key={itemCount}
                  className="cart-badge"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 560, damping: 18 }}
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {itemCount} items in cart
      </span>
    </header>
  );
}
