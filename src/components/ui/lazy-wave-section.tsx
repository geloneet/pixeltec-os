'use client';
import dynamic from 'next/dynamic';

// AboutWaveSection is purely decorative (animated SVG paths).
// Loaded client-side only so its Framer Motion JS is excluded from the
// initial bundle, reducing TBT on first paint.
const AboutWaveSectionLazy = dynamic(
  () => import('./about-wave-section').then((m) => m.AboutWaveSection),
  { ssr: false }
);

export function LazyWaveSection() {
  return <AboutWaveSectionLazy />;
}
