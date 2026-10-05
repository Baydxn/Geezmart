/** Orders list + detail with status control that drives customer tracking. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import { store } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity, notifyAdmin } from '../AdminContext';
import { DataTable, type Column } from '../components/DataTable';
import { StatusPill } from '../components/ui';
import { formatMoney } from '../../data/dbHelpers';
import type { AdminOrder, OrderStatus } from '../../types/admin';

export const ORDER_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export function setOrderStatus(order: AdminOrder, status: OrderStatus, adminName?: string, adminId?: string) {
  const now = new Date().toISOString();
  store.write('orders', (list) =>
    list.map((o) =>
      o.id === order.id
        ? {
            ...o,
            status,
            updatedAt: now,
            paymentStatus: status === 'delivered' && o.paymentStatus === 'pending' ? 'paid' : o.paymentStatus,
            timeline: o.timeline.some((t) => t.status === status)
              ? o.timeline
              : [...o.timeline, { status, at: now }],
          }
        : o,
    ),
  );
  logActivity(
    {
      action: 'Order status changed',
      entity: 'Order',
      entityId: order.id,
      detail: `${order.reference} moved to ${STATUS_LABELS[status]}`,
      before: STATUS_LABELS[order.status],
      after: STATUS_LABELS[status],
    },
    adminName,
    adminId,
  );
  notifyAdmin({
    kind: 'order',
    title: `${order.reference} → ${STATUS_LABELS[status]}`,
    body: `${order.customerName}'s tracking page now shows ${STATUS_LABELS[status]}.`,
    href: `/admin/orders/${order.id}`,
  });
}

export default function AdminOrders() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const currency = db.settings.currencySymbol;
  const [status, setStatus] = useState('all');
  const [payment, setPayment] = useState('all');

  const rows = useMemo(
    () =>
      [...db.orders]
        .filter((o) => (status === 'all' ? true : o.status === status))
        .filter((o) => (payment === 'all' ? true : o.paymentStatus === payment))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [db.orders, status, payment],
  );

  const columns: Column<AdminOrder>[] = [
    {
      key: 'id',
      header: 'Order',
      render: (o) => (
        <div>
          <p className="semi">#{o.reference}</p>
          <p className="admin-hint">{o.lines.length} item{o.lines.length > 1 ? 's' : ''}</p>
        </div>
      ),
      mobile: true,
    },
    { key: 'customer', header: 'Customer', render: (o) => <span className="text-2">{o.customerName}</span> },
    {
      key: 'date',
      header: 'Date',
      render: (o) => <span className="admin-hint">{new Date(o.createdAt).toLocaleDateString('en-NG')}</span>,
    },
    { key: 'total', header: 'Total', render: (o) => <span className="semi">{formatMoney(o.total, currency)}</span> },
    { key: 'payment', header: 'Payment', render: (o) => <StatusPill label={o.paymentStatus} tone={o.paymentStatus === 'paid' ? 'solid' : 'warn'} /> },
    { key: 'status', header: 'Status', render: (o) => <StatusPill label={STATUS_LABELS[o.status]} /> },
    {
      key: 'actions',
      header: '',
      render: (o) => (
        <span className="row-actions">
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => setOrderStatus(o, o.status === 'confirmed' ? 'processing' : 'confirmed', user?.name, user?.id)}
            aria-label={`Advance ${o.reference}`}
            title="Advance to next status"
          >
            <Icon name="arrowRight" size={14} />
          </button>
          <Link className="icon-btn icon-btn-sm" to={`/admin/orders/${o.id}`} aria-label={`Open ${o.reference}`}>
            <Icon name="search" size={14} />
          </Link>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Fulfilment</p>
          <h1 className="admin-page-title">Orders</h1>
        </div>
      </div>

      <div className="admin-toolbar">
        <select className="input-dark" style={{ width: 'auto', minWidth: 150 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select className="input-dark" style={{ width: 'auto', minWidth: 130 }} value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Filter by payment status">
          <option value="all">All payments</option>
          <option value="pending">Payment pending</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <DataTable rows={rows} columns={columns} pageSize={12} searchKeys={(o) => `${o.reference} ${o.customerName} ${o.customerEmail}`} searchPlaceholder="Search reference or customer" />
    </>
  );
}

export function AdminOrderDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  useDbVersion();
  const db = store.read();
  const order = db.orders.find((o) => o.id === id);
  const currency = db.settings.currencySymbol;

  if (!order) {
    return (
      <div className="admin-empty">
        <p className="semi" style={{ color: '#fff' }}>Order not found</p>
        <Link className="btn btn-ghost btn-sm" to="/admin/orders">Back to orders</Link>
      </div>
    );
  }

  const index = ORDER_FLOW.indexOf(order.status);

  return (
    <>
      <div className="admin-toolbar">
        <button type="button" className="icon-btn icon-btn-sm" onClick={() => navigate('/admin/orders')} aria-label="Back">
          <Icon name="chevronLeft" size={16} />
        </button>
        <div>
          <p className="admin-kicker">Order #{order.reference}</p>
          <h1 className="admin-page-title">{order.customerName}</h1>
        </div>
        <span className="spacer" />
        <StatusPill label={STATUS_LABELS[order.status]} tone={order.status === 'delivered' ? 'solid' : 'default'} />
      </div>

      <div className="admin-grid-2">
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Update status</span></div>
          <div className="panel-body stack" style={{ gap: 10 }}>
            <p className="admin-hint">
              Changing the status updates the customer's tracking page instantly.
            </p>
            {Object.entries(STATUS_LABELS).map(([key, label]) => {
              const status = key as OrderStatus;
              const flowIndex = ORDER_FLOW.indexOf(status);
              const done = index >= 0 && flowIndex !== -1 && flowIndex <= index;
              return (
                <button
                  key={key}
                  type="button"
                  className="list-row"
                  style={{ background: order.status === status ? '#171717' : '#111111' }}
                  onClick={() => setOrderStatus(order, status, user?.name, user?.id)}
                >
                  <span className="notif-dot" style={{ background: done ? '#fff' : 'transparent', border: '1px solid #3a3f47' }} />
                  <span className="t-sm semi">{label}</span>
                  <span className="spacer" />
                  {order.status === status ? <StatusPill label="current" tone="solid" /> : null}
                </button>
              );
            })}
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  store.write('orders', (list) =>
                    list.map((o) =>
                      o.id === order.id ? { ...o, paymentStatus: o.paymentStatus === 'paid' ? 'pending' : 'paid', updatedAt: new Date().toISOString() } : o,
                    ),
                  )
                }
              >
                Toggle payment: {order.paymentStatus}
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="panel-title">Customer & delivery</span></div>
          <div className="panel-body stack" style={{ gap: 10 }}>
            <div className="list-row"><Icon name="user" size={15} /><div><p className="t-sm semi">{order.customerName}</p><p className="admin-hint">{order.customerEmail}</p></div></div>
            <div className="list-row"><Icon name="phone" size={15} /><div><p className="t-sm semi">{order.customerPhone}</p></div></div>
            <div className="list-row"><Icon name="pin" size={15} /><div><p className="t-sm semi">{order.address}</p><p className="admin-hint">{order.city}, {order.state}</p></div></div>
            <div className="list-row">
              <Icon name="card" size={15} />
              <div><p className="t-sm semi">{order.paymentMethod}</p><p className="admin-hint">{order.paymentStatus} · coupon {order.couponCode ?? 'none'}</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head"><span className="panel-title">Items</span></div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Variant</th><th>Price</th><th>Qty</th><th>Total</th></tr>
            </thead>
            <tbody>
              {order.lines.map((line, i) => (
                <tr key={`${line.productId}-${i}`}>
                  <td className="semi">{line.name}</td>
                  <td className="text-2">{line.variantLabel}</td>
                  <td>{formatMoney(line.price, currency)}</td>
                  <td>{line.quantity}</td>
                  <td className="semi">{formatMoney(line.price * line.quantity, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-body">
          <div className="summary" style={{ maxWidth: 320, marginLeft: 'auto' }}>
            <div className="summary-row"><span>Subtotal</span><strong>{formatMoney(order.subtotal, currency)}</strong></div>
            <div className="summary-row"><span>Delivery</span><strong>{formatMoney(order.delivery, currency)}</strong></div>
            {order.discount ? <div className="summary-row"><span>Discount</span><strong>-{formatMoney(order.discount, currency)}</strong></div> : null}
            <div className="summary-row summary-total"><span>Total</span><span>{formatMoney(order.total, currency)}</span></div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head"><span className="panel-title">Timeline</span></div>
        <div className="panel-body">
          {ORDER_FLOW.map((status, i) => {
            const entry = order.timeline.find((t) => t.status === status);
            const state = i <= index ? 'done' : 'todo';
            return (
              <div className="row" key={status} style={{ gap: 10, padding: '8px 0' }}>
                <motion.span
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  className="tracker-node"
                  data-state={state}
                >
                  {state === 'done' ? <Icon name="check" size={11} strokeWidth={3} /> : null}
                </motion.span>
                <span className="t-sm semi">{STATUS_LABELS[status]}</span>
                <span className="spacer" />
                <span className="admin-hint">{entry ? new Date(entry.at).toLocaleString('en-NG') : '—'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
