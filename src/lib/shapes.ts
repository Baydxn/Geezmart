import type { VisualKind } from '../types';

/**
 * Metallic silhouettes used by the demo visual generator (`productImage.ts`).
 * Each shape is drawn on a 640x640 stage and filled with the shared metallic
 * gradients (`m1` / `m2`) declared by the generator.
 */

const GRID = (rows: number, cols: number, fn: (x: number, y: number) => string) =>
  Array.from({ length: rows })
    .map((_, r) =>
      Array.from({ length: cols })
        .map((__, c) => fn(c, r))
        .join(''),
    )
    .join('');

export const SHAPES: Record<VisualKind, string> = {
  watch: `
    <rect x="255" y="70" width="130" height="230" rx="46" fill="url(#m2)"/>
    <rect x="255" y="540" width="130" height="230" rx="46" fill="url(#m2)"/>
    <circle cx="320" cy="420" r="132" fill="url(#m1)"/>
    <circle cx="320" cy="420" r="104" fill="#0b0d10" stroke="url(#m2)" stroke-width="5"/>
    <circle cx="320" cy="420" r="7" fill="#fff"/>
    <path d="M320 420V352" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
    <path d="M320 420l52 34" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".75"/>
    <rect x="446" y="392" width="26" height="56" rx="12" fill="url(#m2)"/>`,

  headphones: `
    <path d="M150 430v-52a170 170 0 0 1 340 0v52" fill="none" stroke="url(#m2)" stroke-width="34" stroke-linecap="round"/>
    <rect x="104" y="404" width="98" height="196" rx="48" fill="url(#m1)"/>
    <rect x="438" y="404" width="98" height="196" rx="48" fill="url(#m1)"/>
    <rect x="128" y="430" width="50" height="144" rx="25" fill="#0b0d10" opacity=".65"/>
    <rect x="462" y="430" width="50" height="144" rx="25" fill="#0b0d10" opacity=".65"/>`,

  earbuds: `
    <rect x="150" y="356" width="240" height="230" rx="64" fill="url(#m1)"/>
    <rect x="150" y="356" width="240" height="86" rx="43" fill="#ffffff" opacity=".14"/>
    <path d="M212 300c0-46 34-78 74-78s74 32 74 78v34h-148z" fill="url(#m1)"/>
    <circle cx="286" cy="262" r="26" fill="#0b0d10"/>
    <circle cx="286" cy="262" r="11" fill="#fff"/>
    <path d="M520 402c0-40 28-66 62-66s62 26 62 66v74c0 40-28 66-62 66s-62-26-62-66z" fill="url(#m1)"/>
    <circle cx="582" cy="376" r="21" fill="#0b0d10"/>`,

  speaker: `
    <rect x="196" y="212" width="248" height="396" rx="76" fill="url(#m1)"/>
    <rect x="222" y="238" width="196" height="344" rx="60" fill="#0b0d10" opacity=".55"/>
    ${GRID(5, 4, (c, r) => `<circle cx="${248 + c * 48}" cy="${270 + r * 62}" r="8" fill="#ffffff" opacity=".38"/>`)}
    <circle cx="320" cy="546" r="34" fill="url(#m2)"/>`,

  light: `
    <circle cx="320" cy="400" r="128" fill="url(#m1)"/>
    <circle cx="320" cy="400" r="74" fill="#fff" opacity=".85"/>
    ${Array.from({ length: 12 })
      .map((_, i) => {
        const a = (i * Math.PI * 2) / 12;
        const x1 = 320 + Math.cos(a) * 176;
        const y1 = 400 + Math.sin(a) * 176;
        const x2 = 320 + Math.cos(a) * 226;
        const y2 = 400 + Math.sin(a) * 226;
        return `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".6"/>`;
      })
      .join('')}`,

  phone: `
    <rect x="228" y="112" width="184" height="392" rx="42" fill="url(#m1)"/>
    <rect x="246" y="130" width="148" height="356" rx="30" fill="#08090b"/>
    <rect x="262" y="146" width="116" height="60" rx="26" fill="#ffffff" opacity=".16"/>
    <rect x="262" y="230" width="116" height="150" rx="26" fill="url(#m2)" opacity=".55"/>
    <rect x="296" y="128" width="48" height="12" rx="6" fill="#0b0d10"/>`,

  cream: `
    <rect x="238" y="212" width="164" height="316" rx="46" fill="url(#m1)"/>
    <rect x="272" y="118" width="96" height="106" rx="22" fill="url(#m2)"/>
    <rect x="262" y="300" width="116" height="112" rx="24" fill="#ffffff" opacity=".18"/>
    <rect x="288" y="330" width="64" height="9" rx="5" fill="#fff" opacity=".85"/>
    <rect x="302" y="352" width="36" height="7" rx="4" fill="#fff" opacity=".5"/>`,

  bottle: `
    <rect x="272" y="176" width="96" height="118" rx="26" fill="url(#m2)"/>
    <rect x="230" y="256" width="180" height="330" rx="58" fill="url(#m1)"/>
    <rect x="230" y="256" width="180" height="120" rx="58" fill="#ffffff" opacity=".12"/>
    <circle cx="320" cy="466" r="42" fill="#0b0d10" opacity=".7"/>
    <circle cx="320" cy="466" r="20" fill="url(#m2)"/>`,

  kit: `
    <rect x="140" y="270" width="360" height="264" rx="46" fill="url(#m1)"/>
    <path d="M236 270v-46a44 44 0 0 1 44-44h80a44 44 0 0 1 44 44v46" fill="none" stroke="url(#m2)" stroke-width="22"/>
    <rect x="188" y="322" width="124" height="160" rx="26" fill="#ffffff" opacity=".16"/>
    <rect x="330" y="322" width="56" height="160" rx="26" fill="#0b0d10" opacity=".45"/>
    <rect x="404" y="322" width="56" height="160" rx="26" fill="#0b0d10" opacity=".45"/>`,

  sneakers: `
    <path d="M118 452c0-44 26-58 62-70l84-28 44-72c8-14 22-22 38-22h58c22 0 40 18 40 40v122c0 26-14 44-40 52l-56 18H176c-32 0-58-26-58-40z" fill="url(#m1)"/>
    <path d="M118 452h430v54c0 16-12 28-28 28H146c-16 0-28-12-28-28z" fill="url(#m2)"/>
    <path d="M268 352l58-20M300 386l58-20" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".55"/>`,

  shirt: `
    <path d="M232 176l104-34a80 80 0 0 0 88 0l104 34 76 92-72 54-30-38v242a22 22 0 0 1-22 22H238a22 22 0 0 1-22-22V284l-30 38-72-54z" fill="url(#m1)"/>
    <path d="M336 142a80 80 0 0 0 88 0l-44-28z" fill="#0b0d10" opacity=".5"/>`,
  couch: `
    <rect x="112" y="300" width="416" height="132" rx="52" fill="url(#m1)"/>
    <rect x="88" y="404" width="464" height="140" rx="46" fill="url(#m2)"/>
    <rect x="150" y="286" width="150" height="120" rx="46" fill="#ffffff" opacity=".14"/>
    <rect x="340" y="286" width="150" height="120" rx="46" fill="#ffffff" opacity=".14"/>
    <rect x="118" y="544" width="26" height="72" rx="12" fill="url(#m2)"/>
    <rect x="496" y="544" width="26" height="72" rx="12" fill="url(#m2)"/>`,

  cabinet: `
    <rect x="140" y="170" width="360" height="330" rx="26" fill="url(#m1)"/>
    <line x1="320" y1="170" x2="320" y2="500" stroke="#0b0d10" stroke-width="7" opacity=".5"/>
    <line x1="140" y1="335" x2="500" y2="335" stroke="#0b0d10" stroke-width="7" opacity=".5"/>
    <circle cx="298" cy="250" r="8" fill="#fff" opacity=".8"/>
    <circle cx="342" cy="250" r="8" fill="#fff" opacity=".8"/>
    <rect x="166" y="500" width="22" height="76" rx="10" fill="url(#m2)"/>
    <rect x="452" y="500" width="22" height="76" rx="10" fill="url(#m2)"/>`,

  tvstand: `
    <rect x="120" y="286" width="400" height="150" rx="26" fill="url(#m1)"/>
    <rect x="152" y="318" width="336" height="86" rx="16" fill="#0b0d10" opacity=".5"/>
    <rect x="146" y="436" width="24" height="86" rx="11" fill="url(#m2)"/>
    <rect x="470" y="436" width="24" height="86" rx="11" fill="url(#m2)"/>
    <rect x="236" y="188" width="168" height="94" rx="12" fill="#0b0d10"/>
    <rect x="248" y="200" width="144" height="70" rx="8" fill="url(#m2)" opacity=".6"/>`,

  lamp: `
    <path d="M216 262h208l-56-118H272z" fill="url(#m1)"/>
    <rect x="310" y="262" width="20" height="216" rx="10" fill="url(#m2)"/>
    <rect x="234" y="478" width="172" height="28" rx="14" fill="url(#m1)"/>
    <ellipse cx="320" cy="560" rx="150" ry="26" fill="#fff" opacity=".14"/>`,

  bag: `
    <path d="M128 300h384a34 34 0 0 1 34 34v190a34 34 0 0 1-34 34H128a34 34 0 0 1-34-34V334a34 34 0 0 1 34-34z" fill="url(#m1)"/>
    <path d="M210 300v-42a110 110 0 0 1 220 0v42" fill="none" stroke="url(#m2)" stroke-width="24" stroke-linecap="round"/>
    <rect x="272" y="382" width="96" height="30" rx="15" fill="#0b0d10" opacity=".55"/>`,

  wallet: `
    <rect x="132" y="252" width="376" height="236" rx="34" fill="url(#m1)"/>
    <path d="M132 320h376" stroke="#0b0d10" stroke-width="6" opacity=".45"/>
    <rect x="366" y="352" width="112" height="52" rx="18" fill="#ffffff" opacity=".16"/>
    <circle cx="300" cy="416" r="16" fill="#fff" opacity=".5"/>`,
};