import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon, { type IconName } from './Icon';
import { categories } from '../data/categories';
import type { Subcategory } from '../types';

/**
 * CategoryMenu — horizontal bubble shortcuts with an inline, spring-animated
 * expansion panel. Selecting a different bubble collapses the previous panel.
 */
export default function CategoryMenu() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const navigate = useNavigate();

  const active = useMemo(
    () => categories.find((c) => c.id === activeId) ?? null,
    [activeId],
  );

  const grouped = useMemo(() => {
    if (!active) return [];
    const map = new Map<string, Subcategory[]>();
    for (const sub of active.subcategories) {
      map.set(sub.group, [...(map.get(sub.group) ?? []), sub]);
    }
    return [...map.entries()].map(([group, items]) => ({ group, items }));
  }, [active]);

  return (
    <div>
      <div className="cat-strip" role="tablist" aria-label="Shop by category">
        {categories.map((category) => {
          const isActive = category.id === activeId;
          return (
            <motion.button
              key={category.id}
              type="button"
              role="tab"
              className="cat-bubble"
              data-active={isActive}
              aria-expanded={isActive}
              aria-selected={isActive}
              onClick={() => setActiveId(isActive ? null : category.id)}
              whileTap={{ scale: 0.93 }}
            >
              <span className="cat-bubble-glyph">
                <Icon name={category.icon as IconName} size={18} />
              </span>
              <span className="cat-bubble-label">{category.name}</span>
            </motion.button>
          );
        })}
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
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                onClick={() => navigate(`/shop?category=${active.id}`)}
                aria-label={`View all ${active.name}`}
              >
                <Icon name="arrowUpRight" size={15} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                onClick={() => setActiveId(null)}
                aria-label="Collapse category"
              >
                <Icon name="close" size={15} />
              </button>
            </div>

            <motion.div
              className="cat-panel-groups"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
            >
              {grouped.map((group) => (
                <motion.div
                  key={group.group}
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                >
                  <p className="cat-group-title">{group.group}</p>
                  {group.items.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      className="cat-link"
                      onClick={() => navigate(`/shop?category=${active.id}&sub=${sub.id}`)}
                    >
                      <Icon name="chevronRight" size={14} />
                      {sub.name}
                    </button>
                  ))}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}