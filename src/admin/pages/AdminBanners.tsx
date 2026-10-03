/** Hero banner management. The storefront carousel reads these records. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import { store, uid } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { Modal, StatusPill, Switch, IntegrationNote } from '../components/ui';
import { heroImage } from '../../lib/productImage';
import type { Banner } from '../../types/admin';

const VISUALS = ['watch', 'headphones', 'earbuds', 'kit', 'couch', 'phone', 'speaker', 'lamp', 'bag', 'shirt'];

const blank = (order: number): Banner => ({
  id: uid('ban'),
  headline: '',
  subheadline: '',
  ctaText: 'Shop Now',
  ctaHref: '/shop',
  eyebrow: 'New',
  visual: 'watch',
  tint: '#cfd6df',
  desktopImage: '',
  mobileImage: '',
  startDate: null,
  endDate: null,
  status: 'published',
  order,
});

export default function AdminBanners() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const [editing, setEditing] = useState<Banner | null>(null);
  const banners = [...db.banners].sort((a, b) => a.order - b.order);

  const save = () => {
    if (!editing || !editing.headline.trim()) return;
    store.write('banners', (list) => {
      const rest = list.filter((b) => b.id !== editing.id);
      return [...rest, editing].sort((a, b) => a.order - b.order);
    });
    logActivity(
      { action: 'Banner saved', entity: 'Banner', entityId: editing.id, detail: `Banner "${editing.headline}" updated` },
      user?.name,
      user?.id,
    );
    setEditing(null);
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = banners.findIndex((b) => b.id === id);
    const swap = banners[index + direction];
    if (!swap) return;
    store.write('banners', (list) =>
      list.map((b) =>
        b.id === banners[index].id ? { ...b, order: swap.order } : b.id === swap.id ? { ...b, order: banners[index].order } : b,
      ),
    );
  };

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Homepage carousel</p>
          <h1 className="admin-page-title">Banners</h1>
        </div>
        <span className="spacer" />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(blank(banners.length))}>
          <Icon name="plus" size={15} />
          New banner
        </button>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {banners.map((banner, index) => (
          <motion.div key={banner.id} layout className="panel">
            <div className="panel-head">
              <div className="row" style={{ gap: 10 }}>
                <span className="td-thumb" style={{ width: 56, height: 40, flex: '0 0 56px' }}>
                  <img src={banner.desktopImage || heroImage(banner.visual as never, index, banner.tint)} alt="" />
                </span>
                <div>
                  <p className="panel-title">{banner.headline} {banner.subheadline}</p>
                  <p className="admin-hint">
                    {banner.eyebrow} · {banner.ctaText} → {banner.ctaHref}
                  </p>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <StatusPill label={banner.status} tone={banner.status === 'published' ? 'solid' : 'quiet'} />
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(banner.id, -1)} disabled={index === 0} aria-label="Move up">
                  <Icon name="chevronLeft" size={14} />
                </button>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(banner.id, 1)} disabled={index === banners.length - 1} aria-label="Move down">
                  <Icon name="chevronRight" size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() =>
                    store.write('banners', (list) =>
                      list.map((b) => (b.id === banner.id ? { ...b, status: b.status === 'published' ? 'hidden' : 'published' } : b)),
                    )
                  }
                  aria-label="Toggle banner"
                >
                  <Icon name={banner.status === 'published' ? 'sparkle' : 'close'} size={14} />
                </button>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(banner)} aria-label="Edit banner">
                  <Icon name="settings" size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() => store.write('banners', (list) => list.filter((b) => b.id !== banner.id))}
                  aria-label="Delete banner"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {!banners.length ? <p className="admin-hint">No banners yet — the homepage hero is hidden until you add one.</p> : null}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={db.banners.some((b) => b.id === editing?.id) ? 'Edit banner' : 'New banner'}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={save}>Save banner</button>
          </>
        }
      >
        {editing ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="b-head">Headline</label>
                <input id="b-head" className="input-dark" value={editing.headline} onChange={(e) => setEditing({ ...editing, headline: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="b-sub">Subtitle</label>
                <input id="b-sub" className="input-dark" value={editing.subheadline} onChange={(e) => setEditing({ ...editing, subheadline: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="b-cta">Button text</label>
                <input id="b-cta" className="input-dark" value={editing.ctaText} onChange={(e) => setEditing({ ...editing, ctaText: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="b-href">Button destination</label>
                <input id="b-href" className="input-dark" value={editing.ctaHref} onChange={(e) => setEditing({ ...editing, ctaHref: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="b-eyebrow">Eyebrow</label>
                <input id="b-eyebrow" className="input-dark" value={editing.eyebrow} onChange={(e) => setEditing({ ...editing, eyebrow: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="b-start">Start date</label>
                <input id="b-start" className="input-dark" type="date" value={editing.startDate?.slice(0, 10) ?? ''} onChange={(e) => setEditing({ ...editing, startDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="b-end">End date</label>
                <input id="b-end" className="input-dark" type="date" value={editing.endDate?.slice(0, 10) ?? ''} onChange={(e) => setEditing({ ...editing, endDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>

            <div className="field">
              <label className="label">Product visual</label>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {VISUALS.map((visual) => (
                  <button
                    key={visual}
                    type="button"
                    className="chip"
                    data-active={editing.visual === visual}
                    onClick={() => setEditing({ ...editing, visual })}
                  >
                    {visual}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="b-desktop">Desktop image URL</label>
              <input id="b-desktop" className="input-dark" placeholder="Upload in Media then paste URL" value={editing.desktopImage} onChange={(e) => setEditing({ ...editing, desktopImage: e.target.value })} />
            </div>
            <div className="field">
              <label className="label" htmlFor="b-mobile">Mobile image URL</label>
              <input id="b-mobile" className="input-dark" placeholder="Optional portrait crop" value={editing.mobileImage} onChange={(e) => setEditing({ ...editing, mobileImage: e.target.value })} />
            </div>

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-sm semi">Published</span>
              <Switch checked={editing.status === 'published'} onChange={(next) => setEditing({ ...editing, status: next ? 'published' : 'hidden' })} label="Publish banner" />
            </div>

            {editing.desktopImage ? (
              <img src={editing.desktopImage} alt="Banner preview" style={{ width: '100%', borderRadius: 14 }} />
            ) : null}
            <IntegrationNote>Leave the image URL empty to use the generated cinematic visual for this product type.</IntegrationNote>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
