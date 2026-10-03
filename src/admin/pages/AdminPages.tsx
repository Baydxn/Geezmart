/** Storefront content pages (About, Shipping, Returns, Privacy, FAQ). */
import { useState } from 'react';
import Icon from '../../components/Icon';
import { store, uid } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { Modal, ConfirmDialog, StatusPill } from '../components/ui';
import RichTextEditor from '../components/RichTextEditor';
import { slugify } from '../../data/dbHelpers';
import type { ContentPage, ProductStatus } from '../../types/admin';

const blank = (): ContentPage => ({
  id: uid('pg'),
  slug: '',
  title: '',
  body: '',
  status: 'draft',
  updatedAt: new Date().toISOString(),
});

export default function AdminPages() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const [editing, setEditing] = useState<ContentPage | null>(null);
  const [deleting, setDeleting] = useState<ContentPage | null>(null);

  const save = () => {
    if (!editing || !editing.title.trim()) return;
    const record = { ...editing, slug: editing.slug || slugify(editing.title), updatedAt: new Date().toISOString() };
    const exists = db.pages.some((p) => p.id === record.id);
    store.write('pages', (list) => {
      const rest = list.filter((p) => p.id !== record.id);
      return exists ? rest.map((p) => (p.id === record.id ? record : p)) : [...rest, record];
    });
    logActivity(
      { action: exists ? 'Page updated' : 'Page created', entity: 'Page', entityId: record.id, detail: `${record.title} saved` },
      user?.name,
      user?.id,
    );
    setEditing(null);
  };

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Content</p>
          <h1 className="admin-page-title">Pages</h1>
        </div>
        <span className="spacer" />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(blank())}>
          <Icon name="plus" size={15} />
          New page
        </button>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {db.pages.map((page) => (
          <div key={page.id} className="list-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="semi">{page.title}</p>
              <p className="admin-hint">
                /{page.slug} · updated {new Date(page.updatedAt).toLocaleDateString('en-NG')}
              </p>
            </div>
            <StatusPill label={page.status} tone={page.status === 'published' ? 'solid' : 'quiet'} />
            <select
              className="input-dark"
              style={{ width: 130, height: 32 }}
              value={page.status}
              aria-label={`Status for ${page.title}`}
              onChange={(e) =>
                store.write('pages', (list) =>
                  list.map((p) => (p.id === page.id ? { ...p, status: e.target.value as ProductStatus, updatedAt: new Date().toISOString() } : p)),
                )
              }
            >
              <option value="published">published</option>
              <option value="draft">draft</option>
              <option value="hidden">hidden</option>
            </select>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(page)} aria-label={`Edit ${page.title}`}>
              <Icon name="settings" size={14} />
            </button>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => setDeleting(page)} aria-label={`Delete ${page.title}`}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={db.pages.some((p) => p.id === editing?.id) ? 'Edit page' : 'New page'}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={save}>Save page</button>
          </>
        }
      >
        {editing ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="pg-title">Title</label>
                <input id="pg-title" className="input-dark" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="pg-slug">Slug</label>
                <input id="pg-slug" className="input-dark" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
              </div>
            </div>
            <div className="field">
              <label className="label">Content</label>
              <RichTextEditor value={editing.body} onChange={(body) => setEditing({ ...editing, body })} rows={12} />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete page?"
        message={`"${deleting?.title}" will no longer be available on the storefront.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          store.write('pages', (list) => list.filter((p) => p.id !== deleting.id));
          setDeleting(null);
        }}
      />
    </>
  );
}

