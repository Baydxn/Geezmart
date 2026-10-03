/** Homepage builder: enable, reorder, rename and curate every section. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import { store } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { Modal, Switch, StatusPill } from '../components/ui';
import type { HomepageSection } from '../../types/admin';

export default function AdminHomepage() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const [editing, setEditing] = useState<HomepageSection | null>(null);
  const sections = [...db.homepage].sort((a, b) => a.order - b.order);

  const update = (id: string, next: Partial<HomepageSection>, detail: string) => {
    store.write('homepage', (list) => list.map((s) => (s.id === id ? { ...s, ...next } : s)));
    logActivity(
      { action: 'Homepage updated', entity: 'Homepage', entityId: id, detail, before: undefined, after: undefined },
      user?.name,
      user?.id,
    );
  };

  const move = (id: string, direction: -1 | 1) => {
    const index = sections.findIndex((s) => s.id === id);
    const swap = sections[index + direction];
    if (!swap) return;
    store.write('homepage', (list) =>
      list.map((s) =>
        s.id === sections[index].id ? { ...s, order: swap.order } : s.id === swap.id ? { ...s, order: sections[index].order } : s,
      ),
    );
  };

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Storefront composition</p>
          <h1 className="admin-page-title">Homepage</h1>
        </div>
        <span className="spacer" />
        <a className="tool-btn" href="/" target="_blank" rel="noreferrer">
          <Icon name="home" size={14} />
          Preview live
        </a>
      </div>

      <p className="admin-hint" style={{ marginBottom: 12 }}>
        Sections render on the customer homepage in this order. Disabling a section hides it immediately.
      </p>

      <div className="stack" style={{ gap: 10 }}>
        {sections.map((section, index) => (
          <motion.div key={section.id} layout className="list-row admin-card-row">
            <span className="tag">{index + 1}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="semi">{section.title || section.type}</p>
              <p className="admin-hint">
                {section.type}
                {section.kicker ? ` · ${section.kicker}` : ''}
                {section.collection !== 'custom' ? ` · ${section.collection}` : ` · ${section.productIds.length} selected`}
              </p>
            </div>
            <StatusPill label={section.enabled ? 'visible' : 'hidden'} tone={section.enabled ? 'solid' : 'quiet'} />
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(section.id, -1)} disabled={index === 0} aria-label="Move up">
              <Icon name="chevronLeft" size={14} />
            </button>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(section.id, 1)} disabled={index === sections.length - 1} aria-label="Move down">
              <Icon name="chevronRight" size={14} />
            </button>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(section)} aria-label={`Edit ${section.title}`}>
              <Icon name="settings" size={14} />
            </button>
            <Switch
              checked={section.enabled}
              label={`Toggle ${section.title}`}
              onChange={(next) => update(section.id, { enabled: next }, `${section.title} ${next ? 'shown' : 'hidden'}`)}
            />
          </motion.div>
        ))}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit section"
        footer={
          <button
            type="button"
            className="btn btn-primary btn-md btn-block"
            onClick={() => setEditing(null)}
          >
            Done
          </button>
        }
      >
        {editing ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="s-title">Section title</label>
              <input
                id="s-title"
                className="input-dark"
                value={editing.title}
                onChange={(e) => {
                  setEditing({ ...editing, title: e.target.value });
                  update(editing.id, { title: e.target.value }, `Section title set to "${e.target.value}"`);
                }}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="s-kicker">Kicker / eyebrow</label>
              <input id="s-kicker" className="input-dark" value={editing.kicker} onChange={(e) => setEditing({ ...editing, kicker: e.target.value })} />
            </div>
            <div className="field">
              <label className="label" htmlFor="s-desc">Description</label>
              <textarea id="s-desc" className="input-dark" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="s-cta">CTA text</label>
                <input id="s-cta" className="input-dark" value={editing.ctaText} onChange={(e) => setEditing({ ...editing, ctaText: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-href">CTA link</label>
                <input id="s-href" className="input-dark" value={editing.ctaHref} onChange={(e) => setEditing({ ...editing, ctaHref: e.target.value })} />
              </div>
            </div>

            {editing.type === 'products' ? (
              <div className="field">
                <label className="label">Product source</label>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {(['featured', 'newDrop', 'trending', 'menPick', 'custom'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="chip"
                      data-active={editing.collection === key}
                      onClick={() => setEditing({ ...editing, collection: key })}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <p className="admin-hint" style={{ marginTop: 6 }}>
                  {editing.collection === 'custom'
                    ? `${editing.productIds.length} product(s) pinned manually`
                    : 'Products are selected automatically from the catalogue.'}
                </p>
                {editing.collection === 'custom' ? (
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {db.products.map((p) => {
                      const picked = editing.productIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="chip"
                          data-active={picked}
                          onClick={() => {
                            const productIds = picked
                              ? editing.productIds.filter((id) => id !== p.id)
                              : [...editing.productIds, p.id];
                            setEditing({ ...editing, productIds });
                            update(editing.id, { productIds }, `${editing.title} product selection updated`);
                          }}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
