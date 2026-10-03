import { StarIcon } from './Icon';

export function Rating({
  value,
  count,
  size = 11,
  showCount = true,
}: {
  value: number;
  count?: number;
  size?: number;
  showCount?: boolean;
}) {
  const rounded = Math.round(value);
  return (
    <span className="rating" title={`${value} out of 5`}>
      <span className="stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <StarIcon key={i} size={size} filled={i <= rounded} />
        ))}
      </span>
      <span className="sr-only">{value} out of 5 stars</span>
      {showCount && count !== undefined ? (
        <span className="rating-count">({count})</span>
      ) : null}
    </span>
  );
}

export default Rating;