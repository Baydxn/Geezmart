/** Admin dashboard: KPI cards, sales chart, recent orders and stock alerts. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import { store } from '../../lib/db';
import { useDbVersion } from '../AdminContext';
import { SalesChart, RANGE_OPTIONS, type ChartRange } from '../components/SalesChart';
import { StatusPill } from '../components/ui';
import { formatMoney, relativeTime } from '../../data/dbHelpers';

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className="stat-delta">
      <span style={{ display: 'inline-flex', transform: up ? 'none' : 'rotate(90deg)' }}><Icon name="arrowUpRight" size={11} /></span>{' '}
      {up ? '+' : ''}
      {value}%
    </span>
  );
}

export default function AdminDashboard() {
  useDbVersion();
  const [range, setRange] = useState<ChartRange>('30d');
  const db = store.read();
  const currency = db.settings.currencySymbol;

  const stats = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86_400_000;
    const sixtyDaysAgo = now - 60 * 86_400_000;

    const revenueOf = (list: typeof db.orders) =>
      list.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded').reduce((s, o) => s + o.total, 0);

    const recent = db.orders.filter((o) => new Date(o.createdAt).getTime() >= thirtyDaysAgo);
    const previous = db.orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= sixtyDaysAgo && t < thirtyDaysAgo;
    });

    const currentRevenue = revenueOf(recent);
    const previousRevenue = revenueOf(previous);

    return {
      sales: currentRevenue,
      salesDelta: previousRevenue ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 0,
      orders: recent.length,
      ordersDelta: previous.length ? Math.round(((recent.length - previous.length) / previous.length) * 100) : 0,
      customers: db.customers.length,
      products: db.products.length,
      pending: db.orders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length,
      lowStock: db.products.filter((p) => p.stock - p.reserved <= p.lowStockThreshold).length,
    };
  }, [db]);

  const recentOrders = useMemo(
    () => [...db.orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5),
    [db],
  );
  const lowStockItems = useMemo(
    () =>
      db.products
        .filter((p) => p.stock - p.reserved <= p.lowStockThreshold)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5),
    [db],
  );

  const cards = [
    { label: 'Total sales', value: formatMoney(stats.sales, currency), delta: stats.salesDelta, to: '/admin/analytics' },
    { label: 'Orders', value: String(stats.orders), delta: stats.ordersDelta, to: '/admin/orders' },
    { label: 'Customers', value: String(stats.customers), to: '/admin/customers' },
    { label: 'Products', value: String(stats.products), to: '/admin/products' },
    { label: 'Pending orders', value: String(stats.pending), to: '/admin/orders' },
    { label: 'Low stock', value: String(stats.lowStock), to: '/admin/inventory' },
  ];

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Overview</p>
          <h1 className="admin-page-title">GEEZMART Admin</h1>
        </div>
        <span className="spacer" />
        <Link className="btn btn-primary btn-sm" to="/admin/products/new">
          <Icon name="plus" size={15} />
          Add Product
        </Link>
      </div>

      <div className="stat-grid">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
          >
            <Link to={card.to} className="stat-card" style={{ height: '100%' }}>
              <span className="stat-label">{card.label}</span>
              <span className="stat-value">{card.value}</span>
              {'delta' in card && card.delta !== undefined ? <Delta value={card.delta} /> : <span className="stat-delta">Last 30 days</span>}
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <span className="panel-title">Sales overview</span>
          <div className="hscroll" style={{ padding: 0, margin: 0, gap: 6 }}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className="chip"
                data-active={range === option.key}
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-body">
          <SalesChart orders={db.orders} range={range} currency={currency} />
        </div>
      </div>

      <div className="admin-grid-2" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Recent orders</span>
            <Link className="link-more" to="/admin/orders">
              View all
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          <div className="panel-body stack" style={{ gap: 10 }}>
            {recentOrders.map((order) => (
              <Link key={order.id} to={`/admin/orders/${order.id}`} className="list-row">
                <div style={{ minWidth: 0 }}>
                  <p className="t-sm semi">#{order.reference}</p>
                  <p className="admin-hint clamp-2">
                    {order.customerName} · {order.lines.length} item{order.lines.length > 1 ? 's' : ''}
                  </p>
                </div>
                <span className="spacer" />
                <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <span className="t-sm semi">{formatMoney(order.total, currency)}</span>
                  <StatusPill label={order.status.replace(/_/g, ' ')} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Stock alerts</span>
            <Link className="link-more" to="/admin/inventory">
              Manage
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          <div className="panel-body stack" style={{ gap: 10 }}>
            {lowStockItems.length ? (
              lowStockItems.map((product) => (
                <Link key={product.id} to={`/admin/products/${product.id}/edit`} className="list-row">
                  <span className="td-thumb">
                    <img src={product.images[0]?.url} alt="" loading="lazy" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="t-sm semi clamp-2">{product.name}</p>
                    <p className="admin-hint">{product.sku}</p>
                  </div>
                  <span className="spacer" />
                  <StatusPill
                    label={product.stock - product.reserved <= 0 ? 'Out of stock' : 'Low stock'}
                    tone="warn"
                  />
                </Link>
              ))
            ) : (
              <p className="admin-hint">Every product is comfortably stocked.</p>
            )}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <span className="panel-title">Latest activity</span>
          <Link className="link-more" to="/admin/activity">
            View log
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
        <div className="panel-body stack" style={{ gap: 10 }}>
          {db.activity.slice(0, 5).map((entry) => (
            <div key={entry.id} className="list-row">
              <Icon name="clock" size={15} />
              <div style={{ minWidth: 0 }}>
                <p className="t-sm semi clamp-2">{entry.detail}</p>
                <p className="admin-hint">
                  {entry.adminName} · {relativeTime(entry.createdAt)}
                </p>
              </div>
              <span className="spacer" />
              {entry.before && entry.after ? (
                <span className="admin-hint nowrap">
                  {entry.before} → {entry.after}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
