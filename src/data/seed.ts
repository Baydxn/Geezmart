/**
 * Demo data seed for the GEEZMART control plane.
 *
 * The storefront catalogue is converted into admin-managed records so the two
 * halves of the app share one source of truth from the very first load.
 */
import { products as seedProducts } from './products';
import { categories as seedCategories } from './categories';
import { productGallery } from '../lib/productImage';
import { uid } from './dbHelpers';
import type {
  ActivityLog,
  AdminCategory,
  AdminCustomer,
  AdminNotification,
  AdminOrder,
  AdminProduct,
  AdminUser,
  Banner,
  ContentPage,
  Coupon,
  HomepageSection,
  MediaItem,
  Review,
  StoreSettings,
} from '../types/admin';

/** PBKDF2-SHA256, 120k iterations. Demo password for every seeded admin: GEEZMART2024! */
const ADMIN_ACCOUNTS = [
  {
    id: 'adm_1',
    name: 'Eriqk Okoro',
    email: 'admin@geezmart.ng',
    salt: 'ek0Gm2uR',
    passwordHash: 'rlqeqVVujAGWZHBsWMc5AEChMbKLNp/84JSKlDxJIg0=',
    role: 'super_admin' as const,
    avatarInitials: 'EO',
  },
  {
    id: 'adm_2',
    name: 'Ada Nwosu',
    email: 'manager@geezmart.ng',
    salt: 'mn7xQ4b1',
    passwordHash: '3BVgN1wy1Lo9uJN5VS1jXn+stmYwJeRA1/vRHjsMbiY=',
    role: 'product_manager' as const,
    avatarInitials: 'AN',
  },
  {
    id: 'adm_3',
    name: 'Tomi Balogun',
    email: 'orders@geezmart.ng',
    salt: 'or3Zw9Lt',
    passwordHash: 'M0JiIiN7vLQqY9g5ZpntSTl05ozMXQOiJs47uiXgMzA=',
    role: 'order_manager' as const,
    avatarInitials: 'TB',
  },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

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

function toSeo(name: string, blurb: string, slug: string, brand: string) {
  return {
    title: `${name} | GEEZMART`,
    description: `${blurb}. Buy ${name} by ${brand} on GEEZMART with fast delivery and secure payment across Nigeria.`,
    slug,
    focusKeyword: name.toLowerCase(),
    canonicalUrl: `https://geezmart.com/product/${slug}`,
    ogTitle: `${name} | GEEZMART`,
    ogDescription: blurb,
    ogImage: '',
  };
}

function buildProducts(): AdminProduct[] {
  return seedProducts.map((p, index) => {
    const gallery = productGallery(p);
    return {
      id: p.id,
      sku: `GZ-${p.id.toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
      name: p.name,
      brand: p.brand,
      categoryId: p.categoryId,
      subcategoryId: p.subcategoryId,
      blurb: p.blurb,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? null,
      costPrice: Math.round(p.price * 0.62),
      discountPercent: p.compareAtPrice
        ? Math.max(0, Math.round((1 - p.price / p.compareAtPrice) * 100))
        : 0,
      saleStart: null,
      saleEnd: null,
      stock: p.stock,
      reserved: Math.min(3, Math.floor(p.stock / 10)),
      lowStockThreshold: 10,
      weightKg: Number((0.2 + (index % 7) * 0.35).toFixed(2)),
      dimensions: `${20 + (index % 5) * 6} x ${14 + (index % 4) * 5} x ${6 + (index % 3) * 4} cm`,
      status: p.stock === 0 ? 'out_of_stock' : 'published',
      visual: p.visual,
      images: gallery.map((url, i) => ({
        id: uid('img'),
        url,
        filename: `${p.slug}-${i + 1}.svg`,
        size: 42_000 + i * 3_100,
        uploadedAt: p.createdAt,
        primary: i === 0,
      })),
      variants: p.colors.map(() => ({
        id: uid('var'),
        name: 'Colour',
        options: p.colors.map((x) => x.label),
      })),
      seo: toSeo(p.name, p.blurb, p.slug, p.brand),
      createdAt: p.createdAt,
      updatedAt: p.createdAt,
    } satisfies AdminProduct;
  });
}

function buildCategories(): AdminCategory[] {
  return seedCategories.map((c, i) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    tagline: c.tagline,
    hidden: false,
    order: i,
    subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name, group: s.group })),
  }));
}

function buildCustomers(): AdminCustomer[] {
  return [
    {
      id: 'cus_1',
      name: 'Eriqk Okoro',
      email: 'eriqk@geezmart.shop',
      phone: '+234 800 000 0000',
      status: 'active',
      addresses: [
        { label: 'Home', line: '12 Admiralty Way, Lekki Phase 1', city: 'Lekki', state: 'Lagos' },
      ],
      createdAt: daysAgo(210),
      lastOrderAt: daysAgo(2),
      note: 'Prefers express delivery before 12pm.',
    },
    {
      id: 'cus_2',
      name: 'Chidi Anyanwu',
      email: 'chidi.anyanwu@gmail.com',
      phone: '+234 803 221 4477',
      status: 'active',
      addresses: [
        { label: 'Office', line: '14b Bourdillon Road', city: 'Ikoyi', state: 'Lagos' },
        { label: 'Home', line: '9 Gana Street, Wuse 1', city: 'Abuja', state: 'FCT' },
      ],
      createdAt: daysAgo(96),
      lastOrderAt: daysAgo(12),
      note: '',
    },
    {
      id: 'cus_3',
      name: 'Bolaji Adeyemi',
      email: 'bolaji.adeyemi@outlook.com',
      phone: '+234 706 552 1188',
      status: 'active',
      addresses: [{ label: 'Home', line: '22 Ozumba Mbadiwe Avenue', city: 'Victoria Island', state: 'Lagos' }],
      createdAt: daysAgo(41),
      lastOrderAt: daysAgo(30),
      note: 'Asked about gift wrapping for an anniversary.',
    },
    {
      id: 'cus_4',
      name: 'Sola Ogunleye',
      email: 'sola.ogunleye@yahoo.com',
      phone: '+234 812 440 9921',
      status: 'suspended',
      addresses: [{ label: 'Home', line: '5 Unity Crescent, Ikeja', city: 'Ikeja', state: 'Lagos' }],
      createdAt: daysAgo(150),
      lastOrderAt: daysAgo(61),
      note: 'Suspended after repeated failed delivery attempts.',
    },
  ];
}

function buildOrders(): AdminOrder[] {
  const base: AdminOrder[] = [
    {
      id: 'o-1001',
      reference: 'GZ-000001',
      customerId: 'cus_1',
      customerName: 'Eriqk Okoro',
      customerEmail: 'eriqk@geezmart.shop',
      customerPhone: '+234 800 000 0000',
      address: '12 Admiralty Way, Lekki Phase 1',
      city: 'Lekki',
      state: 'Lagos',
      lines: [
        { productId: 'g-001', name: 'Wireless Earbuds Pro', brand: 'Auralis', price: 42900, quantity: 1, variantLabel: 'Arctic White', visual: 'earbuds' },
        { productId: 'gr-003', name: "Men's Grooming Kit", brand: 'Geezmart Select', price: 58900, quantity: 1, variantLabel: 'Midnight Black', visual: 'kit' },
      ],
      subtotal: 101800,
      delivery: 3500,
      discount: 0,
      total: 105300,
      paymentMethod: 'card',
      paymentStatus: 'paid',
      couponCode: null,
      status: 'shipped',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
      timeline: [
        { status: 'pending', at: daysAgo(3) },
        { status: 'confirmed', at: daysAgo(3) },
        { status: 'processing', at: daysAgo(2) },
        { status: 'shipped', at: daysAgo(1) },
      ],
    },
    {
      id: 'o-1000',
      reference: 'GZ-000000',
      customerId: 'cus_1',
      customerName: 'Eriqk Okoro',
      customerEmail: 'eriqk@geezmart.shop',
      customerPhone: '+234 800 000 0000',
      address: '12 Admiralty Way, Lekki Phase 1',
      city: 'Lekki',
      state: 'Lagos',
      lines: [
        { productId: 'w-001', name: "Quarte Men's Watch", brand: 'Quarte', price: 89999, quantity: 1, variantLabel: 'Brushed Steel', visual: 'watch' },
      ],
      subtotal: 89999,
      delivery: 3500,
      discount: 0,
      total: 93499,
      paymentMethod: 'transfer',
      paymentStatus: 'paid',
      couponCode: null,
      status: 'delivered',
      createdAt: daysAgo(26),
      updatedAt: daysAgo(23),
      timeline: [
        { status: 'pending', at: daysAgo(26) },
        { status: 'confirmed', at: daysAgo(26) },
        { status: 'processing', at: daysAgo(25) },
        { status: 'shipped', at: daysAgo(24) },
        { status: 'out_for_delivery', at: daysAgo(23) },
        { status: 'delivered', at: daysAgo(23) },
      ],
    },
    {
      id: 'o-1002',
      reference: 'GZ-000002',
      customerId: 'cus_2',
      customerName: 'Chidi Anyanwu',
      customerEmail: 'chidi.anyanwu@gmail.com',
      customerPhone: '+234 803 221 4477',
      address: '9 Gana Street, Wuse 1',
      city: 'Abuja',
      state: 'FCT',
      lines: [
        { productId: 'fu-001', name: '3-Seater Couch', brand: 'Atelier Home', price: 685000, quantity: 1, variantLabel: 'Arctic White', visual: 'couch' },
      ],
      subtotal: 685000,
      delivery: 6000,
      discount: 0,
      total: 691000,
      paymentMethod: 'transfer',
      paymentStatus: 'paid',
      couponCode: 'GEEZ10',
      status: 'processing',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      timeline: [
        { status: 'pending', at: daysAgo(1) },
        { status: 'confirmed', at: daysAgo(1) },
        { status: 'processing', at: daysAgo(1) },
      ],
    },
    {
      id: 'o-1003',
      reference: 'GZ-000003',
      customerId: 'cus_3',
      customerName: 'Bolaji Adeyemi',
      customerEmail: 'bolaji.adeyemi@outlook.com',
      customerPhone: '+234 706 552 1188',
      address: '22 Ozumba Mbadiwe Avenue',
      city: 'Victoria Island',
      state: 'Lagos',
      lines: [
        { productId: 'ph-001', name: 'iPhone 15 Pro', brand: 'Apple', price: 1450000, quantity: 1, variantLabel: 'Brushed Steel', visual: 'phone' },
        { productId: 'a-002', name: 'Leather Weekender Bag', brand: 'Atelier Home', price: 148000, quantity: 1, variantLabel: 'Espresso', visual: 'bag' },
      ],
      subtotal: 1598000,
      delivery: 3500,
      discount: 159800,
      total: 1441700,
      paymentMethod: 'card',
      paymentStatus: 'paid',
      couponCode: 'GEEZ10',
      status: 'pending',
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
      timeline: [{ status: 'pending', at: daysAgo(0) }],
    },
  ];
  return base;
}

function buildBanners(): Banner[] {
  const mk = (
    id: string,
    headline: string,
    subheadline: string,
    eyebrow: string,
    visual: string,
    ctaText: string,
    ctaHref: string,
    order: number,
  ): Banner => ({
    id,
    headline,
    subheadline,
    eyebrow,
    visual,
    tint: '#cfd6df',
    ctaText,
    ctaHref,
    desktopImage: '',
    mobileImage: '',
    startDate: null,
    endDate: null,
    status: 'published',
    order,
  });

  return [
    mk('ban_1', "Premium Men's", 'Lifestyle & Gadgets', 'New Season', 'watch', 'Shop Now', '/shop', 0),
    mk('ban_2', 'Sound That', 'Fits Your Life', 'Audio', 'headphones', 'Explore Audio', '/shop?category=gadgets', 1),
    mk('ban_3', 'A Routine', 'Worth Keeping', 'Grooming', 'kit', 'Shop Grooming', '/shop?category=grooming', 2),
    mk('ban_4', 'Quiet Luxury,', 'At Home', 'Home', 'couch', 'Shop Furniture', '/shop?category=furniture', 3),
  ];
}

function buildHomepage(): HomepageSection[] {
  const sec = (
    id: string,
    type: HomepageSection['type'],
    order: number,
    title: string,
    kicker: string,
    collection: HomepageSection['collection'],
  ): HomepageSection => ({
    id,
    type,
    order,
    title,
    kicker,
    enabled: true,
    description: '',
    ctaText: 'View All',
    ctaHref: '/shop',
    collection,
    productIds: [],
  });

  return [
    sec('sec_hero', 'hero', 0, 'Hero Banner', '', 'featured'),
    sec('sec_categories', 'categories', 1, 'Shop by Category', 'Explore', 'featured'),
    sec('sec_featured', 'products', 2, 'Featured', 'Curated', 'featured'),
    sec('sec_new', 'products', 3, 'New Drops', 'Just In', 'newDrop'),
    sec('sec_trending', 'products', 4, 'Trending', 'Moving Fast', 'trending'),
    sec('sec_men', 'products', 5, "Men's Picks", 'For Him', 'menPick'),
    sec('sec_promo', 'promo', 6, 'GEEZMART Membership', 'Membership', 'featured'),
    sec('sec_trust', 'trust', 7, 'Why shop with GEEZMART', '', 'featured'),
  ];
}

function buildCoupons(): Coupon[] {
  return [
    {
      id: 'cpn_1',
      code: 'GEEZ10',
      type: 'percentage',
      value: 10,
      minOrder: 50000,
      maxDiscount: 100000,
      usageLimit: 500,
      usedCount: 132,
      expiresAt: new Date(Date.now() + 45 * 86_400_000).toISOString(),
      enabled: true,
      categoryIds: [],
      productIds: [],
      createdAt: daysAgo(60),
    },
    {
      id: 'cpn_2',
      code: 'FREESHIP',
      type: 'free_delivery',
      value: 0,
      minOrder: 25000,
      maxDiscount: null,
      usageLimit: 1000,
      usedCount: 84,
      expiresAt: new Date(Date.now() + 12 * 86_400_000).toISOString(),
      enabled: true,
      categoryIds: [],
      productIds: [],
      createdAt: daysAgo(30),
    },
    {
      id: 'cpn_3',
      code: 'WELCOME5K',
      type: 'fixed',
      value: 5000,
      minOrder: 120000,
      maxDiscount: null,
      usageLimit: 200,
      usedCount: 200,
      expiresAt: daysAgo(4),
      enabled: false,
      categoryIds: [],
      productIds: [],
      createdAt: daysAgo(120),
    },
  ];
}

function buildReviews(): Review[] {
  return [
    { id: 'rev_1', productId: 'w-001', productName: "Quarte Men's Watch", customerName: 'Chidi Anyanwu', rating: 5, body: 'Build quality is excellent and it arrived two days early. The strap already feels like it will age well.', status: 'approved', createdAt: daysAgo(6) },
    { id: 'rev_2', productId: 'g-001', productName: 'Wireless Earbuds Pro', customerName: 'Bolaji Adeyemi', rating: 4, body: 'Noise cancelling is great for the office. Bass could be a little deeper but overall very good.', status: 'approved', createdAt: daysAgo(11) },
    { id: 'rev_3', productId: 'gr-001', productName: "NIVEA Men's Cream", customerName: 'Sola Ogunleye', rating: 5, body: 'Absorbs fast, no greasy residue. Been using it every morning for a month.', status: 'pending', createdAt: daysAgo(2) },
    { id: 'rev_4', productId: 'ph-001', productName: 'iPhone 15 Pro', customerName: 'Eriqk Okoro', rating: 5, body: 'Sealed, boxed and the trade-in process was painless.', status: 'approved', createdAt: daysAgo(19) },
    { id: 'rev_5', productId: 'f-001', productName: "Men's Sneakers Runner", customerName: 'Chidi Anyanwu', rating: 3, body: 'Nice finish but sizing runs slightly small.', status: 'hidden', createdAt: daysAgo(28) },
  ];
}

function buildPages(): ContentPage[] {
  return [
    { id: 'pg_about', slug: 'about', title: 'About Us', body: 'GEEZMART is a premium marketplace for men who care how things look and how they work. We curate watches, audio, grooming, fashion and home so every purchase feels considered.', status: 'published', updatedAt: daysAgo(14) },
    { id: 'pg_shipping', slug: 'shipping', title: 'Shipping', body: 'Standard delivery takes 2-4 business days nationwide. Express delivery is available next working day in Lagos, Abuja and Port Harcourt.', status: 'published', updatedAt: daysAgo(30) },
    { id: 'pg_returns', slug: 'returns', title: 'Returns', body: 'Returns are accepted within 7 days of delivery on unworn, boxed items. Refunds are processed to the original payment method within 5 business days.', status: 'published', updatedAt: daysAgo(30) },
    { id: 'pg_privacy', slug: 'privacy', title: 'Privacy Policy', body: 'We collect only the information required to process orders and deliveries. Payment card details are never stored on our servers.', status: 'published', updatedAt: daysAgo(60) },
    { id: 'pg_terms', slug: 'terms', title: 'Terms & Conditions', body: 'By using GEEZMART you agree to these terms. All prices are shown in Nigerian Naira and include applicable taxes.', status: 'draft', updatedAt: daysAgo(60) },
    { id: 'pg_faq', slug: 'faq', title: 'FAQ', body: 'How long does delivery take? How do I track my order? Can I return an item? Find answers here.', status: 'published', updatedAt: daysAgo(9) },
  ];
}

function buildNotifications(): AdminNotification[] {
  return [
    { id: 'ntf_1', kind: 'order', title: 'New order GZ-000003', body: 'Bolaji Adeyemi placed an order worth N1,441,700.', createdAt: daysAgo(0), read: false, href: '/admin/orders/o-1003' },
    { id: 'ntf_2', kind: 'stock', title: 'Low stock: iPhone 15 Pro', body: '8 units left - below the threshold of 10.', createdAt: daysAgo(0), read: false, href: '/admin/inventory' },
    { id: 'ntf_3', kind: 'review', title: 'Review awaiting approval', body: 'NIVEA Men Cream has a new 5-star review.', createdAt: daysAgo(2), read: false, href: '/admin/reviews' },
    { id: 'ntf_4', kind: 'payment', title: 'Payment received', body: 'Transfer of N691,000 confirmed for GZ-000002.', createdAt: daysAgo(1), read: true, href: '/admin/orders/o-1002' },
    { id: 'ntf_5', kind: 'customer', title: 'New customer registered', body: 'Bolaji Adeyemi created an account.', createdAt: daysAgo(41), read: true, href: '/admin/customers/cus_3' },
  ];
}

function buildActivity(): ActivityLog[] {
  return [
    { id: 'act_1', adminId: 'adm_1', adminName: 'Eriqk Okoro', action: 'Product price changed', entity: 'Product', entityId: 'w-001', detail: "Quarte Men's Watch price updated", before: 'N84,999', after: 'N89,999', createdAt: daysAgo(2) },
    { id: 'act_2', adminId: 'adm_2', adminName: 'Ada Nwosu', action: 'Order status changed', entity: 'Order', entityId: 'o-1001', detail: 'GZ-000001 moved to Shipped', before: 'Processing', after: 'Shipped', createdAt: daysAgo(1) },
    { id: 'act_3', adminId: 'adm_1', adminName: 'Eriqk Okoro', action: 'Homepage updated', entity: 'Homepage', entityId: 'sec_trending', detail: 'Trending section title changed', before: 'Popular', after: 'Trending', createdAt: daysAgo(4) },
    { id: 'act_4', adminId: 'adm_1', adminName: 'Eriqk Okoro', action: 'Customer suspended', entity: 'Customer', entityId: 'cus_4', detail: 'Sola Ogunleye suspended after failed deliveries', createdAt: daysAgo(7) },
  ];
}

function buildMedia(products: AdminProduct[]): MediaItem[] {
  return products.flatMap((p) =>
    p.images.map((img) => ({
      ...img,
      kind: 'product' as const,
      width: 640,
      height: 652,
    })),
  );
}

/** Full demo database. */
export function buildSeed() {
  const products = buildProducts();
  return {
    version: 3 as const,
    admins: ADMIN_ACCOUNTS.map<AdminUser>((a) => ({ ...a, createdAt: daysAgo(400) })),
    products,
    categories: buildCategories(),
    customers: buildCustomers(),
    orders: buildOrders(),
    coupons: buildCoupons(),
    reviews: buildReviews(),
    pages: buildPages(),
    media: buildMedia(products),
    banners: buildBanners(),
    homepage: buildHomepage(),
    notifications: buildNotifications(),
    activity: buildActivity(),
    settings: DEFAULT_SETTINGS,
  };
}
