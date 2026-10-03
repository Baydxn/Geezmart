/** Inventory control: per-SKU stock, reservations, bulk adjust. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { store, availableStock } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity, notifyAdmin } from '../AdminContext';
import { DataTable, type Column } from '../components/DataTable';
import { StatusPill } from '../components/ui';
import type { AdminProduct } from '../../types/admin';

export default function AdminInventory() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkValue, setBulkValue] = useState('');

  const rows = useMemo(() => {
    return [...db.products]
      .filter((p) => {
        const available = availableStock(p);
        if (filter === 'low') return available > 0 && available <= p.lowStockThreshold;
        if (filter === 'out') return available <= 0;
        if (filter === 'healthy') return available > p.lowStockThreshold;
        return true;
      })
      .sort((a, b) => availableStock(a) - availableStock(b));
  }, [db.products, filter]);

  const setStock = (product: AdminProduct, stock: number, reserved = product.reserved) => {
    const before = product.stock;
    store.write('products', (list) =>
      list.map((p) => (p.id === product.id ? { ...p, stock, reserved, updatedAt: new Date().toISOString() } : p)),
    );
    logActivity(
      {
        action: 'Inventory adjusted',
        entity: 'Product',
        entityId: product.id,
        detail: `${product.name} stock set to ${stock}`,
        before: String(before),
        after: String(stock),
      },
      user?.name,
      user?.id,
    );
    if (stock - reserved <= product.lowStockThreshold) {
      notifyAdmin({
        kind: 'stock',
        title: `Low stock: ${product.name}`,
        body: `${stock - reserved} units available (threshold ${product.lowStockThreshold}).`,
        href: '/admin/inventory',
      });
    }
  };

  const applyBulk = (mode: 'set' | 'add') => {
    const value = Number(bulkValue);
    if (!Number.isFinite(value) || value < 0) return;
    store.write('products', (list) =>
      list.map((p) =>
        selected.includes(p.id)
          ? { ...p, stock: mode === 'set' ? value : Math.max(0, p.stock + value), updatedAt: new Date().toISOString() }
          : p,
      ),
    );
    logActivity(
      {
        action: 'Bulk inventory update',
        entity: 'Product',
        entityId: selected.join(',') || 'none',
        detail: `${mode === 'set' ? 'Set to' : 'Adjusted by'} ${value} across ${selected.length} product(s)`,
      },
      user?.name,
      user?.id,
    );
    setSelected([]);
    setBulkValue('');
  };

  const columns: Column<AdminProduct>[] = [
    {
      key: 'select',
      header: '',
      width: 40,
      render: (p) => (
        <input
          type="checkbox"
          checked={selected.includes(p.id)}
          aria-label={`Select ${p.name}`}
          onChange={() =>
            setSelected((list) => (list.includes(p.id) ? list.filter((id) => id !== p.id) : [...list, p.id]))
          }
          style={{ accentColor: '#fff' }}
        />
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (p) => (
        <div className="row" style={{ gap: 10 }}>
          <span className="td-thumb"><img src={p.images[0]?.url} alt="" loading="lazy" /></span>
          <div style={{ minWidth: 0 }}>
            <p className="semi clamp-2" style={{ maxWidth: 200 }}>{p.name}</p>
            <p className="admin-hint">{p.sku}</p>
          </div>
        </div>
      ),
      mobile: true,
    },
    { key: 'stock', header: 'Stock', render: (p) => <span className="semi">{p.stock}</span> },
    { key: 'reserved', header: 'Reserved', render: (p) => <span className="text-2">{p.reserved}</span> },
    { key: 'available', header: 'Available', render: (p) => <span className="semi">{availableStock(p)}</span> },
    {
      key: 'state',
      header: 'State',
      render: (p) => {
        const available = availableStock(p);
        return available <= 0 ? (
          <StatusPill label="out of stock" tone="warn" />
        ) : available <= p.lowStockThreshold ? (
          <StatusPill label="low stock" tone="warn" />
        ) : (
          <StatusPill label="healthy" tone="solid" />
        );
      },
    },
    {
      key: 'actions',
      header: 'Adjust',
      render: (p) => (
        <span className="row-actions">
          <input
            className="input-dark"
            style={{ width: 74, height: 32 }}
            type="number"
            defaultValue={p.stock}
            aria-label={`New stock for ${p.name}`}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              setStock(p, Number((e.target as HTMLInputElement).value));
            }}
          />
          <Link className="icon-btn icon-btn-sm" to={`/admin/products/${p.id}/edit`} aria-label="Edit product">
            <Icon name="settings" size={14} />
          </Link>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Stock control</p>
          <h1 className="admin-page-title">Inventory</h1>
        </div>
      </div>

      <div className="admin-toolbar">
        <select className="input-dark" style={{ width: 'auto', minWidth: 150 }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter inventory">
          <option value="all">All inventory</option>
          <option value="healthy">Healthy</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <span className="spacer" />
        {selected.length ? (
          <>
            <span className="tag">{selected.length} selected</span>
            <input
              className="input-dark"
              style={{ width: 90 }}
              type="number"
              placeholder="Qty"
              aria-label="Bulk quantity"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
            />
            <button type="button" className="tool-btn" onClick={() => applyBulk('set')}>Set</button>
            <button type="button" className="tool-btn" onClick={() => applyBulk('add')}>Adjust</button>
          </>
        ) : null}
      </div>

      <DataTable rows={rows} columns={columns} pageSize={12} searchKeys={(p) => `${p.name} ${p.sku}`} searchPlaceholder="Search product or SKU" />
    </>
  );
}
