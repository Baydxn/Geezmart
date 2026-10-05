import Icon from './Icon';
import { useCategories } from '../store/useCatalog';
import type { CategoryId, Filters } from '../types';
import { emptyFilters } from '../lib/api';

export const RATINGS = [4.5, 4, 3.5];

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Filter form body — reused by the sheet. */
export default function FilterGroups({
  filters,
  patch,
  brands,
  priceMin,
  priceMax,
}: {
  filters: Filters;
  patch: (next: Partial<Filters>) => void;
  /** Supplied by the caller so the bounds come from the hydrated catalogue. */
  brands: string[];
  priceMin: number;
  priceMax: number;
}) {
  const categories = useCategories();
  return (
    <>
      <div className="filter-group">
        <p className="cat-group-title">Category</p>
        {categories.map((category) => {
          const active = filters.categoryIds.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              className="check-row"
              data-active={active}
              onClick={() => patch({ categoryIds: toggleIn<CategoryId>(filters.categoryIds, category.id) })}
            >
              <span className="check-box">{active ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}</span>
              {category.name}
            </button>
          );
        })}
      </div>

      <div className="filter-group">
        <p className="cat-group-title">Product Type</p>
        {categories
          .filter((c) => filters.categoryIds.length === 0 || filters.categoryIds.includes(c.id))
          .flatMap((c) => c.subcategories)
          .map((sub) => {
            const active = filters.subcategoryIds.includes(sub.id);
            return (
              <button
                key={sub.id}
                type="button"
                className="check-row"
                data-active={active}
                onClick={() => patch({ subcategoryIds: toggleIn(filters.subcategoryIds, sub.id) })}
              >
                <span className="check-box">
                  {active ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
                </span>
                {sub.name}
              </button>
            );
          })}
      </div>

      <div className="filter-group">
        <p className="cat-group-title">
          Price ({priceMin.toLocaleString()} — {priceMax.toLocaleString()})
        </p>
        <div className="row" style={{ gap: 10 }}>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="Min"
            aria-label="Minimum price"
            value={filters.minPrice ?? ''}
            onChange={(e) => patch({ minPrice: e.target.value ? Number(e.target.value) : null })}
          />
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="Max"
            aria-label="Maximum price"
            value={filters.maxPrice ?? ''}
            onChange={(e) => patch({ maxPrice: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="filter-group">
        <p className="cat-group-title">Brand</p>
        {brands.map((brand) => {
          const active = filters.brands.includes(brand);
          return (
            <button
              key={brand}
              type="button"
              className="check-row"
              data-active={active}
              onClick={() => patch({ brands: toggleIn(filters.brands, brand) })}
            >
              <span className="check-box">{active ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}</span>
              {brand}
            </button>
          );
        })}
      </div>

      <div className="filter-group">
        <p className="cat-group-title">Rating</p>
        {RATINGS.map((rating) => {
          const active = filters.minRating === rating;
          return (
            <button
              key={rating}
              type="button"
              className="check-row"
              data-active={active}
              onClick={() => patch({ minRating: active ? 0 : rating })}
            >
              <span className="check-box">{active ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}</span>
              {rating} &amp; up
            </button>
          );
        })}
      </div>

      <div className="filter-group">
        <p className="cat-group-title">Availability</p>
        <button
          type="button"
          className="check-row"
          data-active={filters.inStockOnly}
          onClick={() => patch({ inStockOnly: !filters.inStockOnly })}
        >
          <span className="check-box">
            {filters.inStockOnly ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
          </span>
          In stock only
        </button>
      </div>
    </>
  );
}

/** Single source of truth for a blank filter state (defined in the API layer). */
export const EMPTY_FILTERS: Filters = emptyFilters;