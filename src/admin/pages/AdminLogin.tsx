/** Admin sign-in. Passwords are verified against PBKDF2 hashes, never stored. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import Logo from '../../components/Logo';
import { useAdminAuth } from '../AdminContext';
import { lockoutRemaining, readSession } from '../auth';

export default function AdminLogin() {
  const { signIn, ready } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && readSession()) navigate('/admin', { replace: true });
  }, [ready, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await signIn(email, password, remember);
    setBusy(false);

    if (result.ok) {
      navigate('/admin', { replace: true });
      return;
    }
    if (result.reason === 'locked' || result.reason === 'rate') {
      const seconds = Math.ceil(lockoutRemaining(email) / 1000);
      setError(`Too many attempts. Try again in ${seconds}s.`);
      return;
    }
    setError('Invalid email or password.');
  };

  return (
    <div className="admin-login">
      <motion.form
        className="admin-login-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
          <Logo height={20} />
          <span className="admin-side-badge">ADMIN PORTAL</span>
        </div>

        <h1 className="admin-login-title" style={{ marginTop: 18 }}>
          Sign in
        </h1>
        <p className="admin-hint" style={{ marginTop: 4, marginBottom: 18 }}>
          GEEZMART control center. Staff accounts only.
        </p>

        <div className="stack" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              className="input-dark"
              type="email"
              autoComplete="username"
              required
              value={email}
              placeholder="admin@geezmart.ng"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="admin-password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-password"
                className="input-dark"
                style={{ paddingRight: 46 }}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                style={{ position: 'absolute', right: 5, top: 10, width: 28, height: 24 }}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'close' : 'user'} size={14} />
              </button>
            </div>
          </div>

          <label className="row" style={{ gap: 9, fontSize: 13, color: 'var(--text-2)' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#fff' }}
            />
            Keep me signed in on this device
          </label>

          {error ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="t-sm admin-alert"
              role="alert"
            >
              {error}
            </motion.p>
          ) : null}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
            {!busy ? <Icon name="arrowRight" size={17} /> : null}
          </button>
        </div>

        <div
          className="panel"
          style={{ marginTop: 18, padding: 12, background: 'rgba(255,255,255,0.03)' }}
        >
          <p className="admin-kicker" style={{ marginBottom: 8 }}>
            Staff accounts
          </p>
          <p className="admin-hint">
            Sign in with a Supabase Auth account that also has a staff row in <code>profiles</code>{' '}
            (role must not be <code>customer</code>). Non-staff accounts are rejected even when the
            password is correct.
          </p>
          <p className="admin-hint" style={{ marginTop: 8 }}>
            Roles and access rights are enforced by Postgres RLS, not by the UI.
          </p>
        </div>

        <p className="admin-hint" style={{ marginTop: 14, textAlign: 'center' }}>
          <a href="/" style={{ textDecoration: 'underline' }}>
            Back to storefront
          </a>
        </p>
      </motion.form>
    </div>
  );
}
