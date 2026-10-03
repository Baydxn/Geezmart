import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import ProductGrid from '../components/ProductGrid';
import { useWishlist } from '../store/WishlistContext';

export default function Wishlist() {
  const { items } = useWishlist();

  return (
    <>
      <header className="page-head">
        <div>
          <p className="section-kicker">Saved</p>
          <h1 className="page-title">Saved Items</h1>
        </div>
        <span className="chip chip-eyebrow">{items.length} saved</span>
      </header>

      {items.length ? (
        <>
          <ProductGrid products={items} />
          <div className="row" style={{ marginTop: 20 }}>
            <Link className="btn btn-ghost btn-lg btn-block" to="/shop">
              Keep Browsing
              <Icon name="arrowRight" size={17} />
            </Link>
          </div>
        </>
      ) : (
        <div className="empty">
          <div className="empty-orb">
            <Icon name="heart" size={34} />
          </div>
          <h2>Nothing saved yet.</h2>
          <p className="text-3 t-md">Tap the heart on any product to keep it here.</p>
          <Link className="btn btn-primary btn-md" to="/shop">
            Browse Products
          </Link>
        </div>
      )}
    </>
  );
}