-- =============================================================================
-- GEEZMART — seed data (safe to re-run; all inserts are idempotent)
-- Run AFTER the migrations. Creates the settings, menus, shipping zones,
-- categories, brands, products and homepage sections.
-- =============================================================================

-- Store settings -----------------------------------------------------------------
insert into public.store_settings (key, value, group_name, label) values
  ('store_name',            '"GEEZMART"',                                  'general',  'Store name'),
  ('store_tagline',         '"Premium men''s lifestyle, technology and home marketplace."', 'general', 'Tagline'),
  ('store_description',     '"GEEZMART is a premium marketplace for men."',   'general',  'Description'),
  ('currency',              '"NGN"',                                        'general',  'Currency'),
  ('currency_symbol',       '"₦"',                                          'general',  'Currency symbol'),
  ('contact_email',         '"support@geezmart.com"',                      'contact',  'Contact email'),
  ('contact_phone',         '"+234 800 000 0000"',                          'contact',  'Phone'),
  ('whatsapp',              '"+2348000000000"',                             'contact',  'WhatsApp'),
  ('business_address',      '"Lagos, Nigeria"',                             'contact',  'Business address'),
  ('instagram',             '"https://instagram.com/geezmart"',             'social',   'Instagram'),
  ('twitter',               '"https://x.com/geezmart"',                    'social',   'X / Twitter'),
  ('facebook',              '"https://facebook.com/geezmart"',             'social',   'Facebook'),
  ('youtube',               '"https://youtube.com/@geezmart"',             'social',   'YouTube'),
  ('free_delivery_over',    '250000',                                       'shipping', 'Free delivery over (₦)'),
  ('default_delivery_fee',  '3500',                                         'shipping', 'Default delivery fee (₦)'),
  ('tax_rate',              '0',                                            'general',  'Tax rate'),
  ('allow_guest_checkout',  'true',                                         'general',  'Allow guest checkout'),
  ('abandoned_cart_alert_threshold', '100000',                               'ops',      'Alert when abandoned cart exceeds (₦)'),
  ('admin_login_notifications','true',                                      'ops',      'Email me about new orders')
on conflict (key) do nothing;

-- Categories ---------------------------------------------------------------------
insert into public.categories (name, slug, icon, tagline, description, hidden, sort_order) values
  ('Watches', 'watches', 'watch', 'Precision on your wrist', 'Luxury and casual timepieces', false, 1),
  ('Gadgets', 'gadgets', 'headphones', 'Sound, light and smart tech', 'Audio and mobile tech', false, 2),
  ('Grooming', 'grooming', 'grooming', 'Everyday care, elevated', 'Skin care and beard care', false, 3),
  ('Phones', 'phones', 'phone', 'Flagships and essentials', 'Smartphones and accessories', false, 4),
  ('Fashion', 'fashion', 'shirt', 'Modern menswear staples', 'Sneakers and apparel', false, 5),
  ('Furniture', 'furniture', 'sofa', 'Living, refined', 'Sofas and tables', false, 6),
  ('Accessories', 'accessories', 'sunglasses', 'Finishing touches', 'Sunglasses and wallets', false, 7),
  ('Home & Lifestyle', 'home-lifestyle', 'lamp', 'Quiet luxury at home', 'Lighting and decor', false, 8)
on conflict (slug) do update set name = excluded.name, tagline = excluded.tagline;

-- Brands -------------------------------------------------------------------------
insert into public.brands (name, slug) values
  ('Quarte', 'quarte'),
  ('Geezmart Labs', 'geezmart-labs'),
  ('Northline', 'northline'),
  ('Aura Audio', 'aura-audio'),
  ('Zenith', 'zenith')
on conflict (name) do nothing;

-- Sample Products ----------------------------------------------------------------
insert into public.products (
  name, slug, sku, brand_id, category_id, short_description, description,
  price, compare_at_price, status, featured, trending, is_new_drop, rating_avg, rating_count
)
select
  'Quarte Men''s Watch', 'quarte-mens-watch', 'Q-WATCH-001', b.id, c.id,
  'Luxury | Waterproof', 'A statement timepiece built for the modern man. Solid brushed steel case and 100m water resistance.',
  89999, 129999, 'published', true, true, false, 4.9, 412
from public.brands b, public.categories c
where b.slug = 'quarte' and c.slug = 'watches'
on conflict (slug) do nothing;

insert into public.products (
  name, slug, sku, brand_id, category_id, short_description, description,
  price, compare_at_price, status, featured, trending, is_new_drop, rating_avg, rating_count
)
select
  'Smartwatch Series X', 'smartwatch-series-x', 'GZ-SMART-002', b.id, c.id,
  'AMOLED | 14-Day Battery', 'Always-on AMOLED display, heart-rate and SpO2 tracking in a 42mm titanium-look case.',
  74500, 92000, 'published', true, true, true, 4.7, 631
from public.brands b, public.categories c
where b.slug = 'geezmart-labs' and c.slug = 'watches'
on conflict (slug) do nothing;

insert into public.products (
  name, slug, sku, brand_id, category_id, short_description, description,
  price, compare_at_price, status, featured, trending, is_new_drop, rating_avg, rating_count
)
select
  'Wireless Earbuds Pro', 'wireless-earbuds-pro', 'AURA-EAR-003', b.id, c.id,
  'Active Noise Cancelling | Hi-Res Sound', 'Studio-grade audio with hybrid active noise cancellation and 30-hour battery life.',
  45000, 59999, 'published', true, true, true, 4.8, 518
