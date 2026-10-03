export default function HeroCarousel({ slides = HERO_SLIDES }: { slides?: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [progressKey, setProgressKey] = useState(0);
  const touchStart = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (nextIndex: number, dir: number) => {
      setDirection(dir);
      setIndex(((nextIndex % count) + count) % count);
      setProgressKey((k) => k + 1);
    },
    [count],
  );

  const next = useCallback(() => go(index + 1, 1), [go, index]);
  const prev = useCallback(() => go(index - 1, -1), [go, index]);

  useEffect(() => {
    if (count < 2) return;
    const timer = window.setInterval(next, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, next, index]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -450) next();
    else if (info.offset.x > 70 || info.velocity.x > 450) prev();
  };

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Featured collections">
      <div
        className="hero-viewport"
        onTouchStart={(e) => {
          touchStart.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStart.current === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStart.current;
          if (dx < -55) next();
          else if (dx > 55) prev();
          touchStart.current = null;
        }}
      >
        <AnimatePresence initial={false} mode="sync" custom={direction}>
          <motion.article
            key={slides[index].id}
            className="hero-slide"
            custom={direction}
            initial={{ opacity: 0, x: direction * 46, scale: 1.02 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction * -46, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={onDragEnd}
          >
            <div className="hero-media">
              <img
                src={heroImage(slides[index].visual, index, slides[index].tint)}
                alt=""
                aria-hidden="true"
                loading={index === 0 ? 'eager' : 'lazy'}
                width={1200}
                height={760}
              />
            </div>
            <div className="hero-scrim" />

            <motion.div
              className="hero-content"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
              }}
            >
              <motion.span
                className="hero-eyebrow"
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.32 }}
              >
                <span className="hero-dot" />
                {slides[index].eyebrow}
              </motion.span>
              <motion.h1
                className="hero-title"
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.4 }}
              >
                {slides[index].title}
                <br />
                {slides[index].highlight}
              </motion.h1>
              <motion.p
                className="hero-sub"
                variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.38 }}
              >
                {slides[index].subtitle}
              </motion.p>
              <motion.div
                className="hero-actions"
                variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.38 }}
              >
                <Link to={slides[index].to} className="btn btn-primary btn-md">
                  {slides[index].cta}
                  <Icon name="arrowRight" size={17} />
                </Link>
                <Link to="/shop" className="btn btn-ghost btn-md">
                  Browse All
                </Link>
              </motion.div>
            </motion.div>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="hero-arrows">
        <button type="button" className="hero-arrow" onClick={prev} aria-label="Previous slide">
          <Icon name="chevronLeft" size={20} />
        </button>
        <button type="button" className="hero-arrow" onClick={next} aria-label="Next slide">
          <Icon name="chevronRight" size={20} />
        </button>
      </div>

      <div className="hero-dots" role="tablist" aria-label="Choose slide">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            className="hero-dot-btn"
            data-active={i === index}
            aria-selected={i === index}
            aria-label={`Show slide ${i + 1}: ${slide.title}`}
            onClick={() => go(i, i > index ? 1 : -1)}
          />
        ))}
      </div>

      <motion.div
        key={progressKey}
        className="hero-progress"
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
      />
    </section>
  );
}
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import Icon from './Icon';
import { heroImage } from '../lib/productImage';
import type { VisualKind } from '../types';

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  highlight?: string;
  subtitle: string;
  cta: string;
  to: string;
  visual: VisualKind;
  tint: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'hero-1',
    eyebrow: 'New Season',
    title: "Premium Men's",
    highlight: 'Lifestyle & Gadgets',
    subtitle: 'Quality products. Modern living. GEEZMART.',
    cta: 'Shop Now',
    to: '/shop',
    visual: 'watch',
    tint: '#cfd6df',
  },
  {
    id: 'hero-2',
    eyebrow: 'Audio',
    title: 'Sound That',
    highlight: 'Fits Your Life',
    subtitle: 'Earbuds, speakers and studio headphones — tuned for the commute and beyond.',
    cta: 'Explore Audio',
    to: '/shop?category=gadgets',
    visual: 'headphones',
    tint: '#b9c2cf',
  },
  {
    id: 'hero-3',
    eyebrow: 'Grooming',
    title: 'A Routine',
    highlight: 'Worth Keeping',
    subtitle: 'Clean, considered essentials for the everyday sharp.',
    cta: 'Shop Grooming',
    to: '/shop?category=grooming',
    visual: 'kit',
    tint: '#d3ccd2',
  },
  {
    id: 'hero-4',
    eyebrow: 'Home',
    title: 'Quiet Luxury,',
    highlight: 'At Home',
    subtitle: 'Furniture and lighting with a darker, calmer point of view.',
    cta: 'Shop Furniture',
    to: '/shop?category=furniture',
    visual: 'couch',
    tint: '#c8c9c6',
  },
];

const AUTOPLAY_MS = 6000;