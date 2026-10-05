import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import ProductGrid, { ProductGridSkeleton } from '../components/ProductGrid';
import FilterSheet from '../components/FilterSheet';
import { EMPTY_FILTERS } from '../components/FilterGroups';
import { useCategories } from '../store/useCatalog';
import {
  activeFilterCount,
  applyFilters,
  listProducts,
  searchProducts,
  sortProducts,
  SORT_OPTIONS,
} from '../lib/api';
import type { CategoryId, Filters, Product, SortKey } from '../types';
import { useUI } from '../store/UIContext';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { openSearch, openSheet } = useUI();
  const categories = useCategories();

  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [sort, setSort] = useState<SortKey>('recommended');
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState<string | null>(null);
  const [items, setItems] = useState<Product[] | null>(null);
  const [count, setCount] = useState(0);

  // URL params (from search overlay / category menu / hero CTAs) seed state.
  useEffect(() => {
    const category = params.get('category');
    const sub = params.get('sub');
    const q = params.get('q');
    const sortParam = params.get('sort');
    const collectionParam = params.get('collection');

    setFilters((current) => ({
      ...current,
      categoryIds: category ? ([category as CategoryId] as CategoryId[]) : [],
      subcategoryIds: sub ? [sub] : [],
    }));
    if (q) setQuery(q);
    if (sortParam && SORT_OPTIONS.some((o) => o.key === sortParam)) setSort(sortParam as SortKey);
    setCollection(collectionParam);
  }, [params]);

  useEffect(() => {
    let active = true;
    setItems(null);

    const run = async () => {
      let list = query.trim()
        ? sortProducts(applyFilters(await searchProducts(query), filters), sort)
        : await listProducts({ filters, sort });

      if (collection) {
        list = list.filter((p) => p.collections[collection as keyof Product['collections']]);
      }
      if (!active) return;
      setItems(list);
      setCount(list.length);
    };

    const t = window.setTimeout(run, query.trim() ? 200 : 0);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [filters, sort, query, collection]);

  const filterCount = activeFilterCount(filters);
  const activeCategory = categories.find((c) => c.id === filters.categoryIds[0]);

  const selectCategory = (id: CategoryId | null) => {
    setFilters((f) => ({ ...f, categoryIds: id ? [id] : [], subcategoryIds: [] }));
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">Catalogue</p>
          <h1 className="page-title">Shop</h1>
        </div>
        <button type="button" className="tool-btn" onClick={openSearch} aria-label="Search products">
          <Icon name="search" size={16} />
          Search
        </button>
      </header>

      {query.trim() ? (
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <span className="chip chip-eyebrow">Results for &ldquo;{query}&rdquo;</span>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setQuery('');
              const next = new URLSearchParams(params);
              next.delete('q');
              setParams(next, { replace: true });
            }}
          >
            Clear
            <Icon name="close" size={12} />
          </button>
        </div>
      ) : null}

      <div className="hscroll" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className="chip"
          data-active={filters.categoryIds.length === 0}
          onClick={() => selectCategory(null)}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="chip"
            data-active={filters.categoryIds.includes(category.id)}
            onClick={() => selectCategory(filters.categoryIds.includes(category.id) ? null : category.id)}
          >
            <Icon name={category.icon as IconName} size={13} />
            {category.name}
          </button>
        ))}
      </div>

      <div className="toolbar" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="text-3 t-sm">{items ? `${count} products` : 'Loading...'}</span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="tool-btn" onClick={() => openSheet('sort')}>
            <Icon name="sort" size={15} />
            <span className="nowrap">{SORT_OPTIONS.find((o) => o.key === sort)?.label}</span>
          </button>
          <button type="button" className="tool-btn" onClick={() => openSheet('filters')}>
            <Icon name="sliders" size={15} />
            Filters
            {filterCount > 0 ? <span className="count-pill">{filterCount}</span> : null}
          </button>
        </div>
      </div>

      {activeCategory ? (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {activeCategory.subcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              className="chip"
              data-active={filters.subcategoryIds.includes(sub.id)}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  subcategoryIds: f.subcategoryIds.includes(sub.id)
                    ? f.subcategoryIds.filter((id) => id !== sub.id)
                    : [...f.subcategoryIds, sub.id],
                }))
              }
            >
              {sub.name}
            </button>
          ))}
        </div>
      ) : null}

      {items === null ? (
        <ProductGridSkeleton count={8} />
      ) : items.length ? (
        <ProductGrid products={items} />
      ) : (
        <div className="empty">
          <div className="empty-orb">
            <Icon name="search" size={32} />
          </div>
          <h3>No products match</h3>
          <p className="text-3 t-sm">Try removing a filter or searching something else.</p>
          <button
            type="button"
            className="btn btn-outline btn-md"
            onClick={() => {
              setFilters({ ...EMPTY_FILTERS });
              setSort('recommended');
              setCollection(null);
            }}
          >
            Reset all
          </button>
        </div>
      )}

      <FilterSheet
        filters={filters}
        sort={sort}
        onChange={setFilters}
        onSort={setSort}
        resultCount={count}
      />
    </>
  );
}
