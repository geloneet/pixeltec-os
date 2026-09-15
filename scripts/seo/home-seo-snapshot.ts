#!/usr/bin/env -S npx tsx
/**
 * Snapshot SEO del home (WO-2026-00343).
 *
 *   npx tsx scripts/seo/home-seo-snapshot.ts --url https://pixeltec.mx/ --out docs/seo/home-seo-baseline-2026-09-14.json
 *   npx tsx scripts/seo/home-seo-snapshot.ts --url http://localhost:4879/ --compare docs/seo/home-seo-baseline-2026-09-14.json
 *
 * Solo lee: una petición GET al `--url` y los registros de contenido del repo
 * (para saber qué hrefs son landings). Con `--compare` imprime la tabla
 * antes/después y termina con exit 1 si `links.landing` o `links.unique` bajan.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HOME_TERMS,
  classifyLinks,
  countTerm,
  headingOutline,
  internalHrefs,
  jsonLdTypes,
  landingSlugsFromSource,
  visibleText,
  wordCount,
} from './home-seo-snapshot.lib';

const REGISTRIES = [
  'src/lib/content/automatizacion-local.ts',
  'src/lib/content/local-services.ts',
  'src/lib/content/keyword-landings-software.ts',
  'src/lib/content/keyword-landings-whatsapp.ts',
  'src/lib/content/keyword-landings-apps.ts',
];

interface Snapshot {
  url: string;
  fetchedAt: string;
  title: string;
  description: string;
  h1: string;
  outline: { level: number; text: string }[];
  words: number;
  terms: Record<string, number>;
  links: { total: number; unique: number; landing: number; landingHrefs: string[] };
  jsonLdTypes: string[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function snapshot(url: string): Promise<Snapshot> {
  const res = await fetch(url, { headers: { 'user-agent': 'pixeltec-seo-snapshot/1' } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const html = await res.text();
  const text = visibleText(html);
  const slugs = landingSlugsFromSource(REGISTRIES.map((p) => readFileSync(resolve(p), 'utf8')));
  const outline = headingOutline(html);
  return {
    url,
    fetchedAt: new Date().toISOString(),
    title: /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '',
    description: /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '',
    h1: outline.filter((h) => h.level === 1).map((h) => h.text).join(' | '),
    outline,
    words: wordCount(text),
    terms: Object.fromEntries(HOME_TERMS.map((t) => [t, countTerm(text, t)])),
    links: classifyLinks(internalHrefs(html), slugs),
    jsonLdTypes: jsonLdTypes(html),
  };
}

function compare(before: Snapshot, after: Snapshot): boolean {
  const rows: [string, string | number, string | number][] = [
    ['title', before.title, after.title],
    ['description.length', before.description.length, after.description.length],
    ['h1', before.h1, after.h1],
    ['words', before.words, after.words],
    ['links.total', before.links.total, after.links.total],
    ['links.unique', before.links.unique, after.links.unique],
    ['links.landing', before.links.landing, after.links.landing],
    ['jsonLdTypes', before.jsonLdTypes.join(','), after.jsonLdTypes.join(',')],
    ...HOME_TERMS.map((t): [string, number, number] => [`term:${t}`, before.terms[t] ?? 0, after.terms[t] ?? 0]),
  ];
  for (const [k, a, b] of rows) console.log(`${k.padEnd(28)} ${String(a).padEnd(40)} → ${b}`);
  const regressed = after.links.landing < before.links.landing || after.links.unique < before.links.unique;
  if (regressed) console.error('REGRESIÓN: bajaron los enlaces internos.');
  return !regressed;
}

async function main() {
  const url = arg('url') ?? 'https://pixeltec.mx/';
  const snap = await snapshot(url);
  const out = arg('out');
  if (out) {
    writeFileSync(resolve(out), `${JSON.stringify(snap, null, 2)}\n`);
    console.log(`snapshot escrito en ${out}`);
  }
  const cmp = arg('compare');
  if (cmp) {
    const before = JSON.parse(readFileSync(resolve(cmp), 'utf8')) as Snapshot;
    if (!compare(before, snap)) process.exit(1);
  }
  if (!out && !cmp) console.log(JSON.stringify(snap, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
