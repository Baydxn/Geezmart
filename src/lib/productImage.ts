import type { Product, VisualKind } from '../types';
import { SHAPES } from './shapes';

/**
 * Demo visual generator.
 *
 * Until real photography is supplied, each product renders a deterministic
 * cinematic SVG "studio shot" — dark stage, soft top light, metallic product
 * silhouette. Set `product.image` / `product.gallery` to real URLs and the UI
 * switches to photography automatically (see `resolveProductImage`).
 */

export interface VisualOptions {
  /** Hex accent used for the stage light. */
  tint?: string;
  /** Slight rotation variation so repeated renders are not identical. */
  seed?: number;
}

const cache = new Map<string, string>();

function stage(kind: VisualKind, { seed = 0 }: VisualOptions): string {
  const angle = ((seed % 5) * 6 - 12).toFixed(1);
  return `<rect width="640" height="640" fill="url(#bg)"/>
  <ellipse cx="320" cy="240" rx="330" ry="240" fill="url(#spot)"/>
  <ellipse cx="320" cy="596" rx="240" ry="34" fill="#000" opacity=".55"/>
  <g transform="rotate(${angle} 320 340) translate(0 6)">
    ${SHAPES[kind]}
    <rect width="640" height="640" fill="url(#sheen)"/>
  </g>
  <rect x="1" y="1" width="638" height="638" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="2"/>`;
}

const DEFS = `<defs>
    <linearGradient id="m1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f6f8"/><stop offset=".34" stop-color="#9aa1ab"/>
      <stop offset=".62" stop-color="#454b55"/><stop offset="1" stop-color="#cdd3da"/>
    </linearGradient>
    <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e9edf1"/><stop offset=".5" stop-color="#7d848e"/>
      <stop offset="1" stop-color="#2b2f36"/>
    </linearGradient>
    <radialGradient id="bg" cx=".5" cy=".24" r=".9">
      <stop offset="0" stop-color="#22262c"/><stop offset=".48" stop-color="#12151a"/>
      <stop offset="1" stop-color="#07080a"/>
    </radialGradient>
    <radialGradient id="spot" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="__TINT__" stop-opacity=".26"/>
      <stop offset="1" stop-color="__TINT__" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>`;

const svgFor = (kind: VisualKind, options: VisualOptions) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640">${DEFS.replace(
    /__TINT__/g,
    options.tint ?? '#ffffff',
  )}${stage(kind, options)}</svg>`;

/** Data-URI studio shot for a product (a real `product.image` always wins). */
export function productImage(kind: VisualKind, variantIndex = 0, options: VisualOptions = {}): string {
  const opts: VisualOptions = { ...options, seed: variantIndex + (options.seed ?? 0) };
  const key = `p:${kind}:${opts.seed}:${opts.tint ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgFor(kind, opts))}`;
  cache.set(key, uri);
  return uri;
}

/** Cinematic wide stage used by the hero carousel. */
export function heroImage(kind: VisualKind, seed = 0, tint = '#ffffff'): string {
  const key = `h:${kind}:${seed}:${tint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const inner = svgFor(kind, { seed, tint }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760">
  <defs>
    <radialGradient id="hbg" cx=".68" cy=".34" r=".85">
      <stop offset="0" stop-color="#262a31"/><stop offset=".5" stop-color="#111419"/>
      <stop offset="1" stop-color="#06070a"/>
    </radialGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="760" fill="url(#hbg)"/>
  <ellipse cx="880" cy="220" rx="420" ry="300" fill="${tint}" opacity=".07"/>
  <g transform="translate(600,-40) scale(1.06)">${inner}</g>
  <path d="M0 760 L520 0 L900 0 L320 760 Z" fill="url(#beam)" opacity=".55"/>
  <rect width="1200" height="760" fill="#06070a" opacity=".18"/>
</svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(key, uri);
  return uri;
}

/** Resolve the best available image for a product. */
export function resolveProductImage(
  product: Pick<Product, 'visual' | 'image' | 'colors'>,
  variantIndex = 0,
): string {
  if (product.image) return product.image;
  return productImage(product.visual, variantIndex, { tint: product.colors[0]?.hex ?? '#ffffff' });
}

/** Full gallery for the product detail page (real gallery when provided). */
export function productGallery(product: Product): string[] {
  if (product.gallery?.length) return product.gallery;
  return product.colors.length
    ? product.colors.map((_, i) => resolveProductImage(product, i))
    : [resolveProductImage(product)];
}