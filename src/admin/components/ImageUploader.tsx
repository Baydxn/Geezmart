/**
 * Product image uploader with drag & drop, reorder, primary selection and delete.
 *
 * Files are validated client-side (type + size) and stored as data URLs in the
 * media library. In production the same handler is where you would POST to your
 * upload endpoint instead — the rest of the UI is unchanged.
 */
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import { uid } from '../../lib/db';
import type { ProductImage } from '../../types/admin';

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

export function ImageUploader({
  images,
  onChange,
  onError,
}: {
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
  onError?: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const accepted = list.filter((file) => {
      if (!ALLOWED.includes(file.type)) {
        onError?.(`${file.name}: unsupported file type`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        onError?.(`${file.name}: exceeds the 2.5MB limit`);
        return false;
      }
      return true;
    });

    const encoded = await Promise.all(
      accepted.map(async (file) => ({
        id: uid('img'),
        url: await readFile(file),
        filename: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        primary: images.length === 0 && accepted.indexOf(file) === 0,
      })),
    );

    if (encoded.length) {
      const next = [...images, ...encoded];
      if (!next.some((i) => i.primary)) next[0] = { ...next[0], primary: true };
      onChange(next);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (id: string) => {
    const next = images.filter((i) => i.id !== id);
    if (next.length && !next.some((i) => i.primary)) next[0] = { ...next[0], primary: true };
    onChange(next);
  };

  return (
    <div>
      <div
        className="dropzone"
        data-active={dragging}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
      >
        <Icon name="camera" size={22} />
        <p className="t-sm semi" style={{ marginTop: 8 }}>
          Drop images here or{' '}
          <button type="button" onClick={() => inputRef.current?.click()} style={{ textDecoration: 'underline' }}>
            browse
          </button>
        </p>
        <p className="admin-hint">PNG, JPG, WEBP, GIF or SVG · up to 2.5MB each</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {images.length ? (
        <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              layout
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className="dropzone thumb-tile"
            >
              <div style={{ position: 'relative' }}>
                <img
                  src={image.url}
                  alt={image.filename}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12, display: 'block' }}
                />
                {image.primary ? (
                  <span className="admin-pill" data-tone="solid" style={{ position: 'absolute', top: 4, left: 4 }}>
                    Primary
                  </span>
                ) : null}
              </div>
              <div className="row" style={{ gap: 4, marginTop: 6, justifyContent: 'space-between' }}>
                <span className="row" style={{ gap: 2 }}>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    style={{ width: 24, height: 24 }}
                    onClick={() => move(index, index - 1)}
                    aria-label="Move left"
                  >
                    <Icon name="chevronLeft" size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    style={{ width: 24, height: 24 }}
                    onClick={() => move(index, index + 1)}
                    aria-label="Move right"
                  >
                    <Icon name="chevronRight" size={12} />
                  </button>
                </span>
                <span className="row" style={{ gap: 4 }}>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    style={{ width: 24, height: 24 }}
                    onClick={() =>
                      onChange(images.map((i) => ({ ...i, primary: i.id === image.id })))
                    }
                    aria-label="Set as primary"
                  >
                    <Icon name="star" size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    style={{ width: 24, height: 24 }}
                    onClick={() => remove(image.id)}
                    aria-label="Delete image"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : null}
      <p className="admin-hint" style={{ marginTop: 8 }}>
        Drag a thumbnail onto another to reorder. The primary image is used on cards and search results.
      </p>
    </div>
  );
}

export default ImageUploader;
