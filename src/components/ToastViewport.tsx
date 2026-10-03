import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';
import { useToast } from '../store/ToastContext';

export default function ToastViewport() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className="toast"
            layout
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={() => dismiss(toast.id)}
          >
            <span className="toast-icon">
              <Icon name={toast.tone === 'success' ? 'check' : 'sparkle'} size={14} strokeWidth={2.3} />
            </span>
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}