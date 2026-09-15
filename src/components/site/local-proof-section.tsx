'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import type { LocalProof } from '@/lib/content/local-services';
import { getIndustryPage, industryPagePath } from '@/lib/content/industrias';

/**
 * Sección «Trabajo real …» de las landings ciudad×servicio (WO-2026-00345, L4).
 * Compartida por `local-service-page.tsx` y `local-automation-page.tsx`; se
 * pinta SOLO cuando el registro trae `localProof` o `relatedIndustrySlugs`.
 * Los chips reutilizan las clases de `sections/local-landings.tsx` (R-DM-001:
 * extensión del patrón existente, sin diseño nuevo). Sin `opacity:0`: la
 * variante solo anima transform (REN-01).
 */
const CHIP =
  'inline-flex min-h-11 items-center rounded-full border border-primary/25 dark:border-cyan-500/25 bg-primary/5 dark:bg-cyan-500/5 px-4 py-2 text-sm font-medium text-brand hover:bg-primary/10 dark:hover:bg-cyan-500/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

interface LocalProofSectionProps {
  slug: string;
  proof?: LocalProof;
  relatedIndustrySlugs?: string[];
  variants: Variants;
}

export function LocalProofSection({ slug, proof, relatedIndustrySlugs, variants }: LocalProofSectionProps) {
  const industries = (relatedIndustrySlugs ?? [])
    .map((s) => getIndustryPage(s))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));
  if (!proof && industries.length === 0) return null;

  const links = [...(proof?.links ?? [])];
  for (const industry of industries) {
    const href = industryPagePath(industry.page);
    if (!links.some((l) => l.href === href)) links.push({ href, label: industry.page.serviceType });
  }
  const headingId = `local-proof-${slug}`;
  const title = proof?.title ?? 'Industrias relacionadas';

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={variants}
      aria-labelledby={headingId}
      className="py-12 sm:py-16"
    >
      <h2 id={headingId} className="mb-6 text-3xl font-bold text-foreground">
        {title}
      </h2>
      {proof && (
        <div className="space-y-4 max-w-3xl">
          {proof.body.map((paragraph, index) => (
            <p key={index} className="text-muted-foreground leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={CHIP} data-cta="internal_link" data-cta-pos="landing_local_proof">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
