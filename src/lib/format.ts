/** Currency + display helpers. Swap the formatter for a backend-provided locale later. */
export function formatPrice(value: number, currency = '₦'): string {
  return `${currency}${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace('.0', '')}k`;
  return String(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function relativeTime(iso: string): string {
  const days = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)),
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

/** Order references look like GZ-000001. */
export function orderReference(seed: number): string {
  return `GZ-${String(seed).padStart(6, '0')}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}