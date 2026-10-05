import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/Icon';
import { CartItem } from '../components/CartDrawer';
import ProductGrid from '../components/ProductGrid';
import { useCart } from '../store/CartContext';
import { formatPrice } from '../lib/format';
import { listCollection } from '../lib/api';
import { useEffect, useState } from 'react';
import type { Product } from '../types';

export default function Cart() {
  const { lines, totals, isEmpty, remove } = useCart();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;
    listCollection('featured', 6).then((items) => {
      if (active) setSuggestions(items.filter((item) => !lines.some((l) => l.productId === item.id)).slice(0, 4));
    });
    return () => {
      active = false;
    };
  }, [lines]);

  if (isEmpty) {
    return (
      <>
        <header className="page-head">
          <div>
            <p className="section-kicker">Basket</p>
            <h1 className="page-title">Your Cart</h1>
          </div>
        </header>

        <div className="empty">
          <motion.div
            className="empty-orb"
            initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            <Icon name="cart" size={42} />
          </motion.div>
          <h2>Your cart is empty.</h2>
          <p className="text-3 t-md">&ldquo;Find something worth taking home.&rdquo;</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/shop')}>
            Start Shopping
            <Icon name="arrowRight" size={17} />
          </button>
        </div>

        {suggestions.length ? (
          <section className="section">
            <div className="section-head">
              <h2 className="section-title">You Might Like</h2>
              <Link className="link-more" to="/shop">
                View All
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>
            <ProductGrid products={suggestions} />
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">Basket</p>
          <h1 className="page-title">Your Cart</h1>
        </div>
        <span className="chip chip-eyebrow">
          {totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'}
        </span>
      </header>

      <div
        className="stack"
        style={{ gap: 16, paddingBottom: 18, borderBottom: '1px solid var(--line)', marginBottom: 18 }}
      >
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <CartItem key={line.lineId} line={line} />
          ))}
        </AnimatePresence>
      </div>

      <section className="summary" aria-label="Order summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.strong
              key={totals.subtotal}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="inline-block"
            >
              {formatPrice(totals.subtotal)}
            </motion.strong>
          </AnimatePresence>
        </div>
        <div className="summary-row">
          <span>Delivery</span>
          <span>{totals.delivery === 0 ? 'Free' : formatPrice(totals.delivery)}</span>
        </div>
        {totals.discount > 0 ? (
          <div className="summary-row">
            <span>Discount</span>
            <span>&minus;{formatPrice(totals.discount)}</span>
          </div>
        ) : null}
        <div className="summary-row summary-total">
          <span>Total</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={totals.total}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="inline-block"
            >
              {formatPrice(totals.total)}
            </motion.span>
          </AnimatePresence>
        </div>
      </section>

      <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <Link to="/shop" className="btn btn-ghost btn-lg" style={{ flex: 1 }}>
          Continue Shopping
        </Link>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          style={{ flex: 2 }}
          onClick={() => navigate('/checkout')}
        >
          Checkout
          <Icon name="arrowRight" size={17} />
        </button>
      </div>

      {lines.length > 1 ? (
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="link-more"
            onClick={() => lines.forEach((line) => remove(line.lineId))}
          >
            <Icon name="trash" size={14} />
            Clear cart
          </button>
        </div>
      ) : null}

      {suggestions.length ? (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Add These Too</h2>
            <Link className="link-more" to="/shop">
              View All
              <Icon name="arrowRight" size={15} />
            </Link>
          </div>
          <ProductGrid products={suggestions} />
        </section>
      ) : null}
    </>
  );
}

