/** Create / edit a product: media, variants, pricing, inventory, SEO. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import { store, uid } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { ImageUploader } from '../components/ImageUploader';
import { SeoEditor } from '../components/SeoEditor';
import RichTextEditor from '../components/RichTextEditor';
import { StatusPill } from '../components/ui';
import { slugify, formatMoney } from '../../data/dbHelpers';
import { productImage } from '../../lib/productImage';
import type { AdminProduct, AdminVariant, ProductStatus } from '../../types/admin';

const STATUSES: ProductStatus[] = ['published', 'draft', 'hidden', 'out_of_stock', 'coming_soon'];

function blankProduct(): AdminProduct {
  return {
    id: uid('prd'),
    sku: '',
    name: '',
    brand: '',
    categoryId: '',
    subcategoryId: '',
    blurb: '',
    description: '',
    price: 0,
    compareAtPrice: null,
    costPrice: 0,
    discountPercent: 0,
    saleStart: null,
    saleEnd: null,
    stock: 0,
    reserved: 0,
    lowStockThreshold: 10,
    weightKg: 0.5,
    dimensions: '',
    status: 'draft',
    visual: 'watch',
    images: [],
    variants: [],
    seo: {
      title: '',
      description: '',
      slug: '',
      focusKeyword: '',
      canonicalUrl: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  useDbVersion();
  const db = store.read();

  const existing = id ? db.products.find((p) => p.id === id) : undefined;
  const [product, setProduct] = useState<AdminProduct>(() => existing ?? blankProduct());
  const [tab, setTab] = useState<'basics' | 'media' | 'variants' | 'pricing' | 'seo'>('basics');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (existing) setProduct(existing);
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (next: Partial<AdminProduct>) => setProduct((p) => ({ ...p, ...next }));

  const category = db.categories.find((c) => c.id === product.categoryId);
  const currency = db.settings.currencySymbol;

  const discountAmount = useMemo(
    () => (product.price > 0 ? Math.round((product.price * product.discountPercent) / 100) : 0),
    [product.price, product.discountPercent],
  );

  const autoSeo = () => {
    const slug = slugify(product.name);
    patch({
      seo: {
        title: `${product.name} | ${db.settings.storeName}`,
        description: `${product.blurb || product.description.slice(0, 120)}. Buy ${product.name} on ${db.settings.storeName}.`,
        slug,
        focusKeyword: product.name.toLowerCase(),
        canonicalUrl: `https://geezmart.com/product/${slug}`,
        ogTitle: `${product.name} | ${db.settings.storeName}`,
        ogDescription: product.blurb,
        ogImage: product.images[0]?.url ?? '',
      },
    });
  };

  const validate = (): string[] => {
    const list: string[] = [];
    if (!product.name.trim()) list.push('Product name is required.');
    if (!product.sku.trim()) list.push('SKU is required.');
    if (!product.categoryId) list.push('Choose a category.');
    if (product.price <= 0) list.push('Price must be greater than zero.');
    if (product.stock < 0) list.push('Stock cannot be negative.');
    return list;
  };

  const save = (status?: ProductStatus) => {
    const nextStatus = status ?? product.status;
    const problems = validate();
    if (status && status === 'published') {
      const publishedProblems = problems.filter((p) => !p.startsWith('Stock'));
      if (publishedProblems.length) {
        setErrors(publishedProblems);
        return;
      }
    } else if (problems.length) {
      setErrors(problems);
      return;
    }

    const record: AdminProduct = {
      ...product,
      status: nextStatus,
      sku: product.sku || `GZ-${product.id.toUpperCase()}`,
      updatedAt: new Date().toISOString(),
      images: product.images.length
        ? product.images
        : [
            {
              id: uid('img'),
              url: productImage(product.visual as never, 0, { tint: '#c7ccd3' }),
              filename: `${slugify(product.name) || 'product'}.svg`,
              size: 42_000,
              uploadedAt: new Date().toISOString(),
              primary: true,
            },
          ],
    };

    const isNew = !db.products.some((p) => p.id === record.id);
    store.write('products', (list) => {
      const rest = list.filter((p) => p.id !== record.id);
      return isNew ? [record, ...rest] : rest.map((p) => (p.id === record.id ? record : p));
    });
    if (isNew) {
      store.write('media', (list) => [
        ...record.images.map((img) => ({ ...img, kind: 'product' as const, width: 640, height: 652 })),
        ...list,
      ]);
    }

    logActivity(
      {
        action: isNew ? 'Product created' : 'Product updated',
        entity: 'Product',
        entityId: record.id,
        detail: `${record.name} ${isNew ? 'created' : `saved as ${nextStatus.replace('_', ' ')}`}`,
        after: record.status,
      },
      user?.name,
      user?.id,
    );

    setErrors([]);
    navigate('/admin/products');
  };

  return (
    <>
      <div className="admin-toolbar">
        <button type="button" className="icon-btn icon-btn-sm" onClick={() => navigate('/admin/products')} aria-label="Back to products">
          <Icon name="chevronLeft" size={16} />
        </button>
        <div>
          <p className="admin-kicker">{existing ? 'Edit product' : 'New product'}</p>
          <h1 className="admin-page-title">{product.name || 'Untitled product'}</h1>
        </div>
        <span className="spacer" />
        <StatusPill label={product.status.replace('_', ' ')} tone={product.status === 'published' ? 'solid' : 'quiet'} />
      </div>

      {errors.length ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel admin-alert-panel admin-mb-14"
        >
          <p className="t-sm semi" style={{ marginBottom: 6 }}>
            Fix these before saving
          </p>
          <ul style={{ paddingLeft: 18 }} className="admin-hint">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      <div className="tabs" style={{ marginBottom: 14, maxWidth: 560 }}>
        {(
          [
            ['basics', 'Basics'],
            ['media', 'Images'],
            ['variants', 'Variants'],
            ['pricing', 'Pricing'],
            ['seo', 'SEO'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" className="tab" data-active={tab === key} onClick={() => setTab(key)}>
            {tab === key ? <motion.span layoutId="pdp-tab" className="tab-bubble" /> : null}
            <span>{label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === 'basics' ? (
          <div className="stack" style={{ gap: 14 }}>
            <div className="form-section">
              <p className="form-section-title">Core information</p>
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="p-name">Product name</label>
                  <input id="p-name" className="input-dark" value={product.name} onChange={(e) => patch({ name: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-sku">SKU</label>
                  <input id="p-sku" className="input-dark" value={product.sku} placeholder="Auto-generated" onChange={(e) => patch({ sku: e.target.value.toUpperCase() })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-brand">Brand</label>
                  <input id="p-brand" className="input-dark" value={product.brand} onChange={(e) => patch({ brand: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-cat">Category</label>
                  <select id="p-cat" className="input-dark" value={product.categoryId} onChange={(e) => patch({ categoryId: e.target.value, subcategoryId: '' })}>
                    <option value="">Select category</option>
                    {db.categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-sub">Subcategory</label>
                  <select id="p-sub" className="input-dark" value={product.subcategoryId} onChange={(e) => patch({ subcategoryId: e.target.value })} disabled={!category}>
                    <option value="">Select subcategory</option>
                    {category?.subcategories.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-status">Status</label>
                  <select id="p-status" className="input-dark" value={product.status} onChange={(e) => patch({ status: e.target.value as ProductStatus })}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="p-blurb">Short description</label>
                <input id="p-blurb" className="input-dark" value={product.blurb} placeholder="Shown on product cards" onChange={(e) => patch({ blurb: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Full description</label>
                <RichTextEditor value={product.description} onChange={(html) => patch({ description: html })} />
              </div>
            </div>

            <div className="form-section">
              <p className="form-section-title">Shipping attributes</p>
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="p-weight">Weight (kg)</label>
                  <input id="p-weight" className="input-dark" type="number" step="0.01" value={product.weightKg} onChange={(e) => patch({ weightKg: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-dim">Dimensions</label>
                  <input id="p-dim" className="input-dark" value={product.dimensions} placeholder="20 x 14 x 6 cm" onChange={(e) => patch({ dimensions: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'media' ? (
          <div className="form-section">
            <p className="form-section-title">Product images</p>
            <ImageUploader
              images={product.images}
              onChange={(images) => patch({ images })}
              onError={(message) => setErrors((prev) => [...prev, message])}
            />
          </div>
        ) : null}

        {tab === 'variants' ? (
          <div className="form-section">
            <p className="form-section-title">Variants</p>
            <p className="admin-hint">
              Attribute groups drive the colour/size selectors on the product page. Per-variant pricing and
              stock are managed in Inventory.
            </p>
            <div className="stack" style={{ gap: 10 }}>
              {product.variants.map((variant) => (
                <div key={variant.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <input
                      className="input-dark"
                      value={variant.name}
                      aria-label="Variant name"
                      onChange={(e) =>
                        patch({
                          variants: product.variants.map((v) =>
                            v.id === variant.id ? { ...v, name: e.target.value } : v,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      aria-label="Remove variant"
                      onClick={() => patch({ variants: product.variants.filter((v) => v.id !== variant.id) })}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {variant.options.map((option, i) => (
                      <span key={`${option}-${i}`} className="tag">
                        {option}
                        <button
                          type="button"
                          aria-label={`Remove ${option}`}
                          onClick={() =>
                            patch({
                              variants: product.variants.map((v) =>
                                v.id === variant.id ? { ...v, options: v.options.filter((_, j) => j !== i) } : v,
                              ),
                            })
                          }
                          style={{ marginLeft: 6, display: 'inline-flex' }}
                        >
                          <Icon name="close" size={11} />
                        </button>
                      </span>
                    ))}
                    <input
                      className="input-dark"
                      style={{ width: 150, height: 30, fontSize: 12 }}
                      placeholder="Add option + Enter"
                      aria-label={`Add ${variant.name} option`}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (!value) return;
                        patch({
                          variants: product.variants.map((v) =>
                            v.id === variant.id ? { ...v, options: [...v.options, value] } : v,
                          ),
                        });
                        (e.target as HTMLInputElement).value = '';
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                patch({
                  variants: [...product.variants, { id: uid('var'), name: 'Option', options: [] } as AdminVariant],
                })
              }
            >
              <Icon name="plus" size={14} />
              Add variant group
            </button>
          </div>
        ) : null}

        {tab === 'pricing' ? (
          <div className="stack" style={{ gap: 14 }}>
            <div className="form-section">
              <p className="form-section-title">Pricing</p>
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="p-price">Regular price ({currency})</label>
                  <input id="p-price" className="input-dark" type="number" value={product.price} onChange={(e) => patch({ price: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-compare">Compare-at price ({currency})</label>
                  <input
                    id="p-compare"
                    className="input-dark"
                    type="number"
                    value={product.compareAtPrice ?? ''}
                    onChange={(e) => patch({ compareAtPrice: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-cost">Cost price ({currency}) · internal only</label>
                  <input id="p-cost" className="input-dark" type="number" value={product.costPrice} onChange={(e) => patch({ costPrice: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-disc">Discount %</label>
                  <input id="p-disc" className="input-dark" type="number" value={product.discountPercent} onChange={(e) => patch({ discountPercent: Number(e.target.value) })} />
                </div>
              </div>
              <div className="list-row">
                <Icon name="sparkle" size={15} />
                <div>
                  <p className="t-sm semi">Customer sees {formatMoney(product.price - discountAmount, currency)}</p>
                  <p className="admin-hint">
                    Discount of {formatMoney(discountAmount, currency)} · margin {formatMoney(product.price - product.costPrice, currency)} · cost price is never exposed.
                  </p>
                </div>
              </div>
            </div>

            <div className="form-section">
              <p className="form-section-title">Scheduled sale</p>
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="p-sstart">Start</label>
                  <input id="p-sstart" className="input-dark" type="date" value={product.saleStart?.slice(0, 10) ?? ''} onChange={(e) => patch({ saleStart: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-send">End</label>
                  <input id="p-send" className="input-dark" type="date" value={product.saleEnd?.slice(0, 10) ?? ''} onChange={(e) => patch({ saleEnd: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </div>
              </div>
            </div>

            <div className="form-section">
              <p className="form-section-title">Inventory</p>
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="p-stock">Stock quantity</label>
                  <input id="p-stock" className="input-dark" type="number" value={product.stock} onChange={(e) => patch({ stock: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-reserved">Reserved</label>
                  <input id="p-reserved" className="input-dark" type="number" value={product.reserved} onChange={(e) => patch({ reserved: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="p-low">Low-stock threshold</label>
                  <input id="p-low" className="input-dark" type="number" value={product.lowStockThreshold} onChange={(e) => patch({ lowStockThreshold: Number(e.target.value) })} />
                </div>
              </div>
              <p className="admin-hint">Available = stock − reserved. Saving here updates the storefront immediately.</p>
            </div>
          </div>
        ) : null}

        {tab === 'seo' ? (
          <div className="form-section">
            <p className="form-section-title">SEO & social</p>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={autoSeo}>
              <Icon name="sparkle" size={14} />
              Generate defaults
            </button>
            <SeoEditor value={product.seo} onChange={(seo) => patch({ seo })} domain={`${db.settings.storeName.toLowerCase()}.com`} />
          </div>
        ) : null}
      </motion.div>

      <div className="row" style={{ gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost btn-md" onClick={() => navigate('/admin/products')}>
          Cancel
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn-outline btn-md" onClick={() => save('draft')}>
          Save as draft
        </button>
        <button type="button" className="btn btn-primary btn-md" onClick={() => save('published')}>
          <Icon name="check" size={16} />
          Publish
        </button>
      </div>
    </>
  );
}
