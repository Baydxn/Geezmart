/**
 * GEEZMART domain types.
 * Everything in the storefront is derived from these contracts, so a backend
 * can be introduced later by replacing `src/lib/api.ts` implementations only.
 */

export type CategoryId =
  | 'watches'
  | 'gadgets'
  | 'grooming'
  | 'phones'
  | 'fashion'
  | 'furniture'
  | 'accessories'
  | 'home';

export type VisualKind =
  | 'watch'
  | 'headphones'
  | 'earbuds'
  | 'speaker'
  | 'light'
  | 'phone'
  | 'cream'
  | 'kit'
  | 'sneakers'
  | 'shirt'
  | 'couch'
  | 'cabinet'
  | 'tvstand'
  | 'lamp'
  | 'bag'
  | 'bottle'
  | 'wallet';

export interface Subcategory {
  id: string;
  name: string;
  /** Optional grouping label shown as a column heading in the category panel. */
  group: string;
}

export interface Category {
  id: CategoryId;
  name: string;
  slug: string;
  /** Monochrome icon key rendered by <Icon name={...} />. */
  icon: string;
  tagline: string;
  subcategories: Subcategory[];
}

export interface ProductVariant {
  id: string;
  label: string;
  /** Hex used for the swatch chip. */
  hex: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryId: CategoryId;
  subcategoryId: string;
  /** Short line shown on the card. */
  blurb: string;
  /** Full description on the product detail page. */
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  rating: number;
  reviewCount: number;
  stock: number;
  visual: VisualKind;
  /** Real image URL. When absent a premium generated visual is used instead. */
  image?: string;
  gallery?: string[];
  colors: ProductVariant[];
  tags: string[];
  badges: string[];
  collections: { featured?: boolean; newDrop?: boolean; trending?: boolean; menPick?: boolean };
  createdAt: string;
  popularity: number;
}

export interface CartLine {
  lineId: string;
  productId: string;
  variantId: string;
  quantity: number;
  addedAt: number;
}

export interface CartTotals {
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  itemCount: number;
}

export type DeliveryMethod = 'home' | 'pickup';
export type PaymentMethod = 'card' | 'transfer' | 'wallet';
export type OrderStatus = 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface OrderLine {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  variantLabel: string;
  visual: VisualKind;
  image?: string;
}

export interface Order {
  id: string;
  reference: string;
  placedAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
  };
  timeline: { status: OrderStatus; label: string; at: string }[];
}

export type Filters = {
  categoryIds: CategoryId[];
  subcategoryIds: string[];
  brands: string[];
  minRating: number;
  inStockOnly: boolean;
  minPrice: number | null;
  maxPrice: number | null;
};

/** Checkout step-1 form shape. */
export interface CheckoutForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
}

export type SortKey = 'recommended' | 'newest' | 'price-asc' | 'price-desc' | 'popular';