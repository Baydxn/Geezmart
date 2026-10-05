import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Product } from '../types';
import Icon from './Icon';
import Rating from './Rating';
import WishlistButton from './WishlistButton';
import { useCart } from '../store/CartContext';
import { formatPrice } from '../lib/format';
import { resolveProductImage } from '../lib/productImage';
import { useCategory } from '../store/useCatalog';

/**
 * ProductCard — the core merchandising unit.
 * Data-driven: nothing here is hard-coded per product.
 */
function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const category = useCategory(product.categoryId);
  const image = resolveProductImage(product);

  const handleAdd = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    add(product);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <motion.article
      className="p-card"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.045, 0.25), ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.985 }}
    >
      <Link to={`/product/${product.slug}`} className="p-card-media" aria-label={product.name}>
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          width={640}
          height={666}
        />
        {product.badges.length ? (
          <span className="p-card-badges">
            {product.badges.map((badge) => (
              <span key={badge} className="p-badge" data-tone="invert">
                {badge}
              </span>
            ))}
          </span>
        ) : null}
      </Link>

      <WishlistButton product={product} />

      <Link to={`/product/${product.slug}`} className="p-card-body">
        <span className="p-card-cat">{category?.name ?? 'GEEZMART'}</span>
        <h3 className="p-card-name clamp-2">{product.name}</h3>
        <p className="p-card-desc clamp-2">{product.blurb}</p>
        <p className="p-card-price">
          {formatPrice(product.price, product.currency)}
          {product.compareAtPrice ? (
            <span className="p-card-price-old">{formatPrice(product.compareAtPrice, product.currency)}</span>
          ) : null}
        </p>
        <span className="p-card-foot">
          <Rating value={product.rating} size={10} showCount={false} />
          <span
            className="p-add"
            data-state={justAdded ? 'added' : 'idle'}
            role="button"
            tabIndex={0}
            aria-label={`Add ${product.name} to cart`}
            onClick={handleAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAdd(e as unknown as React.MouseEvent);
              }
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {justAdded ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                  className="row"
                >
                  <Icon name="check" size={16} strokeWidth={2.2} />
                </motion.span>
              ) : (
                <motion.span key="plus" initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="row">
                  <Icon name="plus" size={16} strokeWidth={2} />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </span>
      </Link>
    </motion.article>
  );
}

export default memo(ProductCard);