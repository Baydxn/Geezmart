/**
 * GEEZMART Admin domain types.
 * These mirror the backend entities from the admin spec so the UI can be
 * pointed at a real API without redesign.
 */

export type AdminRole = 'super_admin' | 'admin' | 'product_manager' | 'order_manager' | 'support';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatarInitials: string;
  createdAt: string;
  lastLoginAt?: string;
}

export type ProductStatus = 'published' | 'draft' | 'hidden' | 'out_of_stock' | 'coming_soon';

export interface AdminVariant {
  id: string;
  name: string;
  options: string[];
}

export interface ProductImage {
  id: string;
  url: string;
  filename: string;
  size: number;
  uploadedAt: string;
  primary?: boolean;
}

export interface SeoMeta {
  title: string;
  description: string;
  slug: string;
  focusKeyword: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}

export interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  brand: string;
  categoryId: string;
  subcategoryId: string;
  blurb: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number;
  discountPercent: number;
  saleStart: string | null;
  saleEnd: string | null;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  weightKg: number;
  dimensions: string;
  status: ProductStatus;
  visual: string;
  images: ProductImage[];
  variants: AdminVariant[];
  seo: SeoMeta;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  tagline: string;
  hidden: boolean;
  order: number;
  subcategories: { id: string; name: string; group: string }[];
}

export interface Banner {
  id: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
  eyebrow: string;
  visual: string;
  tint: string;
  desktopImage: string;
  mobileImage: string;
  startDate: string | null;
  endDate: string | null;
  status: ProductStatus;
  order: number;
}

export type HomepageSectionType = 'hero' | 'categories' | 'products' | 'promo' | 'trust';

export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  enabled: boolean;
  order: number;
  title: string;
  kicker: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  collection: 'featured' | 'newDrop' | 'trending' | 'menPick' | 'custom';
  productIds: string[];
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface AdminOrder {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  lines: {
    productId: string;
    name: string;
    brand: string;
    price: number;
    quantity: number;
    variantLabel: string;
    visual: string;
    image?: string;
  }[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  couponCode: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  timeline: { status: OrderStatus; at: string }[];
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'suspended';
  addresses: { label: string; line: string; city: string; state: string }[];
  createdAt: string;
  lastOrderAt: string | null;
  note: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_delivery';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLimit: number;
  usedCount: number;
  expiresAt: string | null;
  enabled: boolean;
  categoryIds: string[];
  productIds: string[];
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  productName: string;
  customerName: string;
  rating: number;
  body: string;
  status: 'pending' | 'approved' | 'hidden';
  createdAt: string;
}

export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: ProductStatus;
  updatedAt: string;
}

export interface MediaItem extends ProductImage {
  kind: 'product' | 'banner' | 'category' | 'page' | 'social';
  width: number;
  height: number;
}

export interface AdminNotification {
  id: string;
  kind: 'order' | 'stock' | 'customer' | 'review' | 'payment' | 'refund';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href: string;
}

export interface ActivityLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  before?: string;
  after?: string;
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  storeDescription: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string;
  phone: string;
  whatsapp: string;
  address: string;
  currencyCode: string;
  currencySymbol: string;
  socials: { platform: string; url: string }[];
  shippingZones: { id: string; name: string; fee: number; eta: string; enabled: boolean }[];
  paymentMethods: { id: string; name: string; detail: string; enabled: boolean; envKey: string }[];
  notificationPrefs: {
    newOrder: boolean;
    lowStock: boolean;
    newReview: boolean;
    newCustomer: boolean;
    payment: boolean;
  };
  security: { sessionTimeoutMinutes: number; loginMaxAttempts: number; twoFactor: boolean };
  adminNav: { id: string; label: string; href: string; icon: string; hidden: boolean }[];
}

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ['*'],
  admin: ['*'],
  product_manager: ['products', 'categories', 'inventory', 'media', 'homepage', 'banners', 'reviews'],
  order_manager: ['orders', 'checkouts', 'inventory', 'customers'],
  support: ['orders', 'checkouts', 'customers', 'reviews'],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  product_manager: 'Product Manager',
  order_manager: 'Order Manager',
  support: 'Support',
};
