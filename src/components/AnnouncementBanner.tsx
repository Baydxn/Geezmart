/**
 * Animated announcement banner.
 *
 * A horizontal marquee that loops announcements at the very top of the
 * storefront. Each item is a clickable announcement link; the admin manages
 * these records in the store settings (Announcements tab).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useAnnouncements } from '../store/useCatalog';
import { activeAnnouncements } from '../lib/api';

/** Pure UI for the scrolling track. */
function AnnouncementTrack({
  items,
  reversed,
}: {
  items: { id: string; label: string; href: string; icon?: string }[];
  reversed?: boolean;
}) {
  const doubled = useMemo(() => [...items, ...items], [items]);
  return (
    <div
      className={
        'announcement-track' + (reversed ? ' announcement-track--reversed' : '')
      }
    >
      {doubled.map((item, index) => (
        <div key={`${item.id}-${index}`} className="announcement-item">
          {item.icon ? (
            <span className="announcement-item-icon">
              <Icon name={item.icon as never} size={13} />
            </span>
          ) : null}
          <Link to={item.href} className="announcement-link">
            {item.label}
          </Link>
        </div>
      ))}
    </div>
  );
}

export default function AnnouncementBanner() {
  const { items } = useAnnouncements();
  const active = useMemo(() => activeAnnouncements(items), [items]);
  const [reversed, setReversed] = useState(false);

  if (active.length === 0) return null;

  return (
    <header className="announcement-banner" aria-label="Announcements">
      <AnnouncementTrack items={active} reversed={reversed} />
      <button
        type="button"
        className="announcement-chevron"
        aria-label={
          reversed
            ? 'Scroll announcements forward'
            : 'Scroll announcements backward'
        }
        onClick={() => setReversed((r) => !r)}
      >
        <Icon name={reversed ? 'chevronLeft' : 'arrowRight'} size={16} />
      </button>
    </header>
  );
}
