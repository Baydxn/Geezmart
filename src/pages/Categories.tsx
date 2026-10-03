import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon, { type IconName } from '../components/Icon';
import { categories } from '../data/categories';

export default function Categories() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => categories.find((c) => c.id === activeId) ?? null, [activeId]);

  const grouped = useMemo(() => {
    if (!active) return [];
    const map = new Map<string, typeof active.subcategories>();
    for (const sub of active.subcategories) map.set(sub.group, [...(map.get(sub.group) ?? []), sub]);
    return [...map.entries()].map(([group, items]) => ({ group, items }));
  }, [active]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">Browse</p>
          <h1 className="page-title">Categories</h1>
        </div>
        <span className="chip chip-eyebrow">{categories.length} collections</span>
      </header>

      <div className="cat-strip">
        {categories.map((category) => (
          <motion.button
            key={category.id}
            type="button"
            className="cat-bubble"
            data-active={category.id === activeId}
            onClick={() => setActiveId(category.id === activeId ? null : category.id)}
            whileTap={{ scale: 0.93 }}
          >
            <span className="cat-bubble-glyph">
              <Icon name={category.icon as IconName} size={18} />
            </span>
            <span className="cat-bubble-label">{category.name}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {active ? (
          <motion.div
            key={active.id}
            className="cat-panel"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            <div className="cat-panel-head">
              <Icon name={active.icon as IconName} size={18} />
              <span className="cat-panel-title">{active.name}</span>
              <span className="text-3 t-xs">{active.tagline}</span>
              <span className="spacer" />
              <Link
                className="icon-btn icon-btn-sm"
                to={`/shop?category=${active.id}`}
                aria-label={`View all ${active.name}`}
              >
                <Icon name="arrowUpRight" size={15} />
              </Link>
            </div>
            <div className="cat-panel-groups">
              {grouped.map((group) => (
                <div key={group.group}>
                  <p className="cat-group-title">{group.group}</p>
                  {group.items.map((sub) => (
                    <Link
                      key={sub.id}
                      className="cat-link"
                      to={`/shop?category=${active.id}&sub=${sub.id}`}
                    >
                      <Icon name="chevronRight" size={14} />
                      {sub.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="stack" style={{ gap: 12, marginTop: 22 }}>
        {categories.map((category) => (
          <section className="card" key={category.id} style={{ padding: 16 }}>
            <div className="row" style={{ gap: 14 }}>
              <span className="menu-icon">
                <Icon name={category.icon as IconName} size={20} />
              </span>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 16 }}>{category.name}</h3>
                <p className="text-3 t-xs">{category.tagline}</p>
              </div>
              <span className="spacer" />
              <Link className="btn btn-ghost btn-sm" to={`/shop?category=${category.id}`}>
                Shop
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {category.subcategories.slice(0, 5).map((sub) => (
                <Link
                  key={sub.id}
                  className="chip"
                  to={`/shop?category=${category.id}&sub=${sub.id}`}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}