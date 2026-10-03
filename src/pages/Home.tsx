import { Link } from 'react-router-dom';
import HeroCarousel from '../components/HeroCarousel';
import CategoryMenu from '../components/CategoryMenu';
import ProductSection from '../components/ProductSection';
import Icon, { type IconName } from '../components/Icon';
import { HeroSkeleton, CategorySkeleton } from '../components/Skeletons';
import { useEffect, useState } from 'react';
import { listCategories } from '../lib/api';
import type { Category } from '../types';

const TRUST: { icon: IconName; label: string }[] = [
  { icon: 'shield', label: '100% Original' },
  { icon: 'truck', label: 'Fast Delivery' },
  { icon: 'wallet', label: 'Secure Payment' },
  { icon: 'refresh', label: '7-Day Returns' },
];

export default function Home() {
  const [ready, setReady] = useState(false);
  const [showCategories, setShowCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;
    listCategories().then((cats) => {
      if (!active) return;
      setShowCategories(cats);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {ready ? <HeroCarousel /> : <HeroSkeleton />}

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
        {showCategories.length ? (
          <CategoryMenu />
        ) : (
          <CategorySkeleton count={6} />
        )}
      </section>

      <ProductSection collection="featured" kicker="Curated" title="Featured" />
      <ProductSection collection="newDrop" kicker="Just In" title="New Drops" viewAll="/shop?sort=newest" />
      <ProductSection collection="trending" kicker="Moving Fast" title="Trending" viewAll="/shop?sort=popular" />
      <ProductSection collection="menPick" kicker="For Him" title="Men's Picks" viewAll="/shop?collection=menPick" />

      <section className="section">
        <div className="promo metal-edge">
          <div className="promo-inner">
            <p className="section-kicker">GEEZMART Membership</p>
            <h2>Premium access, before everyone else.</h2>
            <p className="text-2 t-md">
              Early drops, private pricing and free express delivery on every order over ₦250,000.
              Membership is free and takes seconds to activate.
            </p>
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
                <b>4.9</b>
                <span>Average rating</span>
              </div>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 6 }}>
              <Link to="/shop" className="btn btn-primary btn-md">
                Start Shopping
                <Icon name="arrowRight" size={16} />
              </Link>
              <Link to="/account" className="btn btn-ghost btn-md">
                Join Free
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="trust" aria-label="Why shop with GEEZMART">
        {TRUST.map((item) => (
          <div className="trust-item" key={item.label}>
            <Icon name={item.icon} size={18} />
            {item.label}
          </div>
        ))}
      </div>
    </>
  );
}