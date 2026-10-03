import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/Icon';
import { useOrders } from '../store/OrdersContext';
import { formatPrice, formatDate } from '../lib/format';

export default function OrderSuccess() {
  const { orderId = '' } = useParams();
  const { orders } = useOrders();
  const navigate = useNavigate();
  const order = orders.find((o) => o.id === orderId);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(true), 260);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">Thank you</p>
          <h1 className="page-title">Order Confirmed</h1>
        </div>
      </header>

      <div className="success-wrap">
        <motion.div
          className="success-orb"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        >
          <svg width="66" height="66" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <motion.circle
              cx="32"
              cy="32"
              r="26"
              stroke="#fff"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <motion.path
              d="M20 33.5 28.5 42 45 24"
              stroke="#fff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={drawn ? { pathLength: 1, opacity: 1 } : {}}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
            />
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.35 }}
          className="center-6"
        >
          <h2 className="upper" style={{ letterSpacing: '0.2em', fontSize: 20 }}>
            Order Confirmed
          </h2>
          <p className="text-2 t-md">Thank you for shopping with GEEZMART.</p>
          {order ? (
            <>
              <span className="chip chip-eyebrow">Order #{order.reference}</span>
              <p className="text-3 t-xs">
                Placed {formatDate(order.placedAt)} · {formatPrice(order.total)}
              </p>
            </>
          ) : null}
        </motion.div>
      </div>

      <div className="stack" style={{ gap: 10, marginTop: 18 }}>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/orders')}>
          Track Order
          <Icon name="arrowRight" size={17} />
        </button>
        <button type="button" className="btn btn-ghost btn-lg btn-block" onClick={() => navigate('/shop')}>
          Continue Shopping
        </button>
      </div>

      <motion.div
        className="promo mt-22"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <div className="promo-inner">
          <p className="section-kicker">What happens next</p>
          <h3 style={{ fontSize: 18 }}>We're preparing your order.</h3>
          <p className="text-2 t-sm">
            You'll get a confirmation message shortly, followed by tracking updates as your order moves from
            our warehouse to your door.
          </p>
        </div>
      </motion.div>
    </>
  );
}

