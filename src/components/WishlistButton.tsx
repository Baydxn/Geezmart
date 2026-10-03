import { motion } from 'framer-motion';
import type { Product } from '../types';
import { useWishlist } from '../store/WishlistContext';

export function WishlistButton({
  product,
  className = 'p-card-fav',
  size = 17,
}: {
  product: Product;
  className?: string;
  size?: number;
}) {
  const { has, toggle } = useWishlist();
  const active = has(product.id);

  return (
    <motion.button
      type="button"
      className={className}
      data-active={active}
      whileTap={{ scale: 0.82 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(product);
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      title={active ? 'Remove from wishlist' : 'Save to wishlist'}
    >
      <motion.span
        key={String(active)}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 18 }}
        className="row"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 20s-7.5-4.6-7.5-9.5A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.9c0 4.9-7.5 9.5-7.5 9.5Z" />
        </svg>
      </motion.span>
    </motion.button>
  );
}

export default WishlistButton;