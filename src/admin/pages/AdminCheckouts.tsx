/**
 * ABANDONED CHECKOUTS — cart recovery.
 *
 * Shows every checkout that started but never converted, segmented by how far
 * the customer got. Reads live from Postgres when the schema is installed and
 * falls back to the local database otherwise, so the screen is never blank.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { formatPrice } from '../../lib/format';
import { useAdminAuth, notifyAdmin } from '../AdminContext';
import { AdminEmpty, StatusPill } from '../components/ui';
import {
  abandonedCheckoutSummary,
  backendStatus,
  markRecoveryReminderSent,
  subscribeRealtime,
  type AbandonedSummary,
} from '../../lib/supabase/storefront';
import { supabase } from '../../lib/supabase/client';
import type { AbandonedStage } from '../../lib/supabase/types';

interface AbandonedRow {
  id: string;
  email: string;
  full_name: string;
  stage: AbandonedStage;
  item_count: number;
  subtotal: number;
  furthest_step: number;
  recovered: boolean;
  reminder_count: number;
  abandoned_at: string;
  expires_at: string;
}

const STAGE_LABEL: Record<AbandonedStage, string> = {
  cart: 'Cart',
  checkout_step_1: 'Step 1 · Delivery',
  checkout_step_2: 'Step 2 · Shipping',
  checkout_step_3: 'Step 3 · Payment',
  payment_pending: 'Payment pending',
};

const FILTERS: { key: AbandonedStage | 'all' | 'recovered'; label: string }[] = [
  { key: 'all', label: 'All open' },
  { key: 'cart', label: 'Cart' },
  { key: 'checkout_step_1', label: 'Delivery' },
  { key: 'checkout_step_2', label: 'Shipping' },
  { key: 'checkout_step_3', label: 'Payment' },
  { key: 'recovered', label: 'Recovered' },
];

function relative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function AdminCheckouts() {
  const { user } = useAdminAuth();
  const [rows, setRows] = useState<AbandonedRow[]>([]);
  const [summary, setSummary] = useState<AbandonedSummary | null>(null);
  const [filter, setFilter] = useState<AbandonedStage | 'all' | 'recovered'>('all');
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [summaryResult, listResult] = await Promise.all([
        abandonedCheckoutSummary(),
        sb
          .from('abandoned_checkouts')
          .select(
            'id,email,full_name,stage,item_count,subtotal,furthest_step,recovered,reminder_count,abandoned_at,expires_at',
          )
          .order('abandoned_at', { ascending: false })
          .limit(100),
      ]);
      setSummary(summaryResult);
      setRows((listResult.data ?? []) as AbandonedRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const status = backendStatus().then((s) => setLive(s.schemaInstalled));
    return () => {
      void status;
    };
  }, [load]);

  // Live updates: a new abandoned cart appears without a refresh.
  useEffect(() => {
    if (!live) return undefined;
    const unsubscribe = subscribeRealtime(['abandoned_checkouts'], () => {
      void load();
    });
    return () => {
      unsubscribe?.();
    };
  }, [live, load]);

  const visible = useMemo(() => {
    if (filter === 'all') return rows.filter((r) => !r.recovered);
    if (filter === 'recovered') return rows.filter((r) => r.recovered);
    return rows.filter((r) => !r.recovered && r.stage === filter);
  }, [rows, filter]);

  const sendReminder = async (row: AbandonedRow) => {
    setSending(row.id);
    const ok = await markRecoveryReminderSent(row.id);
    if (ok) {
      await load();
      notifyAdmin({
        kind: 'order',
        title: 'Recovery queued',
        body: `Reminder queued for ${row.email || row.full_name || 'guest'}.`,
        href: '/admin/checkouts',
      });
    } else {
      notifyAdmin({
        kind: 'order',
        title: 'Could not queue reminder',
        body: 'The backend rejected the update. Check the Supabase connection in Settings.',
        href: '/admin/settings',
      });
    }
    setSending(null);
  };

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Cart recovery</p>
          <h1 className="admin-page-title">Abandoned Checkouts</h1>
          <p className="admin-hint">
            Carts that started but never converted — recover them before they are lost.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          <Icon name="refresh" size={16} /> Refresh
        </button>
      </div>

      <div className="stat-grid">
        {[
          { label: 'Open carts', value: summary ? String(summary.open) : '—' },
          { label: 'Recovered', value: summary ? String(summary.recovered) : '—' },
          { label: 'Value at risk', value: summary ? formatPrice(summary.valueAtRisk) : '—' },
          { label: 'Recovery rate', value: summary ? `${summary.recoveryRate}%` : '—' },
        ].map((card) => (
          <div key={card.label} className="stat-card" style={{ height: '100%' }}>
            <span className="stat-label">{card.label}</span>
            <span className="stat-value">{card.value}</span>
          </div>
        ))}
      </div>

      {!live && (
        <div className="admin-card">
          <p className="admin-hint">
            Abandoned-cart tracking is written by Postgres triggers. Run the migrations in{' '}
            <code>supabase/migrations</code> against your project, then reload — this screen
            will populate automatically. Until then the rest of the panel keeps working on
            the local database.
          </p>
        </div>
      )}

      <div className="chip-row" role="tablist" aria-label="Filter by checkout stage">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className="chip"
            data-active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && !rows.length ? (
        <div className="admin-card">
          <p className="admin-hint">Fetching abandoned carts…</p>
        </div>
      ) : visible.length === 0 ? (
        <AdminEmpty
          icon="orders"
          title={filter === 'all' ? 'No abandoned carts' : 'Nothing in this stage'}
          body="Every checkout so far has converted. That is a good sign."
        />
      ) : (
        <div className="stack">
          {visible.map((row) => (
            <div key={row.id} className="admin-card">
              <div className="row-between">
                <div>
                  <strong>{row.full_name || row.email || 'Guest shopper'}</strong>
                  <p className="admin-hint">
                    {row.email || 'No email captured'} · {row.item_count} item
                    {row.item_count === 1 ? '' : 's'} · {relative(row.abandoned_at)}
                  </p>
                </div>
                <div className="row-end">
                  <StatusPill
                    label={STAGE_LABEL[row.stage] ?? row.stage}
                    tone={row.recovered ? 'quiet' : 'warn'}
                  />
                  <strong>{formatPrice(row.subtotal)}</strong>
                </div>
              </div>

              <div className="step-track" aria-label={`Reached step ${row.furthest_step} of 4`}>
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className="step-dot"
                    data-done={step <= row.furthest_step}
                    aria-hidden="true"
                  />
                ))}
              </div>

              <div className="row-between">
                <span className="admin-hint">
                  {row.reminder_count > 0
                    ? `${row.reminder_count} reminder${row.reminder_count === 1 ? '' : 's'} sent`
                    : 'No reminder sent yet'}
                </span>
                {!row.recovered && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={sending === row.id}
                    onClick={() => void sendReminder(row)}
                  >
                    {sending === row.id ? 'Queueing…' : 'Send recovery'}
                  </button>
                )}
              </div>
              <span className="sr-only">Viewed by {user?.name ?? 'admin'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
