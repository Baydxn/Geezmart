/**
 * Sales chart — dependency-free SVG line/area chart with hover tooltip.
 * Range selector drives the underlying data from the orders collection.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { AdminOrder } from '../../types/admin';
import { formatMoney } from '../../data/dbHelpers';

export type ChartRange = 'today' | '7d' | '30d' | '90d' | '365d';

export const RANGE_OPTIONS: { key: ChartRange; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '3 Months', days: 90 },
  { key: '365d', label: '12 Months', days: 365 },
];

interface Bucket {
  label: string;
  revenue: number;
  orders: number;
}

function bucketise(orders: AdminOrder[], range: ChartRange): Bucket[] {
  const now = new Date();
  const days = RANGE_OPTIONS.find((r) => r.key === range)?.days ?? 30;

  if (range === 'today') {
    const hours = Array.from({ length: 12 }, (_, i) => i * 2);
    return hours.map((h) => {
      const from = new Date(now);
      from.setHours(h, 0, 0, 0);
      const to = new Date(from);
      to.setHours(h + 2);
      const inRange = orders.filter((o) => {
        const d = new Date(o.createdAt);
        return d >= from && d < to;
      });
      return {
        label: `${String(h).padStart(2, '0')}:00`,
        revenue: inRange.reduce((sum, o) => sum + o.total, 0),
        orders: inRange.length,
      };
    });
  }

  const step = days > 90 ? 30 : days > 30 ? 7 : 1;
  const count = Math.ceil(days / step);
  const buckets: Bucket[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const end = new Date(now);
    end.setDate(end.getDate() - i * step);
    const start = new Date(end);
    start.setDate(start.getDate() - step);
    const inRange = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= start && d < end;
    });
    buckets.push({
      label:
        step === 1
          ? end.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
          : end.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }),
      revenue: inRange.reduce((sum, o) => sum + o.total, 0),
      orders: inRange.length,
    });
  }
  return buckets;
}

export function SalesChart({
  orders,
  range,
  currency,
}: {
  orders: AdminOrder[];
  range: ChartRange;
  currency: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const buckets = useMemo(() => bucketise(orders, range), [orders, range]);

  const W = 720;
  const H = 240;
  const padX = 34;
  const padY = 22;
  const max = Math.max(1, ...buckets.map((b) => b.revenue));
  const stepX = (W - padX * 2) / Math.max(1, buckets.length - 1);
  const y = (v: number) => padY + (1 - v / max) * (H - padY * 2);
  const x = (i: number) => padX + i * stepX;

  const line = buckets.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b.revenue).toFixed(1)}`).join(' ');
  const area = `${line} L${x(buckets.length - 1).toFixed(1)},${H - padY} L${x(0).toFixed(1)},${H - padY} Z`;

  const totals = useMemo(() => {
    const revenue = buckets.reduce((s, b) => s + b.revenue, 0);
    const count = buckets.reduce((s, b) => s + b.orders, 0);
    return { revenue, orders: count, aov: count ? revenue / count : 0 };
  }, [buckets]);

  const active = hover === null ? buckets.length - 1 : hover;

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
        <div>
          <p className="stat-label">Revenue</p>
          <p className="t-lg bold">{formatMoney(totals.revenue, currency)}</p>
        </div>
        <div>
          <p className="stat-label">Orders</p>
          <p className="t-lg bold">{totals.orders}</p>
        </div>
        <div>
          <p className="stat-label">Avg order value</p>
          <p className="t-lg bold">{formatMoney(totals.aov, currency)}</p>
        </div>
      </div>

      <div className="chart-frame">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Revenue over the selected range. Total ${formatMoney(totals.revenue, currency)}`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="gz-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              className="chart-grid-line"
              x1={padX}
              x2={W - padX}
              y1={padY + t * (H - padY * 2)}
              y2={padY + t * (H - padY * 2)}
            />
          ))}

          <motion.path
            d={area}
            fill="url(#gz-chart-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
          <motion.path
            d={line}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />

          {buckets.map((b, i) => (
            <g key={`${b.label}-${i}`}>
              <rect
                x={x(i) - stepX / 2}
                y={0}
                width={Math.max(6, stepX)}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              <circle
                cx={x(i)}
                cy={y(b.revenue)}
                r={i === active ? 4 : 2.5}
                fill={i === active ? '#ffffff' : 'none'}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          ))}

          {buckets.map((b, i) =>
            i % Math.ceil(buckets.length / 6) === 0 || i === buckets.length - 1 ? (
              <text key={`l-${i}`} className="chart-axis-label" x={x(i)} y={H - 6} textAnchor="middle">
                {b.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <p className="admin-hint" style={{ marginTop: 8 }}>
        {buckets[active]?.label}: {formatMoney(buckets[active]?.revenue ?? 0, currency)} across{' '}
        {buckets[active]?.orders ?? 0} orders
      </p>
    </div>
  );
}
