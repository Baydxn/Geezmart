import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import ProductGrid, { ProductGridSkeleton } from './ProductGrid';
import ProductCard from './ProductCard';
import { listCollection } from '../lib/api';
import type { Product } from '../types';

interface ProductSectionProps {
  collection: keyof Product['collections'];
  title: string;
  kicker?: string;
  viewAll?: string;
  limit?: number;
}

/** Homepage merchandising block: skeleton while loading, then a product grid. */
/** Single product tile used by custom homepage sections. */
export function SingleProduct({ product }: { product: Product }) {
  return <ProductCard product={product} />
}

export default function ProductSection({
  collection,
  title,
  kicker,
  viewAll = '/shop',
  limit = 6,
}: ProductSectionProps) {
  const [items, setItems] = useState<Product[] | null>(null);

  useEffect(() => {
    let active = true;
    listCollection(collection, limit).then((result) => {
      if (active) setItems(result);
    });
    return () => {
      active = false;
    };
  }, [collection, limit]);

  if (!items) {
    return (
      <section className="section" aria-busy="true">
        <div className="skeleton" style={{ height: 18, width: 160, marginBottom: 14 }} />
        <ProductGridSkeleton count={4} />
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="section">
      <div className="section-head">
        <div>
          {kicker ? <p className="section-kicker">{kicker}</p> : null}
          <h2 className="section-title">{title}</h2>
        </div>
        <Link className="link-more" to={viewAll}>
          View All
          <Icon name="arrowRight" size={15} />
        </Link>
      </div>
      <ProductGrid products={items} />
    </section>
  );
}
