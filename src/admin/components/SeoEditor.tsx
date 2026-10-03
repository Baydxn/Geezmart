/** SEO / meta editor with a live Google + social preview. */
import Icon from '../../components/Icon';
import type { SeoMeta } from '../../types/admin';

export function SeoEditor({
  value,
  onChange,
  domain = 'geezmart.com',
}: {
  value: SeoMeta;
  onChange: (next: SeoMeta) => void;
  domain?: string;
}) {
  const path = `/product/${value.slug || 'your-product'}`;
  const url = `${domain}${path}`;

  return (
    <div className="admin-grid-2">
      <div className="stack" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="seo-title">
            SEO title
          </label>
          <input
            id="seo-title"
            className="input-dark"
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="seo-desc">
            Meta description
          </label>
          <textarea
            id="seo-desc"
            className="input-dark"
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="seo-slug">
            URL slug
          </label>
          <input
            id="seo-slug"
            className="input-dark"
            value={value.slug}
            onChange={(e) => onChange({ ...value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="seo-keyword">
            Focus keyword
          </label>
          <input
            id="seo-keyword"
            className="input-dark"
            value={value.focusKeyword}
            onChange={(e) => onChange({ ...value, focusKeyword: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="seo-canonical">
            Canonical URL
          </label>
          <input
            id="seo-canonical"
            className="input-dark"
            value={value.canonicalUrl}
            onChange={(e) => onChange({ ...value, canonicalUrl: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="seo-ogtitle">
            Open Graph title
          </label>
          <input
            id="seo-ogtitle"
            className="input-dark"
            value={value.ogTitle}
            onChange={(e) => onChange({ ...value, ogTitle: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="seo-ogdesc">
            Open Graph description
          </label>
          <textarea
            id="seo-ogdesc"
            className="input-dark"
            value={value.ogDescription}
            onChange={(e) => onChange({ ...value, ogDescription: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="seo-ogimage">
            Social sharing image
          </label>
          <input
            id="seo-ogimage"
            className="input-dark"
            placeholder="Upload in Media, then paste the URL"
            value={value.ogImage}
            onChange={(e) => onChange({ ...value, ogImage: e.target.value })}
          />
        </div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <div>
          <p className="admin-kicker" style={{ marginBottom: 8 }}>
            Google search preview
          </p>
          <div className="seo-preview">
            <p className="seo-url">{value.canonicalUrl || url}</p>
            <p className="seo-title">{value.title || 'Untitled product | GEEZMART'}</p>
            <p className="seo-desc">
              {value.description ||
                'Add a meta description so customers understand the product before they click.'}
            </p>
          </div>
        </div>

        <div>
          <p className="admin-kicker" style={{ marginBottom: 8 }}>
            Social preview
          </p>
          <div className="seo-preview">
            <p className="seo-url">geezmart.com</p>
            <p className="seo-title">{value.ogTitle || value.title}</p>
            <p className="seo-desc">{value.ogDescription || value.description}</p>
          </div>
        </div>

        <div className="list-row" style={{ alignItems: 'flex-start' }}>
          <Icon name="search" size={15} />
          <div>
            <p className="t-sm semi">Checks</p>
            <ul style={{ paddingLeft: 16, marginTop: 6 }} className="admin-hint">
              <li>{value.title.length > 15 && value.title.length <= 60 ? 'Title length is good' : 'Aim for 15-60 characters'}</li>
              <li>{value.description.length > 70 && value.description.length <= 160 ? 'Meta description length is good' : 'Aim for 70-160 characters'}</li>
              <li>{value.slug.length > 3 ? 'Slug is set' : 'Add a URL slug'}</li>
              <li>{value.ogImage ? 'Social image set' : 'Add a social sharing image'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SeoEditor;
