import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/Icon';
import Rating from '../components/Rating';
import QuantitySelector from '../components/QuantitySelector';
import Accordion from '../components/Accordion';
import WishlistButton from '../components/WishlistButton';
import ProductGrid, { ProductGridSkeleton } from '../components/ProductGrid';
import { BackHeader } from '../components/TopNavigation';
import { useCart } from '../store/CartContext';
import { getProductBySlug, listRelated } from '../lib/api';
import { getCategory } from '../data/categories';
import { formatPrice, formatDate } from '../lib/format';
import { productGallery, resolveProductImage } from '../lib/productImage';
import type { Product } from '../types';

const BENEFITS = ['Original', 'Fast Delivery', 'Secure Payment'];

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[] | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    setProduct(null);
    setRelated(null);
    setVariantIndex(0);
    setQuantity(1);
    setImageIndex(0);

    getProductBySlug(slug).then(async (found) => {
      if (!active) return;
      setProduct(found ?? null);
      if (found) setRelated(await listRelated(found, 6));
    });

    return () => {
      active = false;
    };
  }, [slug]);

  const gallery = useMemo(() => (product ? productGallery(product) : []), [product]);

  if (!product) {
    return (
      <>
        <BackHeader />
        <div className="page page-pad">
          <div className="gallery">
            <div className="skeleton" style={{ aspectRatio: '1 / 1.02', borderRadius: 'var(--r-xl)' }} />
            <div className="stack" style={{ gap: 12 }}>
              <div className="skeleton" style={{ height: 12, width: 120 }} />
              <div className="skeleton" style={{ height: 26, width: '70%' }} />
              <div className="skeleton" style={{ height: 14, width: '90%' }} />
              <div className="skeleton" style={{ height: 34, width: 150 }} />
            </div>
          </div>
        </div>
      </>
    );
  }

  const category = getCategory(product.categoryId);
  const variant = product.colors[variantIndex] ?? product.colors[0];
  const image = gallery[imageIndex] ?? resolveProductImage(product, variantIndex);

  const onAdd = () => {
    add(product, variant?.id, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  const onBuyNow = () => {
    add(product, variant?.id, quantity);
    navigate('/checkout');
  };


  return (
    <>
      <BackHeader />
      <div className="page page-pad">
        <nav aria-label="Breadcrumb" className="row" style={{ gap: 6, marginBottom: 14 }}>
          <Link className="text-3 t-xs" to="/">
            Home
          </Link>
          <Icon name="chevronRight" size={12} className="text-3" />
          <Link className="text-3 t-xs" to={`/shop?category=${product.categoryId}`}>
            {category?.name}
          </Link>
          <Icon name="chevronRight" size={12} className="text-3" />
          <span className="t-xs semi clamp-2">{product.name}</span>
        </nav>

        <div className="gallery">
          <div style={{ display: 'grid', gap: 12 }}>
            <motion.div
              className="gallery-main"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.14}
              onDragEnd={(_e, info) => {
                if (info.offset.x < -60) setImageIndex((idx) => (idx + 1) % gallery.length);
                else if (info.offset.x > 60)
                  setImageIndex((idx) => (idx - 1 + gallery.length) % gallery.length);
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={image}
                  src={image}
                  alt={product.name}
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.26 }}
                  width={640}
                  height={652}
                />
              </AnimatePresence>
              <WishlistButton product={product} className="p-card-fav" size={18} />
              {gallery.length > 1 ? (
                <span className="chip chip-eyebrow" style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 2 }}>
                  {imageIndex + 1} / {gallery.length}
                </span>
              ) : null}
            </motion.div>

            {gallery.length > 1 ? (
              <div className="gallery-thumbs" role="tablist" aria-label="Product images">
                {gallery.map((src, i) => (
                  <button
                    key={`${i}-${src.slice(-16)}`}
                    type="button"
                    role="tab"
                    className="gallery-thumb"
                    data-active={i === imageIndex}
                    aria-selected={i === imageIndex}
                    aria-label={`View image ${i + 1}`}
                    onClick={() => setImageIndex(i)}
                  >
                    <img src={src} alt="" loading="lazy" width={62} height={62} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="stack" style={{ gap: 16 }}>
            <div>
              <Link className="section-kicker" to={`/shop?category=${product.categoryId}`}>
                {category?.name}
              </Link>
              <h1 style={{ marginTop: 6, fontSize: 'clamp(24px, 6.4vw, 34px)' }}>{product.name}</h1>
              <p className="text-2 t-sm" style={{ marginTop: 8 }}>
                {product.blurb} · {product.brand}
              </p>
            </div>

            <div className="row" style={{ gap: 10 }}>
              <Rating value={product.rating} count={product.reviewCount} size={13} />
              <span className="text-3 t-xs">
                · {product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}
              </span>
            </div>

            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <span className="pdp-price">{formatPrice(product.price, product.currency)}</span>
              {product.compareAtPrice ? (
                <span className="text-3 t-md" style={{ textDecoration: 'line-through' }}>
                  {formatPrice(product.compareAtPrice, product.currency)}
                </span>
              ) : null}
            </div>

            <div className="benefits">
              {BENEFITS.map((benefit) => (
                <span className="benefit" key={benefit}>
                  <Icon name="check" size={13} strokeWidth={2.4} />
                  {benefit}
                </span>
              ))}
            </div>

            {product.colors.length > 1 ? (
              <div className="field">
                <span className="label">
                  Colour — <span style={{ color: 'var(--text-2)' }}>{variant?.label}</span>
                </span>
                <div className="swatches">
                  {product.colors.map((color, i) => (
                    <button
                      key={color.id}
                      type="button"
                      className="swatch"
                      style={{ background: color.hex }}
                      data-active={i === variantIndex}
                      aria-label={color.label}
                      aria-pressed={i === variantIndex}
                      onClick={() => {
                        setVariantIndex(i);
                        setImageIndex(i % gallery.length);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, product.stock)} />
              <span className="text-3 t-sm">
                {formatPrice(product.price * quantity, product.currency)} total
              </span>
            </div>

            <div className="stack" style={{ gap: 10 }}>
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onAdd}>
                <AnimatePresence mode="wait" initial={false}>
                  {added ? (
                    <motion.span
                      key="added"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className="row"
                    >
                      <Icon name="check" size={18} strokeWidth={2.3} />
                      Added to Cart
                    </motion.span>
                  ) : (
                    <motion.span key="add" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="row">
                      <Icon name="cart" size={18} />
                      Add to Cart
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <button type="button" className="btn btn-outline btn-lg btn-block" onClick={onBuyNow}>
                Buy Now
                <Icon name="arrowRight" size={17} />
              </button>
            </div>

            <ProductAccordion product={product} />
          </div>
        </div>

        <RelatedSection related={related} categoryId={product.categoryId} />
      </div>
    </>
  );
}

/** Expandable information blocks on the product detail page. */
function ProductAccordion({ product }: { product: Product }) {
  const category = getCategory(product.categoryId);
  return (
    <Accordion
      defaultOpen="details"
      items={[
        {
          id: 'details',
          title: 'Product Details',
          content: (
            <>
              <p>{product.description}</p>
              <ul className="stack" style={{ gap: 4, marginTop: 4 }}>
                <li>Brand: {product.brand}</li>
                <li>Category: {category?.name}</li>
                <li>Added: {formatDate(product.createdAt)}</li>
                {product.tags.slice(0, 4).map((tag) => (
                  <li key={tag}>· {tag}</li>
                ))}
              </ul>
            </>
          ),
        },
        {
          id: 'shipping',
          title: 'Shipping & Returns',
          content: (
            <>
              <p>
                Standard delivery takes 2–4 business days nationwide. Express delivery is available on the
                next working day in Lagos, Abuja and Port Harcourt.
              </p>
              <p>
                Returns are accepted within 7 days of delivery on unworn, boxed items. Refunds are processed
                back to the original payment method within 5 business days.
              </p>
            </>
          ),
        },
        {
          id: 'reviews',
          title: `Customer Reviews (${product.reviewCount})`,
          content: (
            <>
              <div className="row" style={{ gap: 12 }}>
                <strong style={{ fontFamily: 'Sora', fontSize: 26 }}>{product.rating}</strong>
                <div className="stack" style={{ gap: 4 }}>
                  <Rating value={product.rating} size={14} showCount={false} />
                  <span className="text-3 t-xs">Based on {product.reviewCount} reviews</span>
                </div>
              </div>
              <p>
                &ldquo;Exactly what I was after — the quality is obvious and delivery was quick. Would order
                again.&rdquo;
              </p>
              <span className="text-3 t-xs">Verified purchase · Delivered</span>
            </>
          ),
        },
      ]}
    />
  );
}

function RelatedSection({
  related,
  categoryId,
}: {
  related: Product[] | null;
  categoryId: string;
}) {
  if (!related) {
    return (
      <section className="section">
        <div className="skeleton" style={{ height: 18, width: 180, marginBottom: 14 }} />
        <ProductGridSkeleton count={4} />
      </section>
    );
  }
  if (!related.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">You May Also Like</h2>
        <Link className="link-more" to={`/shop?category=${categoryId}`}>
          View All
          <Icon name="arrowRight" size={15} />
        </Link>
      </div>
      <ProductGrid products={related} />
    </section>
  );
}

