/** Product management: filters, bulk-aware table, row actions. */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { store, uid, availableStock } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity, notifyAdmin } from '../AdminContext';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmDialog, StatusPill, IntegrationNote } from '../components/ui';
import { formatMoney } from '../../data/dbHelpers';
import type { AdminProduct, ProductStatus } from '../../types/admin';

const STATUS_TONE: Record<ProductStatus, 'default' | 'solid' | 'quiet' | 'warn'> = {
  published: 'solid',
  draft: 'quiet',
  hidden: 'quiet',
  out_of_stock: 'warn',
  coming_soon: 'warn',
};

export function exportProductsCsv() {
  const rows = store.read().products;
  const header = ['SKU', 'Name', 'Brand', 'Category', 'Price', 'Cost', 'Stock', 'Status'];
  const body = rows.map((p) =>
    [p.sku, p.name, p.brand, p.categoryId, p.price, p.costPrice, p.stock, p.status].join(','),
  );
  const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `geezmart-products-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminProducts() {
  useDbVersion();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const db = store.read();
  const currency = db.settings.currencySymbol;

  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [status, setStatus] = useState('all');
  const [stock, setStock] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null);

  const brands = useMemo(() => [...new Set(db.products.map((p) => p.brand))].sort(), [db.products]);

  const rows = useMemo(() => {
    return db.products.filter((p) => {
      if (category !== 'all' && p.categoryId !== category) return false;
      if (brand !== 'all' && p.brand !== brand) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (stock === 'low' && availableStock(p) > p.lowStockThreshold) return false;
      if (stock === 'out' && availableStock(p) > 0) return false;
      if (stock === 'healthy' && availableStock(p) <= p.lowStockThreshold) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      return true;
    });
  }, [db.products, category, brand, status, stock, maxPrice]);

  const setStatusFor = (product: AdminProduct, next: ProductStatus) => {
    store.write('products', (list) =>
      list.map((p) => (p.id === product.id ? { ...p, status: next, updatedAt: new Date().toISOString() } : p)),
    );
    logActivity(
      {
        action: 'Product status changed',
        entity: 'Product',
        entityId: product.id,
        detail: `${product.name} set to ${next.replace('_', ' ')}`,
        before: product.status,
        after: next,
      },
      user?.name,
      user?.id,
    );
  };

  const duplicate = (product: AdminProduct) => {
    const copy: AdminProduct = {
      ...product,
      id: uid('prd'),
      sku: `${product.sku}-COPY`,
      name: `${product.name} (copy)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: product.images.map((i) => ({ ...i, id: uid('img') })),
      seo: { ...product.seo, slug: `${product.seo.slug}-copy`, canonicalUrl: '' },
    };
    store.write('products', (list) => [copy, ...list]);
    logActivity(
      { action: 'Product duplicated', entity: 'Product', entityId: copy.id, detail: `${product.name} duplicated` },
      user?.name,
      user?.id,
    );
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    store.write('products', (list) => list.filter((p) => p.id !== target.id));
    store.write('media', (list) => list.filter((m) => m.filename !== target.images[0]?.filename));
    logActivity(
      { action: 'Product deleted', entity: 'Product', entityId: target.id, detail: `${target.name} deleted` },
      user?.name,
      user?.id,
    );
    setPendingDelete(null);
  };

  const columns: Column<AdminProduct>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (p) => (
        <div className="row" style={{ gap: 10 }}>
          <span className="td-thumb">
            <img src={p.images[0]?.url} alt="" loading="lazy" />
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="semi clamp-2" style={{ maxWidth: 220 }}>
              {p.name}
            </p>
            <p className="admin-hint">{p.brand}</p>
          </div>
        </div>
      ),
      mobile: true,
    },
    { key: 'category', header: 'Category', render: (p) => <span className="text-2">{p.categoryId}</span> },
    { key: 'sku', header: 'SKU', render: (p) => <span className="admin-hint">{p.sku}</span> },
    {
      key: 'price',
      header: 'Price',
      render: (p) => <span className="semi">{formatMoney(p.price, currency)}</span>,
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (p) => {
        const available = availableStock(p);
        return (
          <span className="row" style={{ gap: 6 }}>
            {available}
            {available <= p.lowStockThreshold ? <StatusPill label="low" tone="warn" /> : null}
          </span>
        );
      },
    },
    { key: 'status', header: 'Status', render: (p) => <StatusPill label={p.status.replace('_', ' ')} tone={STATUS_TONE[p.status]} /> },
    {
      key: 'created',
      header: 'Created',
      render: (p) => <span className="admin-hint">{new Date(p.createdAt).toLocaleDateString('en-NG')}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <span className="row-actions">
          <Link className="icon-btn icon-btn-sm" to={`/product/${p.seo.slug || p.id}`} aria-label={`View ${p.name}`}>
            <Icon name="search" size={14} />
          </Link>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => navigate(`/admin/products/${p.id}/edit`)}
            aria-label={`Edit ${p.name}`}
          >
            <Icon name="settings" size={14} />
          </button>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => duplicate(p)} aria-label={`Duplicate ${p.name}`}>
            <Icon name="plus" size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => setStatusFor(p, p.status === 'hidden' ? 'published' : 'hidden')}
            aria-label={p.status === 'hidden' ? 'Show on storefront' : 'Hide from storefront'}
            title={p.status === 'hidden' ? 'Show on storefront' : 'Hide from storefront'}
          >
            <Icon name={p.status === 'hidden' ? 'sparkle' : 'close'} size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => setPendingDelete(p)}
            aria-label={`Delete ${p.name}`}
          >
            <Icon name="trash" size={14} />
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Catalogue</p>
          <h1 className="admin-page-title">Products</h1>
        </div>
        <span className="spacer" />
        <Link className="btn btn-primary btn-sm" to="/admin/products/new">
          <Icon name="plus" size={15} />
          Add Product
        </Link>
      </div>

      <div className="admin-toolbar">
        <select className="input-dark" style={{ width: 'auto', minWidth: 130 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {db.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input-dark" style={{ width: 'auto', minWidth: 120 }} value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Filter by brand">
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select className="input-dark" style={{ width: 'auto', minWidth: 120 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="hidden">Hidden</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="coming_soon">Coming soon</option>
        </select>
        <select className="input-dark" style={{ width: 'auto', minWidth: 120 }} value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Filter by stock">
          <option value="all">Any stock</option>
          <option value="healthy">Healthy</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <input
          className="input-dark"
          style={{ width: 120 }}
          type="number"
          placeholder="Max price"
          aria-label="Maximum price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
        <span className="spacer" />
        <button type="button" className="tool-btn" onClick={exportProductsCsv}>
          <Icon name="share" size={14} />
          Export
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => {
            notifyAdmin({
              kind: 'stock',
              title: 'Import queued',
              body: 'CSV import is handled server-side. Use Export to get the template.',
              href: '/admin/products',
            });
          }}
        >
          <Icon name="refresh" size={14} />
          Import
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        pageSize={12}
        searchKeys={(p) => `${p.name} ${p.brand} ${p.sku} ${p.categoryId}`}
        searchPlaceholder="Search name, brand or SKU"
        emptyTitle="No products match these filters"
      />

      <div style={{ marginTop: 12 }}>
        <IntegrationNote>
          Import accepts a CSV with the same headers as Export. Uploading files is wired in{' '}
          <code>src/lib/api.ts</code> when the backend endpoint exists.
        </IntegrationNote>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete product?"
        message={`"${pendingDelete?.name}" will be removed from the storefront.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
