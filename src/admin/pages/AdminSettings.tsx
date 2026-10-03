/** Store, shipping, payment, notification, security, navigation and Supabase settings. */
import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { store } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { StatusPill, Switch, IntegrationNote } from '../components/ui';
import {
  SUPABASE_SCHEMA_SQL,
  checkSupabaseConnection,
  isSupabaseConfigured,
  type ConnectionReport,
} from '../../lib/supabase';

type Tab = 'store' | 'shipping' | 'payments' | 'notifications' | 'navigation' | 'security' | 'backend';

const TABS: { key: Tab; label: string }[] = [
  { key: 'store', label: 'Store' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'payments', label: 'Payments' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'navigation', label: 'Navigation' },
  { key: 'security', label: 'Security' },
  { key: 'backend', label: 'Backend' },
];

export default function AdminSettings() {
  useDbVersion();
  const { user, can } = useAdminAuth();
  const [settings, setSettings] = useState(() => store.read().settings);
  const [tab, setTab] = useState<Tab>('store');
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [checking, setChecking] = useState(false);
  const currency = settings.currencySymbol;

  useEffect(() => {
    setSettings(store.read().settings);
  });

  const runCheck = async () => {
    setChecking(true);
    setReport(await checkSupabaseConnection());
    setChecking(false);
  };

  const patch = (next: Partial<typeof settings>, detail: string) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    store.patch({ settings: merged });
    logActivity({ action: 'Settings changed', entity: 'Settings', entityId: tab, detail }, user?.name, user?.id);
  };

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Configuration</p>
          <h1 className="admin-page-title">Settings</h1>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16, maxWidth: 720, overflowX: 'auto' }}>
        {TABS.map((item) => (
          <button key={item.key} type="button" className="tab" data-active={tab === item.key} onClick={() => setTab(item.key)}>
            {tab === item.key ? <span className="tab-bubble" /> : null}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {tab === 'store' ? (
        <div className="stack" style={{ gap: 14 }}>
          <div className="form-section">
            <p className="form-section-title">Store identity</p>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="s-name">Store name</label>
                <input id="s-name" className="input-dark" value={settings.storeName} onChange={(e) => patch({ storeName: e.target.value }, 'Store name updated')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-email">Contact email</label>
                <input id="s-email" className="input-dark" value={settings.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value }, 'Contact email updated')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-phone">Phone</label>
                <input id="s-phone" className="input-dark" value={settings.phone} onChange={(e) => patch({ phone: e.target.value }, 'Phone updated')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-wa">WhatsApp</label>
                <input id="s-wa" className="input-dark" value={settings.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value }, 'WhatsApp updated')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-addr">Business address</label>
                <input id="s-addr" className="input-dark" value={settings.address} onChange={(e) => patch({ address: e.target.value }, 'Address updated')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-logo">Logo URL</label>
                <input id="s-logo" className="input-dark" placeholder="Optional; the bubble wordmark is built in" value={settings.logoUrl} onChange={(e) => patch({ logoUrl: e.target.value }, 'Logo updated')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-fav">Favicon URL</label>
                <input id="s-fav" className="input-dark" value={settings.faviconUrl} onChange={(e) => patch({ faviconUrl: e.target.value }, 'Favicon updated')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-code">Currency code</label>
                <input id="s-code" className="input-dark" value={settings.currencyCode} onChange={(e) => patch({ currencyCode: e.target.value.toUpperCase() }, 'Currency code updated')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="s-sym">Currency symbol</label>
                <input id="s-sym" className="input-dark" value={settings.currencySymbol} onChange={(e) => patch({ currencySymbol: e.target.value }, 'Currency symbol updated')} />
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="s-desc">Store description</label>
              <textarea id="s-desc" className="input-dark" value={settings.storeDescription} onChange={(e) => patch({ storeDescription: e.target.value }, 'Store description updated')} />
            </div>
          </div>

          <div className="form-section">
            <p className="form-section-title">Social links</p>
            <div className="stack" style={{ gap: 10 }}>
              {settings.socials.map((social, i) => (
                <div className="row" key={social.platform} style={{ gap: 8 }}>
                  <input
                    className="input-dark"
                    style={{ width: 140 }}
                    value={social.platform}
                    aria-label="Platform"
                    onChange={(e) => patch({ socials: settings.socials.map((s, j) => (j === i ? { ...s, platform: e.target.value } : s)) }, 'Social platform updated')}
                  />
                  <input
                    className="input-dark"
                    value={social.url}
                    aria-label={`${social.platform} URL`}
                    onChange={(e) => patch({ socials: settings.socials.map((s, j) => (j === i ? { ...s, url: e.target.value } : s)) }, 'Social URL updated')}
                  />
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    aria-label={`Remove ${social.platform}`}
                    onClick={() => patch({ socials: settings.socials.filter((_, j) => j !== i) }, 'Social link removed')}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => patch({ socials: [...settings.socials, { platform: 'Platform', url: '' }] }, 'Social link added')}
              >
                <Icon name="plus" size={14} />
                Add platform
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'shipping' ? (
        <div className="form-section">
          <p className="form-section-title">Delivery zones</p>
          <div className="stack" style={{ gap: 10 }}>
            {settings.shippingZones.map((zone) => (
              <div key={zone.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                <input
                  className="input-dark"
                  style={{ width: 160 }}
                  value={zone.name}
                  aria-label="Zone name"
                  onChange={(e) => patch({ shippingZones: settings.shippingZones.map((z) => (z.id === zone.id ? { ...z, name: e.target.value } : z)) }, 'Shipping zone updated')}
                />
                <input
                  className="input-dark"
                  style={{ width: 130 }}
                  type="number"
                  value={zone.fee}
                  aria-label="Fee"
                  onChange={(e) => patch({ shippingZones: settings.shippingZones.map((z) => (z.id === zone.id ? { ...z, fee: Number(e.target.value) } : z)) }, 'Shipping fee updated')}
                />
                <input
                  className="input-dark"
                  style={{ width: 180 }}
                  value={zone.eta}
                  aria-label="Delivery estimate"
                  onChange={(e) => patch({ shippingZones: settings.shippingZones.map((z) => (z.id === zone.id ? { ...z, eta: e.target.value } : z)) }, 'Delivery estimate updated')}
                />
                <span className="spacer" />
                <Switch
                  checked={zone.enabled}
                  label={`Enable ${zone.name}`}
                  onChange={(next) => patch({ shippingZones: settings.shippingZones.map((z) => (z.id === zone.id ? { ...z, enabled: next } : z)) }, 'Zone toggled')}
                />
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => patch({ shippingZones: [...settings.shippingZones, { id: `zone_${Date.now()}`, name: 'New zone', fee: 0, eta: '2-4 days', enabled: true }] }, 'Zone added')}
            >
              <Icon name="plus" size={14} />
              Add zone
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'payments' ? (
        <div className="stack" style={{ gap: 14 }}>
          <div className="form-section">
            <p className="form-section-title">Payment methods</p>
            <div className="stack" style={{ gap: 10 }}>
              {settings.paymentMethods.map((method) => (
                <div key={method.id} className="list-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="t-sm semi">{method.name}</p>
                    <p className="admin-hint">{method.detail}</p>
                    <p className="admin-hint">
                      Secret key reference: <code>{method.envKey}</code> (stored in the server environment)
                    </p>
                  </div>
                  <Switch
                    checked={method.enabled}
                    label={`Enable ${method.name}`}
                    onChange={(next) => patch({ paymentMethods: settings.paymentMethods.map((m) => (m.id === method.id ? { ...m, enabled: next } : m)) }, 'Payment method toggled')}
                  />
                </div>
              ))}
            </div>
            <IntegrationNote>
              Secret provider keys are never stored or displayed in the frontend. Set them as Cloudflare
              secrets (Settings → Environment variables → encrypt) and read them from a Pages Function.
            </IntegrationNote>
          </div>
        </div>
      ) : null}

      {tab === 'notifications' ? (
        <div className="form-section">
          <p className="form-section-title">Notification preferences</p>
          <div className="stack" style={{ gap: 12 }}>
            {(Object.keys(settings.notificationPrefs) as (keyof typeof settings.notificationPrefs)[]).map((key) => (
              <div className="row" key={key} style={{ justifyContent: 'space-between' }}>
                <span className="t-sm semi">{key.replace(/([A-Z])/g, ' $1')}</span>
                <Switch
                  checked={settings.notificationPrefs[key]}
                  label={key}
                  onChange={(next) => patch({ notificationPrefs: { ...settings.notificationPrefs, [key]: next } }, 'Notification preference updated')}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'navigation' ? (
        <div className="form-section">
          <p className="form-section-title">Admin navigation</p>
          <p className="admin-hint">Rename, hide or reorder the control-centre menu. System routes cannot be deleted.</p>
          <div className="stack" style={{ gap: 8 }}>
            {settings.adminNav.map((item, index) => (
              <div className="list-row" key={item.id}>
                <input
                  className="input-dark"
                  style={{ width: 150 }}
                  value={item.label}
                  aria-label="Menu label"
                  onChange={(e) => patch({ adminNav: settings.adminNav.map((n) => (n.id === item.id ? { ...n, label: e.target.value } : n)) }, 'Nav label updated')}
                />
                <span className="admin-hint" style={{ flex: 1 }}>{item.href}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() => {
                    const nav = [...settings.adminNav];
                    if (index === 0) return;
                    [nav[index - 1], nav[index]] = [nav[index], nav[index - 1]];
                    patch({ adminNav: nav }, 'Nav reordered');
                  }}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <Icon name="chevronLeft" size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() => {
                    const nav = [...settings.adminNav];
                    if (index === nav.length - 1) return;
                    [nav[index + 1], nav[index]] = [nav[index], nav[index + 1]];
                    patch({ adminNav: nav }, 'Nav reordered');
                  }}
                  disabled={index === settings.adminNav.length - 1}
                  aria-label="Move down"
                >
                  <Icon name="chevronRight" size={14} />
                </button>
                <Switch checked={!item.hidden} label={`Show ${item.label}`} onChange={(next) => patch({ adminNav: settings.adminNav.map((n) => (n.id === item.id ? { ...n, hidden: !next } : n)) }, 'Nav visibility updated')} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="stack" style={{ gap: 14 }}>
          <div className="form-section">
            <p className="form-section-title">Session & access</p>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="sec-timeout">Session timeout (minutes)</label>
                <input
                  id="sec-timeout"
                  className="input-dark"
                  type="number"
                  value={settings.security.sessionTimeoutMinutes}
                  onChange={(e) => patch({ security: { ...settings.security, sessionTimeoutMinutes: Number(e.target.value) } }, 'Session timeout updated')}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="sec-attempts">Max login attempts</label>
                <input
                  id="sec-attempts"
                  className="input-dark"
                  type="number"
                  value={settings.security.loginMaxAttempts}
                  onChange={(e) => patch({ security: { ...settings.security, loginMaxAttempts: Number(e.target.value) } }, 'Login attempt limit updated')}
                />
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-sm semi">Require two-factor (Supabase)</span>
              <Switch
                checked={settings.security.twoFactor}
                label="Two factor"
                onChange={(next) => patch({ security: { ...settings.security, twoFactor: next } }, '2FA preference updated')}
              />
            </div>
          </div>

          <div className="form-section">
            <p className="form-section-title">Admin accounts</p>
            <div className="stack" style={{ gap: 8 }}>
              {store.read().admins.map((admin) => (
                <div className="list-row" key={admin.id}>
                  <span className="avatar" style={{ width: 32, height: 32, flex: '0 0 32px', fontSize: 12 }}>
                    {admin.avatarInitials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="t-sm semi">{admin.name}</p>
                    <p className="admin-hint">{admin.email}</p>
                  </div>
                  <span className="spacer" />
                  <StatusPill label={admin.role.replace('_', ' ')} tone={can('products') ? 'solid' : 'quiet'} />
                </div>
              ))}
            </div>
            <IntegrationNote>
              Passwords are stored as PBKDF2-SHA256 hashes with per-user salts and are never displayed or
              editable here. Manage credentials through Supabase Auth.
            </IntegrationNote>
          </div>
        </div>
      ) : null}

      {tab === 'backend' ? (
        <div className="stack" style={{ gap: 14 }}>
          <div className="form-section">
            <p className="form-section-title">Supabase connection</p>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <StatusPill
                label={report?.reachable ? 'connected' : report?.configured ? 'unreachable' : 'not configured'}
                tone={report?.reachable ? 'solid' : 'warn'}
              />
              <span className="admin-hint">{report?.url || 'No NEXT_PUBLIC_SUPABASE_URL set'}</span>
              <span className="spacer" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={runCheck} disabled={checking}>
                <Icon name="refresh" size={14} />
                {checking ? 'Testing...' : 'Test connection'}
              </button>
            </div>
            <p className="admin-hint" style={{ marginTop: 8 }}>{report?.message ?? 'Run a connection test to verify the project.'}</p>
            {report?.latencyMs !== null && report?.latencyMs !== undefined ? (
              <p className="admin-hint">Round trip: {report.latencyMs}ms · key {report.anonKeyPreview}</p>
            ) : null}
            <IntegrationNote>
              Both the storefront and this control centre use the same Supabase project. The build works with
              or without it — without credentials the local control plane keeps every screen functional.
            </IntegrationNote>
          </div>

          <div className="form-section">
            <p className="form-section-title">Schema bootstrap</p>
            <p className="admin-hint">Run this once in the Supabase SQL editor to create the tables and RLS policies.</p>
            <pre
              style={{
                maxHeight: 320,
                overflow: 'auto',
                fontSize: 11.5,
                background: '#0b0c0d',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: 14,
              }}
            >
              {SUPABASE_SCHEMA_SQL}
            </pre>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(SUPABASE_SCHEMA_SQL);
              }}
            >
              <Icon name="share" size={14} />
              Copy SQL
            </button>
          </div>

          <div className="form-section">
            <p className="form-section-title">Danger zone</p>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p className="t-sm semi">Reset demo data</p>
                <p className="admin-hint">Restores products, orders, banners and settings to the seeded state.</p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  store.reset();
                  window.location.reload();
                }}
              >
                <Icon name="refresh" size={14} />
                Reset store data
              </button>
            </div>
            {!isSupabaseConfigured ? (
              <p className="admin-hint">Supabase env vars are missing — currently running in local mode.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="admin-hint" style={{ marginTop: 14 }}>
        Prices shown in the control centre use {currency} ({settings.currencyCode}).
      </p>
    </>
  );
}
