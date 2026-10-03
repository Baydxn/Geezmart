/**
 * Public order tracking. Reads live order status written by the admin panel,
 * so a status change in /admin/orders is reflected here immediately.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/Icon';
import { store } from '../lib/db';
import { formatPrice, formatDate } from '../lib/format';
import { productImage } from '../lib/productImage';
import type { OrderStatus } from '../types/admin';

const FLOW: { status: OrderStatus; label: string; hint: string }[] = [
  { status: 'pending', label: 'Ordered', hint: 'We have your order' },
  { status: 'confirmed', label: 'Confirmed', hint: 'Payment and stock verified' },
  { status: 'processing', label: 'Processing', hint: 'Packed at our warehouse' },
  { status: 'shipped', label: 'Shipped', hint: 'On the way to you' },
  { status: 'out_for_delivery', label: 'Out for Delivery', hint: 'With the courier today' },
  { status: 'delivered', label: 'Delivered', hint: 'Enjoy your purchase' },
];

export default function Tracking() {
  const { id = '' } = useParams();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState(id);
  const currency = store.read().settings.currencySymbol;

  const order = useMemo(
    () => store.read().orders.find((o) => o.id === query || o.reference.toLowerCase() === query.toLowerCase()),
    [query],
  );

  const currentIndex = order ? FLOW.findIndex((step) => step.status === order.status) : -1;
  const cancelled = order?.status === 'cancelled' || order?.status === 'refunded';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">Order tracking</p>
          <h1 className="page-title">Track your order</h1>
        </div>
      </header>

      <form
        className="row"
        style={{ gap: 8, marginBottom: 18 }}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
      >
        <input
          className="input"
          style={{ flex: 1 }}
          value={input}
          placeholder="GZ-000001"
          aria-label="Order reference"
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-md">
          Track
          <Icon name="arrowRight" size={16} />
        </button>
      </form>

      {!order ? (
        <div className="empty">
          <div className="empty-orb">
            <Icon name="box" size={34} />
          </div>
          <h3>{query ? 'No order found' : 'Enter your reference'}</h3>
          <p className="text-3 t-sm">
            {query ? 'Check the reference in your confirmation message.' : 'Try GZ-000001 to see the demo order.'}
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <span className="chip">Order #{order.reference}</span>
              <span className="status-pill" data-tone={order.status === 'delivered' ? 'solid' : 'default'}>
                {order.status.replace(/_/g, ' ')}
              </span>
              <span className="spacer" />
              <span className="t-sm semi">{formatPrice(order.total, currency)}</span>
            </div>
            <p className="text-3 t-xs" style={{ marginTop: 10 }}>
              Placed {formatDate(order.createdAt)} · delivering to {order.city}, {order.state}
            </p>
          </div>

          <div className="tracker" style={{ marginBottom: 16 }}>
            {FLOW.map((step, i) => {
              const entry = order.timeline.find((t) => t.status === step.status);
              const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
              return (
                <div className="tracker-row" key={step.status}>
                  <div className="tracker-rail">
                    <motion.span
                      className="tracker-node"
                      data-state={state}
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      {state === 'done' ? <Icon name="check" size={11} strokeWidth={3} /> : null}
                    </motion.span>
                    {i < FLOW.length - 1 ? (
                      <motion.span
                        className="tracker-line origin-top"
                        data-state={state === 'done' ? 'done' : 'todo'}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                      />
                    ) : null}
                  </div>
                  <div className="tracker-body">
                    <p className="tracker-title" style={{ color: state === 'todo' ? 'var(--text-3)' : '#fff' }}>
                      {step.label}
                    </p>
                    <p className="tracker-meta">
                      {entry?.at ? formatDate(entry.at) : state === 'current' ? 'In progress' : step.hint}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {cancelled ? (
            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
              <p className="t-sm semi">This order was {order.status}.</p>
              <p className="text-3 t-xs">Any refund is issued to the original payment method within 5 business days.</p>
            </div>
          ) : null}

          <div className="card" style={{ padding: 14 }}>
            <p className="section-kicker" style={{ marginBottom: 10 }}>
              Items in this order
            </p>
            <div className="stack" style={{ gap: 10 }}>
              {order.lines.map((line, i) => (
                <div className="row" key={`${line.productId}-${i}`} style={{ gap: 12 }}>
                  <span className="line-thumb" style={{ width: 56, flex: '0 0 56px' }}>
                    <img src={line.image || productImage(line.visual as never, 0)} alt={line.name} loading="lazy" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="t-sm semi clamp-2">{line.name}</p>
                    <p className="text-3 t-xs">
                      {line.variantLabel} · qty {line.quantity}
                    </p>
                  </div>
                  <span className="spacer" />
                  <span className="t-sm semi">{formatPrice(line.price * line.quantity, currency)}</span>
                </div>
              ))}
            </div>
          </div>

          <Link to="/shop" className="btn btn-outline btn-md btn-block" style={{ marginTop: 16 }}>
            Continue shopping
          </Link>
        </>
      )}
    </>
  );
}
