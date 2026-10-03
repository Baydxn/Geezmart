import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

export default function NotFound() {
  return (
    <div className="empty" style={{ paddingTop: 60 }}>
      <div className="empty-orb" style={{ width: 130, height: 130 }}>
        <Icon name="sparkle" size={44} />
      </div>
      <h1 style={{ fontSize: 28 }}>Page not found</h1>
      <p className="text-3 t-md">The page you are looking for has moved or never existed.</p>
      <Link className="btn btn-primary btn-md" to="/">
        Back to Home
        <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}