import { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../components/Icon';
import { STATUS_FLOW, STATUS_LABELS, useOrders } from '../store/OrdersContext';
import { formatPrice, formatDate } from '../lib/format';
import { productImage } from '../lib/productImage';
import type { Order } from '../types';

const TABS = ['Active', 'Completed', 'Cancelled'] as const;
type Tab = (typeof TABS)[number];

function Tracker({ order }: { order: Order }) {
  const currentIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="tracker">
      {STATUS_FLOW.map((status, i) => {
        const entry = order.timeline.find((t) => t.status === status);
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
        return (
          <div className="tracker-row" key={status}>
            <div className="tracker-rail">
              <motion.span
                className="tracker-node"
                data-state={state}
                initial={false}
                animate={state === 'done' ? { scale: [0.7, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                {state === 'done' ? <Icon name="check" size={11} strokeWidth={3} /> : null}
              </motion.span>
              {i < STATUS_FLOW.length - 1 ? (
                <motion.span
                  className="tracker-line origin-top"
                  data-state={state === 'done' ? 'done' : 'todo'}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
                />
              ) : null}
            </div>
            <div className="tracker-body">
              <p className="tracker-title" style={{ color: state === 'todo' ? 'var(--text-3)' : '#fff' }}>
                {STATUS_LABELS[status]}
              </p>
              <p className="tracker-meta">
                {entry?.at ? formatDate(entry.at) : state === 'current' ? 'In progress' : 'Pending'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const first = order.lines[0];

  return (
    <motion.article
      className="order-card"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="row" style={{ gap: 10 }}>
        <span className="status-pill" data-tone={order.status === 'delivered' ? 'solid' : 'default'}>
          <span className="hero-dot" />
          {STATUS_LABELS[order.status]}
        </span>
        <span className="spacer" />
        <span className="text-3 t-xs">{formatDate(order.placedAt)}</span>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <span className="line-thumb" style={{ width: 62, flex: '0 0 62px' }}>
          <img
            src={productImage(first.visual, 0, { tint: '#ffffff' })}
            alt={first.name}
            loading="lazy"
            width={62}
            height={62}
          />
        </span>
        <div className="stack" style={{ gap: 3, minWidth: 0 }}>
          <span className="t-sm bold clamp-2">{first.name}</span>
          <span className="text-3 t-xs">
            Order #{order.reference}
            {order.lines.length > 1 ? ` + ${order.lines.length - 1} more` : ''}
          </span>
        </div>
        <span className="spacer" />
        <span className="t-sm bold">{formatPrice(order.total)}</span>
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-sm btn-block"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide tracking' : 'Track order'}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="row">
          <Icon name="chevronDown" size={15} />
        </motion.span>
      </button>

      {open ? (
        <motion.div
          className="clip"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        >
          <div style={{ paddingTop: 14 }}>
            <Tracker order={order} />
          </div>
        </motion.div>
      ) : null}
    </motion.article>
  );
}

export default function Orders() {
  const { active, completed, cancelled } = useOrders();
  const [tab, setTab] = useState<Tab>('Active');

  const list = tab === 'Active' ? active : tab === 'Completed' ? completed : cancelled;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">History</p>
          <h1 className="page-title">Orders</h1>
        </div>
        <span className="chip chip-eyebrow">{active.length} active</span>
      </header>

      <div className="tabs" style={{ marginBottom: 18 }}>
        {TABS.map((name) => (
          <button key={name} type="button" className="tab" data-active={tab === name} onClick={() => setTab(name)}>
            {tab === name ? (
              <motion.span
                layoutId="orders-tab"
                className="tab-bubble"
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              />
            ) : null}
            <span>
              {name} (
              {name === 'Active' ? active.length : name === 'Completed' ? completed.length : cancelled.length})
            </span>
          </button>
        ))}
      </div>

      {list.length ? (
        <div className="stack" style={{ gap: 12 }}>
          {list.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-orb">
            <Icon name="orders" size={34} />
          </div>
          <h3>No {tab.toLowerCase()} orders</h3>
          <p className="text-3 t-sm">When you place an order it will appear here with live tracking.</p>
        </div>
      )}
    </>
  );
}
