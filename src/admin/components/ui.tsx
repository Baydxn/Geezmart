/**
 * Reusable admin UI primitives. All share the GEEZMART dark identity.
 */
import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../../components/Icon';

/* ------------------------------- Modal ------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="admin-modal-scrim"
            aria-label="Close dialog"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 17 }}>{title}</h2>
              <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            {children}
            {footer ? <div className="row" style={{ gap: 10, marginTop: 18 }}>{footer}</div> : null}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

/* ---------------------------- ConfirmDialog ---------------------------- */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-2 t-md">{message}</p>
    </Modal>
  );
}

/* ------------------------------- Pills ------------------------------- */

export function StatusPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'solid' | 'quiet' | 'warn';
}) {
  return (
    <span className="admin-pill" data-tone={tone}>
      {label}
    </span>
  );
}

/* ------------------------------- Switch ------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="switch"
      data-on={checked}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <motion.span layout className="switch-knob" transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
    </button>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="row" style={{ gap: 12, justifyContent: 'space-between' }}>
      <div style={{ minWidth: 0 }}>
        <p className="t-sm semi">{label}</p>
        {description ? <p className="admin-hint">{description}</p> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/* ------------------------------ Pagination ------------------------------ */

export function Pagination({
  page,
  pageCount,
  onPage,
  total,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  total: number;
}) {
  if (pageCount <= 1) return <p className="admin-hint" style={{ padding: '10px 12px' }}>{total} records</p>;
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 10, padding: '12px 14px' }}>
      <span className="admin-hint">
        Page {page + 1} of {pageCount}
      </span>
      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" size={15} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
        >
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Empty state ------------------------------ */

export function AdminEmpty({ icon = 'box', title, body }: { icon?: string; title: string; body?: string }) {
  return (
    <div className="admin-empty">
      <span className="empty-orb" style={{ width: 72, height: 72 }}>
        <Icon name={icon as never} size={26} />
      </span>
      <p className="semi" style={{ color: '#fff' }}>
        {title}
      </p>
      {body ? <p className="admin-hint">{body}</p> : null}
    </div>
  );
}

/* --------------------------- Integration note --------------------------- */

/**
 * Honest marker for operations that need a real server. We never pretend an
 * external action succeeded.
 */
export function IntegrationNote({ children }: { children: ReactNode }) {
  return (
    <p className="admin-hint" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <Icon name="shield" size={14} />
      <span>{children}</span>
    </p>
  );
}
