import type { Product } from '../types';
import ProductCard from './ProductCard';

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} index={i} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="p-card" key={i}>
          <div className="skeleton" style={{ aspectRatio: '1 / 1.04', borderRadius: 0 }} />
          <div className="p-card-body">
            <div className="skeleton" style={{ height: 8, width: '42%' }} />
            <div className="skeleton" style={{ height: 13, width: '88%' }} />
            <div className="skeleton" style={{ height: 13, width: '62%' }} />
            <div className="skeleton" style={{ height: 16, width: '48%', marginTop: 6 }} />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <div className="skeleton" style={{ height: 10, width: 54 }} />
              <div className="skeleton" style={{ height: 34, width: 34, borderRadius: 999 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProductGrid;