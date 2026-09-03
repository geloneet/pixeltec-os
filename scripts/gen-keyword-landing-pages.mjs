#!/usr/bin/env node
/**
 * Generador de wrappers de páginas para las landings por keyword
 * (WO-2026-00189).
 *
 * QUÉ HACE
 *   Crea `src/app/<slug>/page.tsx` para cada entrada del registro
 *   `src/lib/content/keyword-landings*.ts`. El wrapper es el mismo patrón que
 *   las landings de ciudad (`src/app/desarrollo-web-puerto-vallarta/page.tsx`):
 *   `buildMetadata` + `BreadcrumbStructuredData` (Inicio → hub → página) +
 *   `StandaloneServiceStructuredData` (con `areaServedCity` si la landing
 *   tiene ciudad) + `FAQPageStructuredData` + `notFound()` si el slug no
 *   existe en el registro.
 *
 * CÓMO SE CORRE
 *   node scripts/gen-keyword-landing-pages.mjs            # escribe los archivos
 *   node scripts/gen-keyword-landing-pages.mjs --check    # no escribe: falla (exit 1) si algo está desactualizado
 *
 *   Después de correrlo:  npx tsc --noEmit && npm run lint && npm run build
 *
 * IDEMPOTENTE
 *   Si el archivo generado ya es idéntico al que toca, no lo toca. Los
 *   wrappers son 100% derivados del registro: nunca los edites a mano — edita
 *   el registro y vuelve a correr el script. Tampoco borra directorios: si
 *   quitas una entrada del registro, el script avisa qué carpeta sobra para
 *   que la elimines tú (borrar rutas es una decisión de SEO, no del script).
 *
 * POR QUÉ LEE EL REGISTRO CON REGEX Y NO CON UN IMPORT
 *   El registro es TypeScript con imports sin extensión y alias `@/`; Node no
 *   los resuelve sin un cargador extra, y meter `tsx` en el camino solo para
 *   obtener una lista de slugs no vale la complejidad. El único dato que este
 *   script necesita es el slug: todo lo demás (hub, ciudad, FAQ) lo resuelve
 *   el wrapper en tiempo de ejecución desde el propio registro tipado.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'lib', 'content');
const APP_DIR = join(ROOT, 'src', 'app');

const CLUSTER_FILES = [
  'keyword-landings-software.ts',
  'keyword-landings-whatsapp.ts',
  'keyword-landings-apps.ts',
];

const SLUG_RE = /^\s{4}slug:\s*'([a-z0-9]+(?:-[a-z0-9]+)*)',$/gm;

/** Lee los slugs declarados en los archivos de clúster del registro. */
function readSlugs() {
  const slugs = [];
  for (const file of CLUSTER_FILES) {
    const path = join(CONTENT_DIR, file);
    if (!existsSync(path)) {
      throw new Error(`Falta el archivo del registro: ${path}`);
    }
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(SLUG_RE)) {
      slugs.push({ slug: match[1], file });
    }
  }
  const seen = new Map();
  for (const { slug, file } of slugs) {
    if (seen.has(slug)) {
      throw new Error(`Slug duplicado en el registro: "${slug}" (${seen.get(slug)} y ${file})`);
    }
    seen.set(slug, file);
  }
  return slugs.map((entry) => entry.slug);
}

function render(slug) {
  return `import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import {
  BreadcrumbStructuredData,
  StandaloneServiceStructuredData,
  FAQPageStructuredData,
} from '@/components/seo/structured-data';
import { getKeywordLanding, KEYWORD_LANDING_HUBS } from '@/lib/content/keyword-landings';
import { SITE } from '@/lib/site-config';
import KeywordLandingPage from '@/components/site/keyword-landing-page';

// Archivo GENERADO por scripts/gen-keyword-landing-pages.mjs — no lo edites a
// mano: edita src/lib/content/keyword-landings-*.ts y vuelve a correr el script.

const SLUG = '${slug}';

export const metadata: Metadata = (() => {
  const landing = getKeywordLanding(SLUG);
  if (!landing) return { title: 'Página no encontrada' };
  return buildMetadata({
    path: \`/\${SLUG}\`,
    title: landing.metaTitle,
    description: landing.metaDescription,
  });
})();

export default function Page() {
  const landing = getKeywordLanding(SLUG);
  if (!landing) notFound();
  const hub = KEYWORD_LANDING_HUBS[landing.hub];
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: 'Inicio', url: SITE.url },
          { name: hub.label, url: \`\${SITE.url}\${hub.href}\` },
          { name: landing.h1, url: \`\${SITE.url}/\${SLUG}\` },
        ]}
      />
      <StandaloneServiceStructuredData
        url={\`\${SITE.url}/\${SLUG}\`}
        name={landing.metaTitle}
        description={landing.metaDescription}
        {...(landing.city ? { areaServedCity: landing.city.name } : {})}
      />
      <FAQPageStructuredData items={landing.faq} />
      <KeywordLandingPage landing={landing} />
    </>
  );
}
`;
}

const GENERATED_MARK = 'scripts/gen-keyword-landing-pages.mjs';

function main() {
  const check = process.argv.includes('--check');
  const slugs = readSlugs();

  if (slugs.length === 0) {
    console.log('[gen-keyword-landing-pages] El registro no tiene slugs todavía. Nada que generar.');
    return;
  }

  let written = 0;
  let unchanged = 0;
  const stale = [];

  for (const slug of slugs) {
    const dir = join(APP_DIR, slug);
    const file = join(dir, 'page.tsx');
    const next = render(slug);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;

    if (current === next) {
      unchanged += 1;
      continue;
    }
    if (check) {
      stale.push(slug);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, next, 'utf8');
    written += 1;
    console.log(`  + src/app/${slug}/page.tsx`);
  }

  // Wrappers generados cuyo slug ya no está en el registro: se reportan, no se
  // borran (retirar una URL indexada es una decisión de SEO con redirect).
  const orphans = readdirSync(APP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !slugs.includes(entry.name))
    .filter((entry) => {
      const file = join(APP_DIR, entry.name, 'page.tsx');
      return existsSync(file) && readFileSync(file, 'utf8').includes(GENERATED_MARK);
    })
    .map((entry) => entry.name);

  if (check && stale.length > 0) {
    console.error(`[gen-keyword-landing-pages] Desactualizadas (${stale.length}): ${stale.join(', ')}`);
    console.error('Corre: node scripts/gen-keyword-landing-pages.mjs');
    process.exitCode = 1;
    return;
  }

  console.log(
    `[gen-keyword-landing-pages] ${slugs.length} slugs · ${written} escritas · ${unchanged} sin cambios`,
  );
  if (orphans.length > 0) {
    console.warn(
      `[gen-keyword-landing-pages] AVISO — wrappers generados sin entrada en el registro: ${orphans.join(', ')}. ` +
        'Bórralos a mano solo con su redirect correspondiente.',
    );
  }
}

main();
