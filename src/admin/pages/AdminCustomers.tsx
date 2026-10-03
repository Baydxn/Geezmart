/** Customers list + profile. Passwords are never exposed. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { store } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmDialog, StatusPill, IntegrationNote } from '../components/ui';
import { formatMoney } from '../../data/dbHelpers';
import { STATUS_LABELS } from './AdminOrders';
import type { AdminCustomer } from '../../types/admin';

function customerStats(customerId: string) {
  const orders = store.read().orders.filter((o) => o.customerId === customerId && o.status !== 'cancelled');
  return {
    count: orders.length,
    spent: orders.reduce((sum, o) => sum + o.total, 0),
    last: orders.length ? orders.map((o) => o.createdAt).sort().at(-1) ?? null : null,
  };
}

export default function AdminCustomers() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const currency = db.settings.currencySymbol;
  const [status, setStatus] = useState('all');
  const [pendingDelete, setPendingDelete] = useState<AdminCustomer | null>(null);

  const rows = useMemo(
    () => db.customers.filter((c) => (status === 'all' ? true : c.status === status)),
    [db.customers, status],
  );

  const setCustomerStatus = (customer: AdminCustomer, next: 'active' | 'suspended') => {
    store.write('customers', (list) =>
      list.map((c) => (c.id === customer.id ? { ...c, status: next } : c)),
    );
    logActivity(
      {
        action: next === 'suspended' ? 'Customer suspended' : 'Customer reactivated',
        entity: 'Customer',
        entityId: customer.id,
        detail: `${customer.name} ${next === 'suspended' ? 'suspended' : 'reactivated'}`,
        before: customer.status,
        after: next,
      },
      user?.name,
      user?.id,
    );
  };

  const columns: Column<AdminCustomer>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (c) => (
        <div className="row" style={{ gap: 10 }}>
          <span className="avatar" style={{ width: 34, height: 34, flex: '0 0 34px', fontSize: 12 }}>
            {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="semi">{c.name}</p>
            <p className="admin-hint">{c.email}</p>
          </div>
        </div>
      ),
      mobile: true,
    },
    { key: 'phone', header: 'Phone', render: (c) => <span className="text-2">{c.phone}</span> },
    { key: 'orders', header: 'Orders', render: (c) => <span>{customerStats(c.id).count}</span> },
    { key: 'spent', header: 'Total spent', render: (c) => <span className="semi">{formatMoney(customerStats(c.id).spent, currency)}</span> },
    {
      key: 'joined',
      header: 'Joined',
      render: (c) => <span className="admin-hint">{new Date(c.createdAt).toLocaleDateString('en-NG')}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusPill label={c.status} tone={c.status === 'active' ? 'solid' : 'warn'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <span className="row-actions">
          <Link className="icon-btn icon-btn-sm" to={`/admin/customers/${c.id}`} aria-label={`View ${c.name}`}>
            <Icon name="search" size={14} />
          </Link>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => setCustomerStatus(c, c.status === 'active' ? 'suspended' : 'active')}
            aria-label={c.status === 'active' ? 'Suspend' : 'Reactivate'}
            title={c.status === 'active' ? 'Suspend account' : 'Reactivate account'}
          >
            <Icon name={c.status === 'active' ? 'close' : 'refresh'} size={14} />
          </button>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => setPendingDelete(c)} aria-label={`Delete ${c.name}`}>
            <Icon name="trash" size={14} />
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Audience</p>
          <h1 className="admin-page-title">Customers</h1>
        </div>
      </div>

      <div className="admin-toolbar">
        <select className="input-dark" style={{ width: 'auto', minWidth: 140 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All customers</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <DataTable rows={rows} columns={columns} pageSize={10} searchKeys={(c) => `${c.name} ${c.email} ${c.phone}`} searchPlaceholder="Search customers" />

      <div style={{ marginTop: 12 }}>
        <IntegrationNote>
          Passwords are never exposed to this screen. Authentication is handled by Supabase Auth (PBKDF2 on
          the server side); this control centre only manages profile and order data.
        </IntegrationNote>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete customer?"
        message={`All data for "${pendingDelete?.name}" will be removed. Order history is retained for accounting.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          store.write('customers', (list) => list.filter((c) => c.id !== pendingDelete.id));
          logActivity(
            { action: 'Customer deleted', entity: 'Customer', entityId: pendingDelete.id, detail: `${pendingDelete.name} deleted` },
            user?.name,
            user?.id,
          );
          setPendingDelete(null);
        }}
      />
    </>
  );
}

export function AdminCustomerDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  useDbVersion();
  const db = store.read();
  const currency = db.settings.currencySymbol;
  const customer = db.customers.find((c) => c.id === id);

  if (!customer) {
    return (
      <div className="admin-empty">
        <p className="semi" style={{ color: '#fff' }}>Customer not found</p>
        <Link className="btn btn-ghost btn-sm" to="/admin/customers">Back to customers</Link>
      </div>
    );
  }

  const orders = db.orders.filter((o) => o.customerId === customer.id);
  const stats = customerStats(customer.id);

  return (
    <>
      <div className="admin-toolbar">
        <button type="button" className="icon-btn icon-btn-sm" onClick={() => navigate('/admin/customers')} aria-label="Back">
          <Icon name="chevronLeft" size={16} />
        </button>
        <div>
          <p className="admin-kicker">Customer</p>
          <h1 className="admin-page-title">{customer.name}</h1>
        </div>
        <span className="spacer" />
        <StatusPill label={customer.status} tone={customer.status === 'active' ? 'solid' : 'warn'} />
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><span className="stat-label">Orders</span><span className="stat-value">{stats.count}</span></div>
        <div className="stat-card"><span className="stat-label">Total spent</span><span className="stat-value">{formatMoney(stats.spent, currency)}</span></div>
        <div className="stat-card"><span className="stat-label">Joined</span><span className="stat-value" style={{ fontSize: 15 }}>{new Date(customer.createdAt).toLocaleDateString('en-NG')}</span></div>
      </div>

      <div className="admin-grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Personal information</span></div>
          <div className="panel-body stack" style={{ gap: 10 }}>
            <div className="list-row"><Icon name="user" size={15} /><div><p className="t-sm semi">{customer.name}</p></div></div>
            <div className="list-row"><Icon name="orders" size={15} /><div><p className="t-sm semi">{customer.email}</p></div></div>
            <div className="list-row"><Icon name="phone" size={15} /><div><p className="t-sm semi">{customer.phone}</p></div></div>
            {customer.addresses.map((address) => (
              <div className="list-row" key={address.label}>
                <Icon name="pin" size={15} />
                <div><p className="t-sm semi">{address.label}</p><p className="admin-hint">{address.line}, {address.city}, {address.state}</p></div>
              </div>
            ))}
            {customer.note ? <div className="list-row"><Icon name="help" size={15} /><div><p className="t-sm semi">Note</p><p className="admin-hint">{customer.note}</p></div></div> : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="panel-title">Order history</span></div>
          <div className="panel-body stack" style={{ gap: 10 }}>
            {orders.length ? (
              orders.map((order) => (
                <Link key={order.id} to={`/admin/orders/${order.id}`} className="list-row">
                  <div><p className="t-sm semi">#{order.reference}</p><p className="admin-hint">{new Date(order.createdAt).toLocaleDateString('en-NG')}</p></div>
                  <span className="spacer" />
                  <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <span className="t-sm semi">{formatMoney(order.total, currency)}</span>
                    <StatusPill label={STATUS_LABELS[order.status]} />
                  </div>
                </Link>
              ))
            ) : (
              <p className="admin-hint">No orders yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
