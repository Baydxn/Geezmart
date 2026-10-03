import type { Category } from '../types';

/**
 * Category tree. To add a category later: append one entry here — shortcuts,
 * the shop filter sheet, the categories page and search all read from this.
 */
export const categories: Category[] = [
  {
    id: 'watches',
    name: 'Watches',
    slug: 'watches',
    icon: 'watch',
    tagline: 'Precision on your wrist',
    subcategories: [
      { id: 'smartwatches', name: 'Smartwatches', group: 'Collections' },
      { id: 'luxury-watches', name: 'Luxury Watches', group: 'Collections' },
      { id: 'casual-watches', name: 'Casual Watches', group: 'Collections' },
      { id: 'mens-watches', name: "Men's Watches", group: 'Collections' },
      { id: 'watch-accessories', name: 'Watch Accessories', group: 'Extras' },
    ],
  },
  {
    id: 'gadgets',
    name: 'Gadgets',
    slug: 'gadgets',
    icon: 'headphones',
    tagline: 'Sound, light and smart tech',
    subcategories: [
      { id: 'earbuds', name: 'Earbuds', group: 'Audio' },
      { id: 'headphones', name: 'Headphones', group: 'Audio' },
      { id: 'speakers', name: 'Bluetooth Speakers', group: 'Audio' },
      { id: 'chargers', name: 'Chargers', group: 'Mobile Tech' },
      { id: 'power-banks', name: 'Power Banks', group: 'Mobile Tech' },
      { id: 'phone-holders', name: 'Phone Holders', group: 'Mobile Tech' },
      { id: 'smart-lights', name: 'Smart Lights', group: 'Smart Devices' },
      { id: 'smart-accessories', name: 'Smart Accessories', group: 'Smart Devices' },
    ],
  },
  {
    id: 'grooming',
    name: 'Grooming',
    slug: 'grooming',
    icon: 'grooming',
    tagline: 'Everyday care, elevated',
    subcategories: [
      { id: 'cream', name: 'Cream', group: 'Skin Care' },
      { id: 'roll-on', name: 'Roll-On', group: 'Skin Care' },
      { id: 'beard-care', name: 'Beard Care', group: 'Beard' },
      { id: 'shaving', name: 'Shaving', group: 'Shaving' },
      { id: 'hair-care', name: 'Hair Care', group: 'Hair' },
      { id: 'grooming-kits', name: 'Grooming Kits', group: 'Kits' },
    ],
  },
  {
    id: 'phones',
    name: 'Phones',
    slug: 'phones',
    icon: 'phone',
    tagline: 'Flagships and essentials',
    subcategories: [
      { id: 'iphone', name: 'iPhone', group: 'Brands' },
      { id: 'samsung', name: 'Samsung Galaxy', group: 'Brands' },
      { id: 'android', name: 'Android Phones', group: 'Brands' },
      { id: 'phone-accessories', name: 'Accessories', group: 'Add-ons' },
      { id: 'chargers', name: 'Chargers', group: 'Add-ons' },
      { id: 'cases', name: 'Cases', group: 'Add-ons' },
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion',
    slug: 'fashion',
    icon: 'shirt',
    tagline: 'Modern menswear staples',
    subcategories: [
      { id: 'sneakers', name: "Men's Sneakers", group: 'Footwear' },
      { id: 'polo-shirts', name: 'Polo Shirts', group: 'Tops' },
      { id: 'casual-wear', name: "Men's Casual Wear", group: 'Tops' },
      { id: 'jackets', name: 'Jackets', group: 'Outerwear' },
      { id: 'trousers', name: 'Trousers', group: 'Bottoms' },
    ],
  },
  {
    id: 'furniture',
    name: 'Furniture',
    slug: 'furniture',
    icon: 'sofa',
    tagline: 'Living, refined',
    subcategories: [
      { id: 'sofas', name: 'Sofas', group: 'Seating' },
      { id: 'couches', name: 'Couches', group: 'Seating' },
      { id: 'cabinets', name: 'Cabinets', group: 'Storage' },
      { id: 'tv-stands', name: 'TV Stands', group: 'Storage' },
      { id: 'tables', name: 'Tables', group: 'Surfaces' },
      { id: 'chairs', name: 'Chairs', group: 'Seating' },
    ],
  },
  {
    id: 'accessories',
    name: 'Accessories',
    slug: 'accessories',
    icon: 'sunglasses',
    tagline: 'Finishing touches',
    subcategories: [
      { id: 'sunglasses', name: 'Sunglasses', group: 'Eyes' },
      { id: 'wallets', name: 'Wallets', group: 'Carry' },
      { id: 'bags', name: 'Bags', group: 'Carry' },
      { id: 'belts', name: 'Belts', group: 'Carry' },
      { id: 'cufflinks', name: 'Cufflinks', group: 'Formal' },
    ],
  },
  {
    id: 'home',
    name: 'Home & Lifestyle',
    slug: 'home-lifestyle',
    icon: 'lamp',
    tagline: 'Quiet luxury at home',
    subcategories: [
      { id: 'lamps', name: 'Lamps', group: 'Lighting' },
      { id: 'decor', name: 'Decor', group: 'Accents' },
      { id: 'fragrance', name: 'Fragrance', group: 'Scents' },
      { id: 'kitchen', name: 'Kitchen', group: 'Living' },
    ],
  },
];

export const categoryById = new Map(categories.map((c) => [c.id, c]));

export function getCategory(id: string) {
  return categoryById.get(id as never);
}

/** Flat list of every leaf, tagged with its category — powers the shop filter sheet. */
export const allSubcategories = categories.flatMap((c) =>
  c.subcategories.map((s) => ({ ...s, categoryId: c.id })),
);