from public.brands b, public.categories c
where b.slug = 'aura-audio' and c.slug = 'gadgets'
on conflict (slug) do nothing;

-- Payment methods ----------------------------------------------------------------
insert into public.payment_methods (kind, label, description, icon, sort_order) values
  ('card',            'Card',              'Visa, Mastercard, Verve',            'card',   1),
  ('bank_transfer',   'Bank Transfer',     'Transfer to our verified account',  'bank',   2),
  ('ussd',            'USSD',              'Dial *901# to pay',                 'phone',  3),
  ('cash_on_delivery','Cash on Delivery',  'Pay the courier on arrival',        'cash',   4)
on conflict (kind) do update set label = excluded.label, description = excluded.description;

-- Shipping zones -----------------------------------------------------------------
insert into public.shipping_zones (name, kind, states, fee, free_over, eta_min_days, eta_max_days, sort_order) values
  ('Lagos',        'home_delivery', '{Lagos}',                                      3500, 250000, 1, 2, 1),
  ('Other States', 'home_delivery', '{Abuja,FCT,Abuja,Kano,Rivers,Ogun,Aba,Enugu,Kaduna}', 6000, 500000, 2, 4, 2),
  ('Pickup',       'pickup',        '{Lagos}',                                         0, null, 0, 1, 3)
on conflict (name) do update set fee = excluded.fee, eta_min_days = excluded.eta_min_days;

-- Homepage sections --------------------------------------------------------------
insert into public.homepage_sections (key, label, title, subtitle, cta_text, cta_href, sort_order) values
  ('hero',        'Hero Banner',      'Premium Men''s Lifestyle & Gadgets', 'Quality products. Modern living.',            'Shop Now',   '/shop',     1),
  ('categories',  'Category Shortcuts','Shop by category',                     'Everything curated for the modern man.',       'Explore',    '/categories', 2),
  ('featured',    'Featured',          'FEATURED',                             'Hand-picked by our curators.',                'View All',   '/shop',     3),
  ('new_drops',   'New Drops',         'NEW DROPS',                            'Fresh arrivals, just landed.',                 'View All',   '/shop',     4),
  ('trending',    'Trending',          'TRENDING',                             'What everyone is buying right now.',          'View All',   '/shop',     5),
  ('mens_picks',  'Men''s Picks',      'MEN''S PICKS',                        'Edits built for him.',                         'View All',   '/shop',     6),
  ('promotion',   'Promotions',        'MEMBERS ONLY',                         'Early access to every drop.',                 'Join Now',   '/account',  7)
on conflict (key) do update set label = excluded.label, title = excluded.title, sort_order = excluded.sort_order;

-- Navigation ---------------------------------------------------------------------
insert into public.navigation_items (location, label, href, icon, sort_order, system_route) values
  ('bottom', 'Home',       '/',          'home',  1, true),
  ('bottom', 'Shop',       '/shop',      'shop',  2, true),
  ('bottom', 'Categories', '/categories','grid',  3, true),
  ('bottom', 'Orders',     '/orders',    'orders',4, true),
  ('bottom', 'Account',    '/account',   'user',  5, true),
  ('header', 'Home',       '/',          'home',  1, true),
  ('header', 'Shop',       '/shop',      'shop',  2, false),
  ('header', 'Categories', '/categories','grid',  3, false),
  ('header', 'Orders',     '/orders',    'orders',4, false),
  ('header', 'Account',    '/account',   'user',  5, false),
  ('footer', 'About Us',   '/pages/about',        'info',  1, false),
  ('footer', 'Shipping',   '/pages/shipping',    'truck', 2, false),
  ('footer', 'Returns',    '/pages/returns',     'return',3, false),
  ('footer', 'FAQ',        '/pages/faq',         'help',  4, false),
  ('footer', 'Contact',    '/pages/contact',     'mail',  5, false)
on conflict do nothing;

-- Legal / content pages -----------------------------------------------------------
insert into public.pages (title, slug, excerpt, body, published, sort_order) values
  ('About Us', 'about', 'Who GEEZMART is.',
   '<h2>Premium men''s lifestyle, curated.</h2><p>GEEZMART is a marketplace for the modern Nigerian man — technology, grooming, fashion and home, chosen for quality rather than volume.</p>',
   true, 1),
  ('Shipping', 'shipping', 'How and when we deliver.',
   '<h2>Delivery</h2><p>Lagos deliveries arrive in 1–2 days. Other states take 2–4 days. Free delivery on orders over ₦250,000.</p>',
   true, 2),
  ('Returns', 'returns', 'Our returns policy.',
   '<h2>Returns</h2><p>Changed your mind? You have 7 days from delivery to request a return on unused items in original packaging.</p>',
   true, 3),
  ('Privacy Policy', 'privacy', 'How we handle your data.', '', false, 4),
  ('Terms & Conditions', 'terms', 'The terms of shopping with us.', '', false, 5),
  ('FAQ', 'faq', 'Common questions.', '', true, 6),
  ('Contact', 'contact', 'Talk to us.', '', true, 7)
on conflict (slug) do nothing;
