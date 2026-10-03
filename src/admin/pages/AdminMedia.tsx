/** Media library: upload, preview, reuse and delete images. */
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import { store, uid } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { ConfirmDialog, IntegrationNote } from '../components/ui';
import type { MediaItem } from '../../types/admin';

const MAX_BYTES = 2_500_000;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export default function AdminMedia() {
  useDbVersion();
  const { user } = useAdminAuth();
  const media = store.read().media;
  const [filter, setFilter] = useState('all');
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = media.filter((m) => (filter === 'all' ? true : m.kind === filter));

  const upload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        setError(`${file.name}: unsupported file type.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: exceeds the 2.5MB limit.`);
        continue;
      }
      const url = await readFile(file);
      const item: MediaItem = {
        id: uid('img'),
        url,
        filename: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        kind: 'product',
        width: 640,
        height: 652,
      };
      store.write('media', (list) => [item, ...list]);
    }
    setError(null);
    logActivity({ action: 'Media uploaded', entity: 'Media', entityId: 'media', detail: `${files.length} file(s) uploaded` }, user?.name, user?.id);
  };

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Assets</p>
          <h1 className="admin-page-title">Media</h1>
        </div>
        <span className="spacer" />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => inputRef.current?.click()}>
          <Icon name="camera" size={15} />
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="admin-toolbar">
        <select className="input-dark" style={{ width: 'auto', minWidth: 150 }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter media">
          <option value="all">All assets</option>
          <option value="product">Product</option>
          <option value="banner">Banner</option>
          <option value="category">Category</option>
          <option value="page">Page</option>
          <option value="social">Social</option>
        </select>
        <span className="spacer" />
        <span className="admin-hint">{rows.length} assets</span>
      </div>

      {error ? <p className="admin-hint" style={{ marginBottom: 10 }}>{error}</p> : null}

      <div className="admin-grid-2">
        {rows.map((item) => (
          <motion.div key={item.id} layout className="panel admin-card-row">
            <img src={item.url} alt={item.filename} style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', borderRadius: 12 }} />
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <div style={{ minWidth: 0 }}>
                <p className="t-sm semi clamp-2">{item.filename}</p>
                <p className="admin-hint">
                  {(item.size / 1024).toFixed(0)} KB · {item.width}×{item.height} · {new Date(item.uploadedAt).toLocaleDateString('en-NG')}
                </p>
              </div>
              <span className="spacer" />
              <span className="tag">{item.kind}</span>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setDeleting(item)} aria-label={`Delete ${item.filename}`}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {!rows.length ? <p className="admin-hint" style={{ marginTop: 12 }}>No assets yet.</p> : null}

      <div style={{ marginTop: 12 }}>
        <IntegrationNote>
          Images are stored as data URLs in this build. Point the uploader at a Supabase Storage bucket to get
          CDN delivery and automatic resizing.
        </IntegrationNote>
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete asset?"
        message={`${deleting?.filename} will be removed from the library.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          store.write('media', (list) => list.filter((m) => m.id !== deleting.id));
          setDeleting(null);
        }}
      />
    </>
  );
}
