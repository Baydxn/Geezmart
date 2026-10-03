/** Skeleton loaders — dark-theme, shimmer-based, matching final layout. */

export function ProductCardSkeleton() {
  return (
    <div className="p-card">
      <div className="skeleton" style={{ aspectRatio: '1 / 1.04', borderRadius: 0 }} />
      <div className="p-card-body">
        <div className="skeleton" style={{ height: 8, width: '42%' }} />
        <div className="skeleton" style={{ height: 13, width: '88%' }} />
        <div className="skeleton" style={{ height: 13, width: '62%' }} />
        <div className="skeleton" style={{ height: 16, width: '48%', marginTop: 6 }} />
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="hero" aria-hidden="true">
      <div className="skeleton" style={{ minHeight: 340, borderRadius: 'inherit' }} />
    </div>
  );
}

export function CategorySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="cat-strip" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: 88, height: 88, borderRadius: 'var(--r-2xl)' }} />
      ))}
    </div>
  );
}

export function SectionSkeleton({ rows = 2, count = 4 }: { rows?: number; count?: number }) {
  return (
    <div className="stack" aria-hidden="true">
      <div className="skeleton" style={{ height: 18, width: 148, marginBottom: 14 }} />
      <div className="stack" style={{ gap: 12 }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div className="product-grid" key={r}>
            {Array.from({ length: count }).map((__, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="line-item" key={i}>
          <div className="skeleton" style={{ borderRadius: 'var(--r-sm)' }} />
          <div className="stack" style={{ gap: 8 }}>
            <div className="skeleton" style={{ height: 13, width: '75%' }} />
            <div className="skeleton" style={{ height: 11, width: '45%' }} />
            <div className="skeleton" style={{ height: 30, width: 120, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}