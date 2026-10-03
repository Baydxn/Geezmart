export default function CartDrawer() {
  const { cartOpen, closeCart } = useUI();
  const { lines, totals, isEmpty } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = cartOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [cartOpen]);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCart();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cartOpen, closeCart]);

  const go = (path: string) => {
    closeCart();
    navigate(path);
  };

  return (
    <AnimatePresence>
      {cartOpen ? (
        <>
          <motion.button
            type="button"
            className="scrim"
            aria-label="Close cart"
            onClick={closeCart}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <span className="drawer-grip" />
            <header className="drawer-head">
              <h2 style={{ fontSize: 18 }}>
                Your Cart{' '}
                <span className="text-3 t-sm semi">
                  ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'})
                </span>
              </h2>
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                onClick={closeCart}
                aria-label="Close cart"
              >
                <Icon name="close" size={16} />
              </button>
            </header>

            <div className="drawer-body">
              {isEmpty ? (
                <div className="empty">
                  <motion.div
                    className="empty-orb"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  >
                    <Icon name="cart" size={38} />
                  </motion.div>
                  <h3>Your cart is empty.</h3>
                  <p className="text-3 t-sm">Find something worth taking home.</p>
                  <button type="button" className="btn btn-primary btn-md" onClick={() => go('/shop')}>
                    Start Shopping
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {lines.map((line) => (
                    <CartItem key={line.lineId} line={line} />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {!isEmpty ? (
              <footer className="drawer-foot">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>{formatPrice(totals.subtotal)}</strong>
                </div>
                <div className="summary-row" style={{ paddingBottom: 12 }}>
                  <span className="text-3 t-xs">Delivery calculated at checkout</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-md btn-block"
                  onClick={() => go('/cart')}
                >
                  View Cart
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-md btn-block"
                  style={{ marginTop: 8 }}
                  onClick={() => go('/checkout')}
                >
                  Checkout
                  <Icon name="arrowRight" size={16} />
                </button>
              </footer>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';
import QuantitySelector from './QuantitySelector';
import { useCart, type DetailedCartLine } from '../store/CartContext';
import { useUI } from '../store/UIContext';
import { formatPrice } from '../lib/format';
import { resolveProductImage } from '../lib/productImage';

export function CartItem({ line }: { line: DetailedCartLine }) {
  const { setQuantity, remove } = useCart();
  const { product } = line;

  return (
    <motion.div
      className="line-item"
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: -10 }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
    >
      <Link to={`/product/${product.slug}`} className="line-thumb">
        <img
          src={resolveProductImage(
            product,
            Math.max(0, product.colors.findIndex((c) => c.id === line.variantId)),
          )}
          alt={product.name}
          loading="lazy"
          width={92}
          height={92}
        />
      </Link>
      <div className="line-side">
        <Link to={`/product/${product.slug}`} className="t-sm bold clamp-2">
          {product.name}
        </Link>
        <span className="text-3 t-xs">{line.variantLabel}</span>
        <span className="t-sm semi">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={line.lineTotal}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="inline-block"
            >
              {formatPrice(line.lineTotal, product.currency)}
            </motion.span>
          </AnimatePresence>
        </span>
        <div className="line-foot">
          <QuantitySelector
            value={line.quantity}
            onChange={(q) => setQuantity(line.lineId, q)}
            size="sm"
            max={Math.max(1, product.stock)}
          />
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => remove(line.lineId)}
            aria-label={`Remove ${product.name} from cart`}
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
