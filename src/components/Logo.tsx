/**
 * GEEZMART wordmark — white bubble-style lettering.
 *
 * ─────────────────────────────────────────────────────────────
 * TO USE THE OFFICIAL LOGO ASSET INSTEAD:
 * drop the file at `public/brand/geezmart-logo.png` (white wordmark)
 * and set `useImageMark = true` below. Nothing else changes.
 * ─────────────────────────────────────────────────────────────
 */
import { useId } from 'react';

const USE_IMAGE_MARK = false;
const IMAGE_SRC = '/brand/geezmart-logo.png';

/** Bubble letter geometry, 70×100 cells drawn as rounded strokes. */
const LETTERS: { d: string; dx: number }[] = [
  // G
  {
    d: 'M64 50 A30 30 0 1 1 4 50 A30 30 0 1 1 64 50 M64 34 V50 H38',
    dx: 6,
  },
  // E
  { d: 'M58 20 H22 V80 H58 M22 50 H50', dx: 82 },
  // E
  { d: 'M58 20 H22 V80 H58 M22 50 H50', dx: 158 },
  // Z
  { d: 'M20 20 H62 L20 80 H62', dx: 234 },
  // M
  { d: 'M16 80 V20 L34 58 L52 20 V80', dx: 310 },
  // A
  { d: 'M18 80 L34 20 L50 80 M25 58 H43', dx: 386 },
  // R
  { d: 'M24 80 V20 H44 A18 18 0 0 1 44 56 H24 M42 56 L58 80', dx: 462 },
  // T
  { d: 'M16 20 H56 M36 20 V80', dx: 538 },
];

const VIEW_W = 634;

export interface LogoProps {
  /** Rendered height in px; width scales proportionally. */
  height?: number;
  className?: string;
  title?: string;
}

export default function Logo({ height = 22, className, title = 'GEEZMART' }: LogoProps) {
  const gid = useId().replace(/:/g, '');

  if (USE_IMAGE_MARK) {
    return (
      <img
        src={IMAGE_SRC}
        alt={title}
        className={className}
        height={height}
        style={{ height, width: 'auto' }}
      />
    );
  }

  return (
    <svg
      className={className}
      height={height}
      viewBox={`0 0 ${VIEW_W} 100`}
      role="img"
      aria-label={title}
      style={{ height, width: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id={`gz-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".55" stopColor="#f2f4f7" />
          <stop offset="1" stopColor="#c9ced6" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke={`url(#gz-${gid})`}
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {LETTERS.map((letter, i) => (
          <path key={i} d={letter.d} transform={`translate(${letter.dx} 0)`} />
        ))}
      </g>
    </svg>
  );
}