import { motion } from 'framer-motion';
import Logo from './Logo';

/** Suspense fallback shown while a lazy route chunk loads. */
export default function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
      }}
    >
      <div className="stack" style={{ alignItems: 'center', gap: 18 }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Logo height={24} />
        </motion.div>
        <span className="skeleton" style={{ width: 120, height: 6 }} />
        <span className="sr-only">Loading page</span>
      </div>
    </div>
  );
}