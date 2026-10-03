import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroCarousel, { type HeroSlide } from '../components/HeroCarousel';
import CategoryMenu from '../components/CategoryMenu';
import ProductSection, { SingleProduct } from '../components/ProductSection';
import Icon, { type IconName } from '../components/Icon';
import { HeroSkeleton, CategorySkeleton } from '../components/Skeletons';
import { listHeroSlides, listHomeSections, listProducts } from '../lib/api';
import { store } from '../lib/db';
import { useDbVersion } from '../admin/AdminContext';
import type { Product } from '../types';
import type { HomepageSection } from '../types/admin';

const TRUST: { icon: IconName; label: string }[] = [
  { icon: 'shield', label: '100% Original' },
  { icon: 'truck', label: 'Fast Delivery' },
  { icon: 'wallet', label: 'Secure Payment' },
  { icon: 'refresh', label: '7-Day Returns' },
];

export default function Home() {
  useDbVersion();
  const [slides, setSlides] = useState<HeroSlide[] | null>(null);
  const [sections, setSections] = useState<HomepageSection[] | null>(null);
  const [customProducts, setCustomProducts] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([listHeroSlides(), listHomeSections()]).then(([banners, home]) => {
      if (!active) return;
      setSlides(banners);
      setSections(home);
    });
    return () => {
      active = false;
    };
  }, []);

  // Custom homepage sections pin specific products chosen in the admin panel.
  useEffect(() => {
    const pinned = (sections ?? []).flatMap((s) => s.productIds);
    if (!pinned.length) return;
    let active = true;
    void listProducts().then((all) => {
      if (!active) return;
      setCustomProducts(all.filter((p) => pinned.includes(p.id)));
    });
    return () => {
      active = false;
    };
  }, [sections]);

  const currency = store.read().settings.currencySymbol;

  const customGrid = useMemo(() => {
    if (!sections) return [];
    return sections
      .filter((s) => s.type === 'products' && s.collection === 'custom' && s.enabled)
      .map((section) => ({
        section,
        products: customProducts.filter((p) => section.productIds.includes(p.id)).slice(0, 6),
      }))
      .filter((entry) => entry.products.length > 0);
  }, [sections, customProducts]);

  return (
    <>
      {slides?.length ? (
        <HeroCarousel slides={slides} />
      ) : slides?.length === 0 ? (
        <div className="promo" style={{ minHeight: 200, display: 'grid', placeItems: 'center' }}>
          <p className="text-3 t-sm">No published banners yet — add one in Admin → Banners.</p>
        </div>
      ) : (
        <HeroSkeleton />
      )}

      {(sections ?? []).some((s) => s.type === 'categories' && s.enabled) ? (
        <section className="section" aria-label="Shop by category">
          <div className="section-head">
            <div>
              <p className="section-kicker">Explore</p>
              <h2 className="section-title">Shop by Category</h2>
            </div>
            <Link className="link-more" to="/categories">
              All Categories
              <Icon name="arrowRight" size={15} />
            </Link>
          </div>
          <CategoryMenu />
        </section>
      ) : null}

      {(sections ?? []).map((section) => {
        if (!section.enabled) return null;

        if (section.type === 'products') {
          if (section.collection === 'custom') return null; // rendered below in order
          return (
            <ProductSection
              key={section.id}
              collection={section.collection}
              kicker={section.kicker}
              title={section.title}
              viewAll={section.ctaHref || '/shop'}
            />
          );
        }

        if (section.type === 'promo') {
          return (
            <section className="section" key={section.id}>
              <div className="promo metal-edge">
                <div className="promo-inner">
                  <p className="section-kicker">{section.kicker}</p>
                  <h2>{section.title}</h2>
                  <p className="text-2 t-md">{section.description}</p>
                  <div className="promo-stats">
                    <div className="promo-stat">
                      <b>24h</b>
                      <span>Express delivery</span>
                    </div>
                    <div className="promo-stat">
                      <b>2×</b>
                      <span>Reward points</span>
                    </div>
                    <div className="promo-stat">
                      <b>{currency}</b>
                      <span>Free delivery over 250k</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10, marginTop: 6 }}>
                    <Link to={section.ctaHref || '/shop'} className="btn btn-primary btn-md">
                      {section.ctaText || 'Start Shopping'}
                      <Icon name="arrowRight" size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          );
        }

        if (section.type === 'trust') {
          return (
            <div className="trust" key={section.id} aria-label={section.title || 'Why shop with GEEZMART'}>
              {TRUST.map((item) => (
                <div className="trust-item" key={item.label}>
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </div>
              ))}
            </div>
          );
        }

        return null;
      })}

      {customGrid.map(({ section, products }) => (
        <section className="section" key={section.id}>
          <div className="section-head">
            <div>
              {section.kicker ? <p className="section-kicker">{section.kicker}</p> : null}
              <h2 className="section-title">{section.title}</h2>
            </div>
            <Link className="link-more" to={section.ctaHref || '/shop'}>
              {section.ctaText || 'View All'}
              <Icon name="arrowRight" size={15} />
            </Link>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <SingleProduct key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}

      {!sections ? <CategorySkeleton count={6} /> : null}
    </>
  );
}
