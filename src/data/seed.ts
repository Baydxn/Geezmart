/**
 * Demo data seed for the GEEZMART control plane.
 *
 * The storefront catalogue is converted into admin-managed records so the two
 * halves of the app share one source of truth from the very first load.
 */
import type { StoreSettings } from '../types/admin';

/**
 * No demo rows. The control plane starts empty: when Supabase is configured the
 * storefront and admin read rows straight from Postgres; otherwise every screen
 * clears to its genuine empty state until the live data arrives.
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'GEEZMART',
  storeDescription: 'Premium men lifestyle, technology, fashion and home. Curated in Nigeria, delivered nationwide.',
  logoUrl: '',
  faviconUrl: '',
  contactEmail: 'hello@geezmart.ng',
  phone: '+234 800 000 0000',
  whatsapp: '+234 800 000 0000',
  address: '12 Admiralty Way, Lekki Phase 1, Lagos',
  currencyCode: 'NGN',
  currencySymbol: '\u20A6',
  socials: [
    { platform: 'Instagram', url: 'https://instagram.com/geezmart' },
    { platform: 'X', url: 'https://x.com/geezmart' },
    { platform: 'TikTok', url: 'https://tiktok.com/@geezmart' },
  ],
  announcements: [
    { id: 'ann_delivery', label: 'Free delivery on orders over \u20A650,000', href: '/shop', icon: 'truck', enabled: true },
    { id: 'ann_returns', label: '7-day easy returns on every order', href: '/pages/returns', icon: 'refresh', enabled: true },
    { id: 'ann_secure', label: 'Secure checkout - pay on delivery available', href: '/shop', icon: 'shield', enabled: true },
  ],
  shippingZones: [
    { id: 'zone_lagos', name: 'Lagos', fee: 3500, eta: '1-2 business days', enabled: true },
    { id: 'zone_other', name: 'Other Nigerian states', fee: 6000, eta: '2-4 business days', enabled: true },
    { id: 'zone_pickup', name: 'Store pickup', fee: 0, eta: 'Ready in 24h', enabled: true },
  ],
  paymentMethods: [
    { id: 'pm_card', name: 'Card', detail: 'Visa, Mastercard, Verve', enabled: true, envKey: 'PAYMENT_CARD_SECRET_KEY' },
    { id: 'pm_transfer', name: 'Bank Transfer', detail: 'Provia, Opay, Kuda', enabled: true, envKey: 'PAYMENT_TRANSFER_SECRET_KEY' },
    { id: 'pm_wallet', name: 'Mobile Wallet', detail: 'Paga, PalmPay, Airtel', enabled: true, envKey: 'PAYMENT_WALLET_SECRET_KEY' },
  ],
  notificationPrefs: { newOrder: true, lowStock: true, newReview: true, newCustomer: true, payment: true },
  security: { sessionTimeoutMinutes: 480, loginMaxAttempts: 5, twoFactor: false },
  adminNav: [
    { id: 'nav_dashboard', label: 'Dashboard', href: '/admin', icon: 'grid', hidden: false },
    { id: 'nav_products', label: 'Products', href: '/admin/products', icon: 'box', hidden: false },
    { id: 'nav_categories', label: 'Categories', href: '/admin/categories', icon: 'grooming', hidden: false },
    { id: 'nav_orders', label: 'Orders', href: '/admin/orders', icon: 'orders', hidden: false },
    { id: 'nav_checkouts', label: 'Abandoned Carts', href: '/admin/checkouts', icon: 'refresh', hidden: false },
    { id: 'nav_customers', label: 'Customers', href: '/admin/customers', icon: 'user', hidden: false },
    { id: 'nav_inventory', label: 'Inventory', href: '/admin/inventory', icon: 'shop', hidden: false },
    { id: 'nav_coupons', label: 'Coupons', href: '/admin/coupons', icon: 'gift', hidden: false },
    { id: 'nav_reviews', label: 'Reviews', href: '/admin/reviews', icon: 'star', hidden: false },
    { id: 'nav_homepage', label: 'Homepage', href: '/admin/homepage', icon: 'sparkle', hidden: false },
    { id: 'nav_banners', label: 'Banners', href: '/admin/banners', icon: 'camera', hidden: false },
    { id: 'nav_pages', label: 'Pages', href: '/admin/pages', icon: 'help', hidden: false },
    { id: 'nav_media', label: 'Media', href: '/admin/media', icon: 'share', hidden: false },
    { id: 'nav_analytics', label: 'Analytics', href: '/admin/analytics', icon: 'sort', hidden: false },
    { id: 'nav_activity', label: 'Activity', href: '/admin/activity', icon: 'clock', hidden: false },
    { id: 'nav_settings', label: 'Settings', href: '/admin/settings', icon: 'settings', hidden: false },
  ],
};

/**
 * Demo rows were removed from the seed file. When Supabase is configured, the
 * storefront and admin read rows straight from Postgres; otherwise every screen
 * clears to its genuine empty state until the live data arrives.
 */
