/**
 * Lightweight rich-text editor for product descriptions and content pages.
 * Stores semantic HTML; renders a sanitised preview. No third-party editor.
 */
import { useMemo, useRef, useState } from 'react';

type Block = { cmd: string; label: string; icon?: string; wrap?: [string, string] };

const BLOCKS: Block[] = [
  { cmd: 'h2', label: 'H2' },
  { cmd: 'h3', label: 'H3' },
  { cmd: 'p', label: 'P' },
  { cmd: 'ul', label: 'Bullets' },
  { cmd: 'ol', label: 'Numbered' },
  { cmd: 'quote', label: 'Quote' },
];

const INLINE: { cmd: string; label: string; wrap: [string, string] }[] = [
  { cmd: 'bold', label: 'B', wrap: ['<strong>', '</strong>'] },
  { cmd: 'italic', label: 'I', wrap: ['<em>', '</em>'] },
  { cmd: 'link', label: 'Link', wrap: ['<a href="https://">', '</a>'] },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render the stored markup to plain HTML for the editing surface. */
function toEditableHtml(html: string): string {
  return html
    .split(/(<\/?(?:h2|h3|p|ul|ol|blockquote)[^>]*>)/i)
    .map((part) =>
      /^<(\w+)[^>]*>$/i.test(part) ? part : part.split('\n').map(escapeHtml).join('<br>'),
    )
    .join('');
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write the description customers will read…',
  rows = 10,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const ref = useRef<HTMLDivElement>(null);

  const html = useMemo(() => value || '', [value]);

  const wrapSelection = (before: string, after: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    const text = selection?.toString() ?? '';
    const next = `${before}${text || 'text'}${after}`;
    onChange((el.innerHTML + next).replace(/\s+$/, ''));
  };

  const insertBlock = (tag: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection()?.toString() ?? 'Your text';
    const markup =
      tag === 'quote'
        ? `<blockquote>${escapeHtml(selection)}</blockquote>`
        : tag === 'p'
          ? `<p>${escapeHtml(selection)}</p>`
          : `<${tag}>${escapeHtml(selection)}</${tag}>`;
    onChange(el.innerHTML + markup);
  };

  const insertTable = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    onChange(
      `${el.innerHTML}<table><thead><tr><th>Spec</th><th>Value</th></tr></thead><tbody><tr><td>Material</td><td>Premium</td></tr></tbody></table>`,
    );
  };

  const insertImage = () => {
    const url = window.prompt('Image URL (uploaded in Media)');
    if (!url) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    onChange(`${el.innerHTML}<p><img src="${escapeHtml(url)}" alt="" style="max-width:100%;border-radius:12px" /></p>`);
  };

  return (
    <div>
      <div className="rte-toolbar">
        {BLOCKS.map((b) => (
          <button
            key={b.cmd}
            type="button"
            className="tool-btn"
            style={{ height: 28, padding: '0 9px', fontSize: 12 }}
            onClick={() => insertBlock(b.cmd)}
          >
            {b.label}
          </button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 4px' }} />
        {INLINE.map((i) => (
          <button
            key={i.cmd}
            type="button"
            className="tool-btn"
            style={{ height: 28, padding: '0 9px', fontSize: 12 }}
            onClick={() => wrapSelection(i.wrap[0], i.wrap[1])}
          >
            {i.label}
          </button>
        ))}
        <button
          type="button"
          className="tool-btn"
          style={{ height: 28, padding: '0 9px', fontSize: 12 }}
          onClick={insertTable}
        >
          Table
        </button>
        <button
          type="button"
          className="tool-btn"
          style={{ height: 28, padding: '0 9px', fontSize: 12 }}
          onClick={insertImage}
        >
          Image
        </button>
        <span className="spacer" />
        <button
          type="button"
          className="tool-btn"
          style={{ height: 28, padding: '0 9px', fontSize: 12 }}
          onClick={() => setMode((m) => (m === 'write' ? 'preview' : 'write'))}
        >
          {mode === 'write' ? 'Preview' : 'Edit'}
        </button>
      </div>

      {mode === 'write' ? (
        <div
          ref={ref}
          className="rte-area"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Description editor"
          data-placeholder={placeholder}
          style={{ minHeight: rows * 22 }}
          dangerouslySetInnerHTML={{ __html: toEditableHtml(html) }}
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        />
      ) : (
        <div className="rte-preview" dangerouslySetInnerHTML={{ __html: html || '<p>Nothing to preview yet.</p>' }} />
      )}
    </div>
  );
}
