import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';
import FilterGroups, { EMPTY_FILTERS } from './FilterGroups';
import { useUI } from '../store/UIContext';
import { useDbVersion } from '../admin/AdminContext';
import { listBrands, priceBounds, SORT_OPTIONS } from '../lib/api';
import type { Filters, SortKey } from '../types';

interface FilterSheetProps {
  filters: Filters;
  sort: SortKey;
  onChange: (filters: Filters) => void;
  onSort: (sort: SortKey) => void;
  resultCount: number;
}

/** Filter + sort bottom sheet (centred modal on desktop). */
export default function FilterSheet({ filters, sort, onChange, onSort, resultCount }: FilterSheetProps) {
  const { sheet, closeSheet } = useUI();
  const open = sheet !== null;
  useDbVersion();
  // Bounds come from the hydrated catalogue so they track admin edits.
  const bounds = priceBounds();
  const priceMin = Number.isFinite(bounds.min) ? bounds.min : 0;
  const priceMax = Number.isFinite(bounds.max) ? bounds.max : 0;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="scrim"
            aria-label="Close panel"
            onClick={closeSheet}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={sheet === 'sort' ? 'Sort products' : 'Filter products'}
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <header className="sheet-head">
              <h2 style={{ fontSize: 18 }}>{sheet === 'sort' ? 'Sort By' : 'Filters'}</h2>
              <button type="button" className="icon-btn icon-btn-sm" onClick={closeSheet} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </header>

            <div className="sheet-body">
              {sheet === 'sort' ? (
                <div className="stack" style={{ gap: 8 }}>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className="opt-card"
                      data-active={sort === option.key}
                      onClick={() => {
                        onSort(option.key);
                        closeSheet();
                      }}
                    >
                      <span className="opt-radio">
                        {sort === option.key ? <motion.span layoutId="sort-radio" /> : null}
                      </span>
                      <span className="semi">{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <FilterGroups
                  filters={filters}
                  patch={(next) => onChange({ ...filters, ...next })}
                  brands={listBrands()}
                  priceMin={priceMin}
                  priceMax={priceMax}
                />
              )}
            </div>

            {sheet === 'filters' ? (
              <footer className="sheet-foot">
                <div className="row" style={{ gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-md"
                    style={{ flex: 1 }}
                    onClick={() => onChange({ ...EMPTY_FILTERS })}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-md"
                    style={{ flex: 2 }}
                    onClick={closeSheet}
                  >
                    Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
                  </button>
                </div>
              </footer>
            ) : null}
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}