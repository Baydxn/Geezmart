/** Review moderation. Only approved reviews appear on the storefront. */
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { StarIcon } from '../../components/Icon';
import { store } from '../../lib/db';
import { useAdminAuth, useDbVersion, logActivity } from '../AdminContext';
import { ConfirmDialog, StatusPill } from '../components/ui';
import type { Review } from '../../types/admin';

export default function AdminReviews() {
  useDbVersion();
  const { user } = useAdminAuth();
  const db = store.read();
  const [status, setStatus] = useState('all');
  const [deleting, setDeleting] = useState<Review | null>(null);

  const rows = useMemo(
    () => db.reviews.filter((r) => (status === 'all' ? true : r.status === status)),
    [db.reviews, status],
  );

  const setReviewStatus = (review: Review, next: Review['status']) => {
    store.write('reviews', (list) => list.map((r) => (r.id === review.id ? { ...r, status: next } : r)));
    logActivity(
      {
        action: 'Review moderated',
        entity: 'Review',
        entityId: review.id,
        detail: `Review on ${review.productName} set to ${next}`,
        before: review.status,
        after: next,
      },
      user?.name,
      user?.id,
    );
  };

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Moderation</p>
          <h1 className="admin-page-title">Reviews</h1>
        </div>
      </div>

      <div className="admin-toolbar">
        <select className="input-dark" style={{ width: 'auto', minWidth: 150 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter reviews">
          <option value="all">All reviews</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="hidden">Hidden</option>
        </select>
        <span className="spacer" />
        <button
          type="button"
          className="tool-btn"
          onClick={() =>
            setReviewStatus(
              { id: 'new', productId: '', productName: 'Demo product', customerName: 'Test Customer', rating: 5, body: 'Sample review for moderation testing.', status: 'pending', createdAt: new Date().toISOString() },
              'pending',
            )
          }
          title="Adds a sample pending review"
        >
          <Icon name="plus" size={14} />
          Sample review
        </button>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {rows.map((review) => (
          <div key={review.id} className="panel" style={{ padding: 14 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: 3 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={i <= review.rating ? '' : 'star-muted'}>
                    <StarIcon size={13} filled={i <= review.rating} />
                  </span>
                ))}
              </div>
              <StatusPill
                label={review.status}
                tone={review.status === 'approved' ? 'solid' : review.status === 'pending' ? 'warn' : 'quiet'}
              />
              <span className="spacer" />
              <span className="admin-hint">{new Date(review.createdAt).toLocaleDateString('en-NG')}</span>
            </div>
            <p className="t-sm" style={{ marginTop: 10 }}>
              &ldquo;{review.body}&rdquo;
            </p>
            <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <span className="admin-hint">
                {review.customerName} · {review.productName}
              </span>
              <span className="spacer" />
              {review.status !== 'approved' ? (
                <button type="button" className="tool-btn" onClick={() => setReviewStatus(review, 'approved')}>
                  <Icon name="check" size={14} />
                  Approve
                </button>
              ) : null}
              {review.status !== 'hidden' ? (
                <button type="button" className="tool-btn" onClick={() => setReviewStatus(review, 'hidden')}>
                  <Icon name="close" size={14} />
                  Hide
                </button>
              ) : null}
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setDeleting(review)} aria-label="Delete review">
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="admin-hint">No reviews match this filter.</p> : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete review?"
        message="This review will be permanently removed."
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          store.write('reviews', (list) => list.filter((r) => r.id !== deleting.id));
          setDeleting(null);
        }}
      />
    </>
  );
}
