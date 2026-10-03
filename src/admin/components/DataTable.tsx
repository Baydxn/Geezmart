/** Generic data table with search, pagination and mobile card fallback. */
import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Pagination, AdminEmpty } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  width?: number;
  render: (row: T) => ReactNode;
  /** Shown in the compact mobile card layout. */
  mobile?: boolean;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  pageSize = 10,
  searchKeys,
  searchPlaceholder = 'Search',
  emptyTitle = 'Nothing here yet',
  emptyBody,
}: {
  rows: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchKeys?: (row: T) => string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim() || !searchKeys) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) => searchKeys(row).toLowerCase().includes(q));
  }, [rows, query, searchKeys]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (!rows.length) return <AdminEmpty title={emptyTitle} body={emptyBody} />;

  return (
    <div className="panel">
      {searchKeys ? (
        <div className="panel-head">
          <div className="search-field" style={{ flex: 1, maxWidth: 340 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a5f68" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" strokeLinecap="round" />
            </svg>
            <input
              className="input-dark"
              style={{ height: 38 }}
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <span className="admin-hint">{filtered.length} results</span>
        </div>
      ) : null}

      {/* Desktop table */}
      <div className="table-wrap" style={{ display: 'none' }}>
        <div className="@media-desktop">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={{ width: col.width }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
                >
                  {columns.map((col) => (
                    <td key={col.key}>{col.render(row)}</td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compact list — used below 900px via CSS class */}
      <div className="admin-mobile-list">
        {visible.map((row, i) => (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
            className="list-row admin-card-row"
          >
            <div className="row" style={{ width: '100%', gap: 10 }}>
              {columns
                .filter((c) => c.mobile)
                .map((col) => (
                  <div key={col.key} className="row" style={{ gap: 10 }}>
                    {col.render(row)}
                  </div>
                ))}
            </div>
            <div className="row" style={{ width: '100%', gap: 10, justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                {columns
                  .filter((c) => !c.mobile)
                  .map((col) => (
                    <span key={col.key} className="t-sm text-2">
                      {col.render(row)}
                    </span>
                  ))}
              </div>
              <div className="row-actions">{columns.at(-1)?.render(row)}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--line)' }}>
        <Pagination page={safePage} pageCount={pageCount} onPage={setPage} total={filtered.length} />
      </div>
    </div>
  );
}
