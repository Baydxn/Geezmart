/** Category + subcategory management with ordering and visibility. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import { store, uid } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { Modal, ConfirmDialog, StatusPill } from '../components/ui';
import { slugify } from '../../data/dbHelpers';
import type { AdminCategory } from '../../types/admin';

const blank = (order: number): AdminCategory => ({
  id: uid('cat'),
  name: '',
  slug: '',
  icon: 'shop',
  tagline: '',
  hidden: false,
  order,
  subcategories: [],
});

export default function AdminCategories() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [subName, setSubName] = useState('');
  const [subGroup, setSubGroup] = useState('General');

  const save = () => {
    if (!editing || !editing.name.trim()) return;
    const record = { ...editing, slug: editing.slug || slugify(editing.name) };
    const exists = db.categories.some((c) => c.id === record.id);
    store.write('categories', (list) => {
      const rest = list.filter((c) => c.id !== record.id);
      return exists ? rest.map((c) => (c.id === record.id ? record : c)) : [...rest, record];
    });
    logActivity(
      {
        action: exists ? 'Category updated' : 'Category created',
        entity: 'Category',
        entityId: record.id,
        detail: `${exists ? 'Updated' : 'Created'} category ${record.name}`,
      },
      user?.name,
      user?.id,
    );
    setEditing(null);
  };

  const move = (id: string, direction: -1 | 1) => {
    const sorted = [...db.categories].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;
    const a = sorted[index];
    store.write('categories', (list) =>
      list.map((c) => (c.id === a.id ? { ...c, order: swapWith.order } : c.id === swapWith.id ? { ...c, order: a.order } : c)),
    );
  };

  const toggleHidden = (category: AdminCategory) => {
    store.write('categories', (list) =>
      list.map((c) => (c.id === category.id ? { ...c, hidden: !c.hidden } : c)),
    );
    logActivity(
      {
        action: 'Category visibility changed',
        entity: 'Category',
        entityId: category.id,
        detail: `${category.name} ${category.hidden ? 'shown' : 'hidden'}`,
        before: category.hidden ? 'hidden' : 'visible',
        after: category.hidden ? 'visible' : 'hidden',
      },
      user?.name,
      user?.id,
    );
  };

  const addSubcategory = (categoryId: string) => {
    if (!subName.trim()) return;
    store.write('categories', (list) =>
      list.map((c) =>
        c.id === categoryId
          ? { ...c, subcategories: [...c.subcategories, { id: slugify(subName), name: subName.trim(), group: subGroup }] }
          : c,
      ),
    );
    setSubName('');
  };

  const removeSubcategory = (categoryId: string, subId: string) => {
    store.write('categories', (list) =>
      list.map((c) => (c.id === categoryId ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) } : c)),
    );
  };

  const sorted = [...db.categories].sort((a, b) => a.order - b.order);

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Structure</p>
          <h1 className="admin-page-title">Categories</h1>
        </div>
        <span className="spacer" />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(blank(sorted.length))}>
          <Icon name="plus" size={15} />
          New category
        </button>
      </div>

      <p className="admin-hint" style={{ marginBottom: 12 }}>
        Changes here appear instantly in the storefront category shortcuts, the expanding category menu and the
        shop filters.
      </p>

      <div className="stack" style={{ gap: 12 }}>
        {sorted.map((category, index) => (
          <motion.div key={category.id} layout className="panel">
            <div className="panel-head">
              <div className="row" style={{ gap: 10 }}>
                <Icon name={category.icon as never} size={17} />
                <div>
                  <p className="panel-title">{category.name}</p>
                  <p className="admin-hint">/{category.slug}</p>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {category.hidden ? <StatusPill label="hidden" tone="quiet" /> : <StatusPill label="visible" tone="solid" />}
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(category.id, -1)} disabled={index === 0} aria-label="Move up">
                  <Icon name="chevronLeft" size={14} />
                </button>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(category.id, 1)} disabled={index === sorted.length - 1} aria-label="Move down">
                  <Icon name="chevronRight" size={14} />
                </button>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => toggleHidden(category)} aria-label="Toggle visibility">
                  <Icon name={category.hidden ? 'sparkle' : 'close'} size={14} />
                </button>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(category)} aria-label={`Edit ${category.name}`}>
                  <Icon name="settings" size={14} />
                </button>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => setDeleting(category)} aria-label={`Delete ${category.name}`}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
            <div className="panel-body">
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {category.subcategories.map((sub) => (
                  <span key={sub.id} className="tag">
                    {sub.name}
                    <span style={{ opacity: 0.5, marginLeft: 6 }}>{sub.group}</span>
                    <button
                      type="button"
                      onClick={() => removeSubcategory(category.id, sub.id)}
                      aria-label={`Remove ${sub.name}`}
                      style={{ marginLeft: 6, display: 'inline-flex' }}
                    >
                      <Icon name="close" size={11} />
                    </button>
                  </span>
                ))}
                {!category.subcategories.length ? <span className="admin-hint">No subcategories yet.</span> : null}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="input-dark"
                  style={{ width: 180, height: 34 }}
                  placeholder="New subcategory"
                  aria-label="New subcategory name"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSubcategory(category.id)}
                />
                <input
                  className="input-dark"
                  style={{ width: 130, height: 34 }}
                  placeholder="Group"
                  aria-label="Subcategory group"
                  value={subGroup}
                  onChange={(e) => setSubGroup(e.target.value)}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => addSubcategory(category.id)}>
                  <Icon name="plus" size={14} />
                  Add
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={db.categories.some((c) => c.id === editing?.id) ? 'Edit category' : 'New category'}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={save}>
              Save category
            </button>
          </>
        }
      >
        {editing ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="c-name">Name</label>
              <input id="c-name" className="input-dark" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="field">
              <label className="label" htmlFor="c-slug">Slug</label>
              <input id="c-slug" className="input-dark" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
            </div>
            <div className="field">
              <label className="label" htmlFor="c-icon">Icon key</label>
              <input id="c-icon" className="input-dark" value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
            </div>
            <div className="field">
              <label className="label" htmlFor="c-tag">Tagline</label>
              <input id="c-tag" className="input-dark" value={editing.tagline} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete category?"
        message={`"${deleting?.name}" and its subcategories will disappear from the storefront. Products keep their data but become uncategorised.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          store.write('categories', (list) => list.filter((c) => c.id !== deleting.id));
          logActivity(
            { action: 'Category deleted', entity: 'Category', entityId: deleting.id, detail: `${deleting.name} deleted` },
            user?.name,
            user?.id,
          );
          setDeleting(null);
        }}
      />
    </>
  );
}
