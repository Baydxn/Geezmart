import { Link } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import { useWishlist } from '../store/WishlistContext';
import { useOrders } from '../store/OrdersContext';
import { useToast } from '../store/ToastContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authClient';

export default function Account() {
  const { items } = useWishlist();
  const { orders } = useOrders();
  const { notify } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();

  const { user, signIn, signUp, signOut, resetPassword } = useAuth();

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your email address first, then tap "Forgot password?".');
      return;
    }
    setResetting(true);
    setError(null);
    try {
      await resetPassword(email.trim());
      setNotice('Password recovery link sent. Check your email to reset your password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send recovery email.');
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        if (!name.trim()) { setError('Name is required.'); setBusy(false); return; }
        await signUp(name.trim(), email.trim(), password);
      }
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrapper" style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      {!user && (
        <div className="auth-card" style={{ padding: 24, borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>{isLogin ? 'Sign in' : 'Create account'}</h1>
            <button type="button" style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 13 }}
              onClick={() => { setIsLogin(prev => !prev); setError(null); }}>
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {!isLogin && (
              <input type="text" value={name} placeholder="Full name"
                style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}
                onChange={(e) => setName(e.target.value)} disabled={busy} autoComplete="name" />
            )}

            <input type="email" value={email} placeholder="Email address"
              style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}
              onChange={(e) => setEmail(e.target.value)} disabled={busy} autoComplete="email" />

            <input type="password" value={password} placeholder="Password"
              style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}
              onChange={(e) => setPassword(e.target.value)} disabled={busy}
              autoComplete={isLogin ? 'current-password' : 'new-password'} />

            {error && <p style={{ color: "var(--error)", fontSize: 13 }}>{error}</p>}
            {notice && <p style={{ color: "#0a7d33", fontSize: 13 }}>{notice}</p>}

            <button type="submit" style={{ padding: "12px", borderRadius: 6, background: "#222", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none" }}
              disabled={busy}>
              {busy ? 'Signing in...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {isLogin && (
            <p style={{ textAlign: "right", marginTop: 10 }}>
              <button type="button" onClick={handleReset} disabled={resetting}
                style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                {resetting ? 'Sending…' : 'Forgot password?'}
              </button>
            </p>
          )}
        </div>
      )}

      {user && (
        <>
          <div className="account-hero" style={{ marginTop: 24, textAlign: "center" }}>
            <span className="avatar" style={{ fontSize: 28 }}>
              {user.name?.[0] || 'U'}
            </span>
            <h2 style={{ fontSize: 19 }}>{user.name || 'Guest'}</h2>
            <p className="text-3 t-xs" style={{ color: "var(--text-2)" }}>
              {user.email}
            </p>
          </div>

          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <div className="summary" style={{ flex: 1 }}>
              <div className="summary-row">
                <span className="text-3 t-sm">My Orders</span>
                <strong>{orders.length}</strong>
              </div>
            </div>
            <div className="summary" style={{ flex: 1 }}>
              <div className="summary-row">
                <span className="text-3 t-sm">Saved</span>
                <strong>{items.length}</strong>
              </div>
            </div>
          </div>

          <div className="stack" style={{ gap: 10, marginTop: 18 }}>
            { [
              { label: 'My Orders', icon: 'orders' as IconName, to: '/orders' },
              { label: 'Saved Products', icon: 'heart' as IconName, to: '/wishlist' },
              { label: 'Addresses', icon: 'pin' as IconName },
              { label: 'Payment Methods', icon: 'card' as IconName },
              { label: 'Notifications', icon: 'bell' as IconName },
              { label: 'Help & Support', icon: 'help' as IconName },
              { label: 'Settings', icon: 'settings' as IconName },
            ].map((item) => {
              const inner = (
                <>
                  <span className="menu-icon"><Icon name={item.icon} size={18} /></span>
                  <span className="stack" style={{ gap: 2 }}>
                    <span className="semi t-md">{item.label}</span>
                    {item.to ? <span className="text-3 t-xs">view all</span> : null}
                  </span>
                  <span className="spacer" />
                  <Icon name="chevronRight" size={16} className="text-3" />
                </>
              );
              return item.to ? (
                <Link key={item.label} className="menu-card" to={item.to}>{inner}</Link>
              ) : (
                <button key={item.label} type="button" className="menu-card" onClick={() => notify('Coming soon')}>
                  {inner}
                </button>
              );
            })}

            <button
              type="button"
              className="menu-card"
              onClick={() => { signOut(); }}
            >
              <span className="menu-icon"><Icon name="logout" size={18} /></span>
              <span className="stack" style={{ gap: 2 }}>
                <span className="semi t-md">Sign Out</span>
                <span className="text-3 t-xs">Sign out of this device</span>
              </span>
              <span className="spacer" />
              <Icon name="chevronRight" size={16} className="text-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

