function IdleState({
  recent,
  onPick,
  onSubmit,
  onClear,
}: {
  recent: string[];
  onPick: (term: string) => void;
  onSubmit: (term: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      {recent.length ? (
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section-head">
            <h2 className="section-title">Recent Searches</h2>
            <button type="button" className="link-more" onClick={onClear}>
              Clear
            </button>
          </div>
          {recent.map((term) => (
            <button key={term} type="button" className="search-sug" onClick={() => onSubmit(term)}>
              <Icon name="clock" size={16} />
              {term}
            </button>
          ))}
        </section>
      ) : null}

      <section className="section" style={{ marginTop: recent.length ? 22 : 0 }}>
        <h2 className="section-title" style={{ marginBottom: 12 }}>
          Popular Searches
        </h2>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {POPULAR_SEARCHES.map((term) => (
            <motion.button
              key={term}
              type="button"
              className="chip"
              whileTap={{ scale: 0.94 }}
              onClick={() => onPick(term)}
            >
              <Icon name="search" size={13} />
              {term}
            </motion.button>
          ))}
        </div>
      </section>
    </>
  );
}

function ResultsState({
  query,
  tab,
  setTab,
  loading,
  results,
  cats,
  onSubmit,
}: {
  query: string;
  tab: 'products' | 'categories';
  setTab: (tab: 'products' | 'categories') => void;
  loading: boolean;
  results: Product[];
  cats: Category[];
  onSubmit: (term: string) => void;
}) {
  return (
    <>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {(['products', 'categories'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className="tab"
            data-active={tab === key}
            onClick={() => setTab(key)}
          >
            {tab === key ? (
              <motion.span
                layoutId="search-tab"
                className="tab-bubble"
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              />
            ) : null}
            <span>
              {key === 'products' ? `Products (${results.length})` : `Categories (${cats.length})`}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="product-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="p-card" key={i}>
              <div className="skeleton" style={{ aspectRatio: '1 / 1.04', borderRadius: 0 }} />
              <div className="p-card-body">
                <div className="skeleton" style={{ height: 12, width: '80%' }} />
                <div className="skeleton" style={{ height: 14, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'products' ? (
        results.length ? (
          <div className="product-grid">
            {results.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyResults query={query} />
        )
      ) : cats.length ? (
        <div className="stack">
          {cats.map((category) => (
            <button
              key={category.id}
              type="button"
              className="search-sug"
              onClick={() => onSubmit(category.name)}
            >
              <Icon name={category.icon as never} size={16} />
              <span className="bold">{category.name}</span>
              <span className="text-3 t-xs">{category.subcategories.length} options</span>
              <span className="spacer" />
              <Icon name="chevronRight" size={16} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyResults query={query} />
      )}

      <button
        type="button"
        className="btn btn-outline btn-md btn-block"
        style={{ marginTop: 22 }}
        onClick={() => onSubmit(query)}
      >
        See all results for &ldquo;{query}&rdquo;
        <Icon name="arrowRight" size={16} />
      </button>
    </>
  );
}
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';
import ProductCard from './ProductCard';
import { useUI } from '../store/UIContext';
import { POPULAR_SEARCHES, searchCategories, searchProducts } from '../lib/api';
import type { Category, Product } from '../types';

const RECENT_KEY = 'geezmart.recent.v1';

function EmptyResults({ query }: { query: string }) {
  return (
    <div className="empty">
      <div className="empty-orb">
        <Icon name="search" size={34} />
      </div>
      <h3>No matches for &ldquo;{query}&rdquo;</h3>
      <p className="text-3 t-sm">Try a broader term &mdash; &ldquo;watch&rdquo;, &ldquo;audio&rdquo;, &ldquo;grooming&rdquo;.</p>
    </div>
  );
}

export default function SearchOverlay() {
  const { searchOpen, closeSearch } = useUI();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [results, setResults] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'));
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 120);
      return () => window.clearTimeout(t);
    }
    setQuery('');
    setResults([]);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, closeSearch]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setCats([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      const [p, c] = await Promise.all([searchProducts(query), searchCategories(query)]);
      if (cancelled) return;
      setResults(p);
      setCats(c);
      setLoading(false);
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  const remember = useCallback((term: string) => {
    if (!term.trim()) return;
    setRecent((list) => {
      const next = [term, ...list.filter((r) => r !== term)].slice(0, 6);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const submit = (term: string) => {
    remember(term);
    closeSearch();
    navigate(`/shop?q=${encodeURIComponent(term)}`);
  };

  const hasQuery = query.trim().length > 0;

  return (
    <AnimatePresence>
      {searchOpen ? (
        <motion.div
          className="search"
          role="dialog"
          aria-modal="true"
          aria-label="Search GEEZMART"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="search-bar">
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={closeSearch}
              aria-label="Close search"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                ref={inputRef}
                className="search-input"
                type="search"
                value={query}
                placeholder="Search GEEZMART"
                aria-label="Search products and categories"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit(query)}
              />
              {hasQuery ? (
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <Icon name="close" size={15} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="search-body">
            {!hasQuery ? (
              <IdleState
                recent={recent}
                onPick={setQuery}
                onSubmit={submit}
                onClear={() => setRecent([])}
              />
            ) : (
              <ResultsState
                query={query}
                tab={tab}
                setTab={setTab}
                loading={loading}
                results={results}
                cats={cats}
                onSubmit={submit}
              />
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}