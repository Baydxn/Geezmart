/** Admin activity log: who changed what, with before/after values. */
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { store } from '../../lib/db';
import { useDbVersion } from '../AdminContext';
import { StatusPill } from '../components/ui';
import { relativeTime } from '../../data/dbHelpers';

export default function AdminActivity() {
  useDbVersion();
  const db = store.read();
  const [entity, setEntity] = useState('all');

  const rows = useMemo(
    () => db.activity.filter((entry) => (entity === 'all' ? true : entry.entity === entity)),
    [db.activity, entity],
  );

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Audit trail</p>
          <h1 className="admin-page-title">Activity</h1>
        </div>
        <span className="spacer" />
        <select className="input-dark" style={{ width: 'auto', minWidth: 150 }} value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filter activity">
          <option value="all">All activity</option>
          {[...new Set(db.activity.map((a) => a.entity))].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {rows.map((entry) => (
          <div key={entry.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <Icon name="clock" size={15} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="t-sm semi clamp-2">{entry.detail}</p>
              <p className="admin-hint">
                {entry.adminName} · {entry.action} · {relativeTime(entry.createdAt)}
              </p>
              {entry.before && entry.after ? (
                <p className="admin-hint" style={{ marginTop: 4 }}>
                  {entry.entity}: {entry.before} → <strong>{entry.after}</strong>
                </p>
              ) : null}
            </div>
            <StatusPill label={entry.entity} tone="quiet" />
          </div>
        ))}
        {!rows.length ? <p className="admin-hint">No activity recorded yet.</p> : null}
      </div>
    </>
  );
}
