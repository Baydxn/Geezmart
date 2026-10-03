/** Coupon manager: percentage, fixed amount and free delivery. */
import { useState } from 'react';
import Icon from '../../components/Icon';
import { store, uid } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { Modal, ConfirmDialog, StatusPill, Switch } from '../components/ui';
import { formatMoney } from '../../data/dbHelpers';
import type { Coupon } from '../../types/admin';

const blank = (): Coupon => ({
  id: uid('cpn'),
  code: '',
  type: 'percentage',
  value: 10,
  minOrder: 0,
  maxDiscount: null,
  usageLimit: 100,
  usedCount: 0,
  expiresAt: null,
  enabled: true,
  categoryIds: [],
  productIds: [],
  createdAt: new Date().toISOString(),
});

export default function AdminCoupons() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const currency = db.settings.currencySymbol;
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const save = () => {
    if (!editing || !editing.code.trim()) return;
    const record = { ...editing, code: editing.code.trim().toUpperCase() };
    const exists = db.coupons.some((c) => c.id === record.id);
    store.write('coupons', (list) => {
      const rest = list.filter((c) => c.id !== record.id);
      return exists ? rest.map((c) => (c.id === record.id ? record : c)) : [record, ...rest];
    });
    logActivity(
      {
        action: exists ? 'Coupon updated' : 'Coupon created',
        entity: 'Coupon',
        entityId: record.id,
        detail: `${record.code} ${exists ? 'updated' : 'created'}`,
      },
      user?.name,
      user?.id,
    );
    setEditing(null);
  };

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Promotions</p>
          <h1 className="admin-page-title">Coupons</h1>
        </div>
        <span className="spacer" />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(blank())}>
          <Icon name="plus" size={15} />
          New coupon
        </button>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {db.coupons.map((coupon) => {
          const expired = coupon.expiresAt ? new Date(coupon.expiresAt).getTime() < Date.now() : false;
          return (
            <div key={coupon.id} className="list-row" style={{ flexWrap: 'wrap' }}>
              <div style={{ minWidth: 160 }}>
                <p className="semi" style={{ letterSpacing: '0.06em' }}>{coupon.code}</p>
                <p className="admin-hint">
                  {coupon.type === 'percentage'
                    ? `${coupon.value}% off`
                    : coupon.type === 'fixed'
                      ? `${formatMoney(coupon.value, currency)} off`
                      : 'Free delivery'}
                  {coupon.minOrder ? ` · min ${formatMoney(coupon.minOrder, currency)}` : ''}
                </p>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {expired ? <StatusPill label="expired" tone="quiet" /> : null}
                <StatusPill label={`${coupon.usedCount}/${coupon.usageLimit} used`} />
                {coupon.expiresAt ? (
                  <StatusPill label={`ends ${new Date(coupon.expiresAt).toLocaleDateString('en-NG')}`} tone="quiet" />
                ) : null}
              </div>
              <span className="spacer" />
              <Switch
                checked={coupon.enabled}
                label={`Enable ${coupon.code}`}
                onChange={(next) =>
                  store.write('coupons', (list) => list.map((c) => (c.id === coupon.id ? { ...c, enabled: next } : c)))
                }
              />
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(coupon)} aria-label={`Edit ${coupon.code}`}>
                <Icon name="settings" size={14} />
              </button>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setDeleting(coupon)} aria-label={`Delete ${coupon.code}`}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          );
        })}
        {!db.coupons.length ? <p className="admin-hint">No coupons yet.</p> : null}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={db.coupons.some((c) => c.id === editing?.id) ? 'Edit coupon' : 'New coupon'}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={save}>Save coupon</button>
          </>
        }
      >
        {editing ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="cp-code">Coupon code</label>
              <input id="cp-code" className="input-dark" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="cp-type">Type</label>
                <select id="cp-type" className="input-dark" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as Coupon['type'] })}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                  <option value="free_delivery">Free delivery</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="cp-value">Value</label>
                <input id="cp-value" className="input-dark" type="number" value={editing.value} disabled={editing.type === 'free_delivery'} onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cp-min">Minimum order ({currency})</label>
                <input id="cp-min" className="input-dark" type="number" value={editing.minOrder} onChange={(e) => setEditing({ ...editing, minOrder: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cp-max">Max discount ({currency})</label>
                <input id="cp-max" className="input-dark" type="number" value={editing.maxDiscount ?? ''} onChange={(e) => setEditing({ ...editing, maxDiscount: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cp-limit">Usage limit</label>
                <input id="cp-limit" className="input-dark" type="number" value={editing.usageLimit} onChange={(e) => setEditing({ ...editing, usageLimit: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cp-exp">Expires</label>
                <input id="cp-exp" className="input-dark" type="date" value={editing.expiresAt?.slice(0, 10) ?? ''} onChange={(e) => setEditing({ ...editing, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-sm semi">Enabled</span>
              <Switch checked={editing.enabled} onChange={(next) => setEditing({ ...editing, enabled: next })} label="Enable coupon" />
            </div>
            <p className="admin-hint">
              Restricting to specific products or categories happens in{' '}
              <code>src/lib/api.ts</code> when the checkout validation endpoint is connected.
            </p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete coupon?"
        message={`${deleting?.code} will stop working immediately for customers.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          store.write('coupons', (list) => list.filter((c) => c.id !== deleting.id));
          setDeleting(null);
        }}
      />
    </>
  );
}
