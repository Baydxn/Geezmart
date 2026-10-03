/**
 * Monochrome icon set — a single stroke weight so everything reads as one family.
 * Icons are decorative by default; pass `title` to expose an accessible name.
 */
const P = {
  /* navigation */
  home: 'M3 10.2 12 3l9 7.2M5.5 9.4V20a1 1 0 0 0 1 1h3.5v-5.5h4.5V21h3.5a1 1 0 0 0 1-1V9.4',
  shop: 'M4 8h16l-1.2 11.2a1.6 1.6 0 0 1-1.6 1.4H6.8a1.6 1.6 0 0 1-1.6-1.4L4 8Zm3.6 0V6.4A2.4 2.4 0 0 1 10 4h4a2.4 2.4 0 0 1 2.4 2.4V8',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  orders: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2.5 5h7M8.5 12h7M8.5 16h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5',
  /* actions */
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5.2-1.8L21 21',
  cart: 'M3.5 4.5h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h7.4a1.6 1.6 0 0 0 1.6-1.2l1.6-6.3H7M9.5 20.5h.01M17 20.5h.01',
  heart: 'M12 20s-7.5-4.6-7.5-9.5A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.9c0 4.9-7.5 9.5-7.5 9.5Z',
  plus: 'M12 5.5v13M5.5 12h13',
  minus: 'M5.5 12h13',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M4.5 12.5 9.5 18 19.5 6.5',
  chevronDown: 'M6 9.5 12 15.5l6-6',
  chevronRight: 'M9.5 5.5 16 12l-6.5 6.5',
  chevronLeft: 'M14.5 5.5 8 12l6.5 6.5',
  arrowRight: 'M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5',
  arrowUpRight: 'M7 17 17 7m0 0H9m8 0v8',
  trash: 'M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7m2.6 0-.7 12.4a1.6 1.6 0 0 1-1.6 1.5H8.2a1.6 1.6 0 0 1-1.6-1.5L5.9 6.5',
  filter: 'M4 6.5h16M7 12h10M10 17.5h4',
  sort: 'M7 5v14m0 0-3-3m3 3 3-3M17 19V5m0 0-3 3m3-3 3 3',
  sliders: 'M5 7h14M5 12h14M5 17h14M9 4.5v5M15 9.5v5M11 14.5v5',
  mic: 'M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6.5a3.5 3.5 0 1 0-7 0V12a3.5 3.5 0 0 0 3.5 3.5Zm0 0V20m-4 0h8',
  camera: 'M4 8.5h3l1.4-2h7.2l1.4 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm8.5 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  share: 'M18 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm12 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8.2 10.8l7.6-3.9m-7.6 8.2 7.6 3.9',
  /* commerce */
  truck: 'M3 6.5h10.5v10H3zM13.5 10h3.8l2.7 3v3.5h-6.5zM8 19.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm9 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z',
  shield: 'M12 3.5 5 6v6c0 4.2 2.9 7.6 7 8.5 4.1-.9 7-4.3 7-8.5V6l-7-2.5Zm-2.5 8.5 2 2 3.5-3.8',
  wallet: 'M4 7.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18V7.5Zm0 0V6A1.5 1.5 0 0 1 5.5 4.5H16M16 13h.01',
  card: 'M3.5 7.5h17a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm0 3h17M6.5 14.5h3',
  bank: 'M3.5 9.5 12 4.5l8.5 5M5.5 9.5v8m4-8v8m5-8v8m4-8v8M3.5 19.5h17',
  pin: 'M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Zm0-8.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z',
  box: 'M4 7.8 12 4l8 3.8v8.4L12 20l-8-3.8V7.8Zm0 0 8 3.8m0 0 8-3.8m-8 3.8V20',
  sparkle: 'M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z',
  gift: 'M4.5 10.5h15V20a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-9.5Zm-1-4h5.5a2.5 2.5 0 0 1 0 5h-5.5v-5Zm17 0H15a2.5 2.5 0 0 0 0 5h5.5v-5ZM12 6.5V21',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4.5V9h-4.5',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2.5H5l1.5-2.5Zm3.5 5.5a2 2 0 0 0 4 0',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-12.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.7-.8 1.2v.9M12 16.5h.01',
  logout: 'M14 8V6.5A1.5 1.5 0 0 0 12.5 5h-7A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19h7a1.5 1.5 0 0 0 1.5-1.5V16M10 12h10m0 0-3.2-3.2M20 12l-3.2 3.2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3.5 2',
  /* categories */
  watch: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 9v3.4l2.2 1.3M9 6.5 9.6 3h4.8l.6 3.5M9 17.5l.6 3.5h4.8l.6-3.5',
  headphones: 'M4.5 17v-4a7.5 7.5 0 0 1 15 0v4M4.5 14.5h1.6a1 1 0 0 1 1 1v3.6a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-4.7Zm15 0h-1.6a1 1 0 0 0-1 1v3.6a1 1 0 0 0 1 1h.6a1 1 0 0 0 1-1v-4.7Z',
  grooming: 'M9 3.5h6a1 1 0 0 1 1 1v3.2l2.4 8.1a1 1 0 0 1 .95 1.3l-.5 3.4a1.6 1.6 0 0 1-1.55 1.25H6.7A1.6 1.6 0 0 1 5.15 20.5l-.5-3.4a1 1 0 0 1 .95-1.3L8 7.7V4.5a1 1 0 0 1 1-1Zm2 0V2h2v1.5',
  phone: 'M7.5 3.5h9a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Zm2.5 14h4',
  shirt: 'M8.5 4 12 2.5 15.5 4l4.5 2.5-2 3.8-1.5-.8V20a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V9.5l-1.5.8-2-3.8L8.5 4Z',
  sofa: 'M4.5 11V8.5A2.5 2.5 0 0 1 7 6h10a2.5 2.5 0 0 1 2.5 2.5V11M4.5 13.5a2 2 0 0 1 4 0V16h7v-2.5a2 2 0 1 1 4 0V19H4.5v-5.5ZM6 19v1.5M18 19v1.5',
  sunglasses: 'M3.5 10.5h17M7 10.5c0 3.3-1.4 6-4 6s-4-2.7-4-6a4 4 0 0 1 8 0Zm18 0c0 3.3-1.4 6-4 6s-4-2.7-4-6a4 4 0 0 1 8 0Z',
  lamp: 'M8 12h8l-2.5-7h-3L8 12Zm4 12v-7m-3.5 1.5h7M9.5 5V3.5h5V5',
  bag: 'M4.5 8h15l-1 11.5a1 1 0 0 1-1 .9H6.5a1 1 0 0 1-1-.9L4.5 8Zm4.5 0V6.5a3 3 0 0 1 6 0V8',
  star: 'M12 3.6l2.5 5.1 5.6.8-4 3.9 1 5.3-4.7-2.6-4.7 2.6 1-5.3-3.8-3.9 5.2-.7L12 3.6Z',
  play: 'M8.5 5.5 18 12l-9.5 6.5v-13Z',
  pause: 'M9 5.5v13M15 5.5v13',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.6-2.4.1-1.2-1.9-.6a6.7 6.7 0 0 0-.7-1.5l1.1-1.6-1.8-1.8-1.6 1.1a6.7 6.7 0 0 0-1.5-.7l-.6-1.9-1.2-.1-.6 1.9a6.7 6.7 0 0 0-1.5.7L8.6 5.5l-1.8 1.8 1.1 1.6a6.7 6.7 0 0 0-.7 1.5l-1.9.6.1 1.2 1.9.6a6.7 6.7 0 0 0 .7 1.5l-1.1 1.6 1.8 1.8 1.6-1.1a6.7 6.7 0 0 0 1.5.7l.6 1.9h1.2l.6-1.9a6.7 6.7 0 0 0 1.5-.7l1.6 1.1 1.8-1.8-1.1-1.6a6.7 6.7 0 0 0 .7-1.5l1.9-.6Z',
};

export type IconName = keyof typeof P;

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
  strokeWidth?: number;
}

export default function Icon({
  name,
  size = 20,
  className,
  title,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={P[name]} />
    </svg>
  );
}

export function StarIcon({ size = 12, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3.6l2.5 5.1 5.6.8-4 3.9 1 5.6L12 16.3 6.9 19l1-5.6-4-3.9 5.6-.8L12 3.6Z" />
    </svg>
  );
}