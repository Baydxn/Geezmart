import { Link } from 'react-router-dom';
import Icon, { type IconName } from './Icon';
import Logo from './Logo';
import { categories } from '../data/categories';

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Shop',
    links: [
      { label: 'All Products', to: '/shop' },
      { label: 'New Drops', to: '/shop?sort=newest' },
      { label: 'Trending', to: '/shop?sort=popular' },
      { label: "Men's Picks", to: '/shop?collection=menPick' },
      { label: 'Saved Items', to: '/wishlist' },
    ],
  },
  {
    title: 'Categories',
    links: categories.slice(0, 5).map((c) => ({ label: c.name, to: `/shop?category=${c.id}` })),
  },
  {
    title: 'Account',
    links: [
      { label: 'My Orders', to: '/orders' },
      { label: 'My Account', to: '/account' },
      { label: 'Cart', to: '/cart' },
      { label: 'Help & Support', to: '/account' },
      { label: 'Settings', to: '/account' },
    ],
  },
];

const SOCIALS: { name: string; icon: IconName }[] = [
  { name: 'Instagram', icon: 'camera' },
  { name: 'Twitter / X', icon: 'share' },
  { name: 'TikTok', icon: 'play' },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Logo height={20} />
          <p className="text-3 t-sm" style={{ marginTop: 12, maxWidth: '32ch' }}>
            Premium men&rsquo;s lifestyle, technology, fashion and home. Curated in Nigeria, delivered
            nationwide.
          </p>
          <div className="socials" style={{ marginTop: 16 }}>
            {SOCIALS.map((social) => (
              <a
                key={social.name}
                className="social-btn"
                href="#"
                aria-label={social.name}
                onClick={(e) => e.preventDefault()}
              >
                <Icon name={social.icon} size={16} />
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="footer-col-title">{column.title}</p>
            {column.links.map((link) => (
              <Link key={link.label} className="footer-link" to={link.to}>
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>

      <div className="footer-base">
        <span>&copy; {new Date().getFullYear()} GEEZMART. All rights reserved.</span>
        <span className="row" style={{ gap: 14 }}>
          <Link to="/account">Privacy</Link>
          <Link to="/account">Terms</Link>
          <span className="row" style={{ gap: 6 }}>
            <Icon name="shield" size={13} />
            Secure payments
          </span>
        </span>
      </div>
    </footer>
  );
}