import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';

interface QuantitySelectorProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  label?: string;
}

export default function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 20,
  size = 'md',
  label = 'Quantity',
}: QuantitySelectorProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className={`qty${size === 'sm' ? ' qty-sm' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={dec} disabled={value <= min} aria-label="Decrease quantity">
        <Icon name="minus" size={size === 'sm' ? 14 : 16} />
      </button>
      <span className="qty-value" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="inline-block"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" onClick={inc} disabled={value >= max} aria-label="Increase quantity">
        <Icon name="plus" size={size === 'sm' ? 14 : 16} />
      </button>
    </div>
  );
}
