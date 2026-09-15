/**
 * Informe semanal de Search Console — funciones puras (WO-2026-00345, L5).
 *
 * Entrada: filas `{date, page, query, clicks, impressions, ctr, position}`
 * (de `gsc_query_daily` vía `--from-db`, o de un CSV exportado de Search
 * Console vía `--csv`). Salida: un objeto `WeeklyReport` con 6 secciones y su
 * render en markdown. Sin red, sin DB, sin reloj: `endsOn` lo pasa quien llama.
 *
 * Reutiliza el módulo SEO & Contenido en vez de duplicar sus reglas:
 * `buildComparisonWindows` (ventanas de 28 d), `isBrandQuery` (marca),
 * `ruleImproveCtr` (CTR esperable por posición, de `rules.ts`),
 * `normalizeContentPath` y `CONTENT_LANDING_PATHS` (paths medibles) y
 * `industriesWithPage` (páginas de industria). Ninguno de esos archivos cambia.
 */
import { CONTENT_LANDING_PATHS, DEFAULT_THRESHOLDS, GSC_LAG_DAYS, WINDOW_DAYS, normalizeContentPath } from '../../src/lib/seo-insights/config';
import { buildComparisonWindows, delta, formatDelta, isWithin, type ComparisonWindows } from '../../src/lib/seo-insights/period';
import { isBrandQuery } from '../../src/lib/seo-insights/brand-filter';
import { ruleImproveCtr } from '../../src/lib/seo-insights/rules';
import { industriesWithPage, industryPagePath } from '../../src/lib/content/industrias';

export { GSC_LAG_DAYS };

export interface GscRow {
  /** `YYYY-MM-DD`. */
  date: string;
  /** URL completa de GSC, o `''` si el CSV no la trae. */
  page: string;
  /** Consulta, o `''` si el CSV es de «Páginas principales». */
  query: string;
  clicks: number;
  impressions: number;
  /** 0–1. */
  ctr: number;
  position: number;
}

export interface ReportOptions {
  /** Impresiones mínimas para opinar sobre una consulta×página (quick wins, CTR). */
  minImpressions?: number;
  /** Impresiones mínimas para contar una consulta como «nueva». */
  newQueryMinImpressions?: number;
  /** Rango cerrado de posición media de un quick win. */
  quickWinRange?: [number, number];
  /** Filas de la sección «Páginas». */
  topPages?: number;
  /** Paths cuya cobertura se vigila (por defecto: landings + páginas de industria). */
  coveragePaths?: readonly string[];
}

export interface QuickWin {
  path: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  action: string;
}

export interface LowCtr extends Omit<QuickWin, 'action'> {
  message: string;
  action: string;
}

export interface NewQuery {
  query: string;
  path: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface PageRow {
  path: string;
  impressions: { current: number; previous: number };
  impressionsDelta: string;
  clicks: { current: number; previous: number };
  clicksDelta: string;
  position: { current: number | null; previous: number | null };
}

export interface Cannibalization {
  query: string;
  pages: { path: string; impressions: number; clicks: number; position: number }[];
}

export interface WeeklyReport {
  generatedFor: string;
  windows: ComparisonWindows;
  rowsTotal: number;
  rowsUsed: number;
  hasPrevious: boolean;
  hasPages: boolean;
  thresholds: Required<Omit<ReportOptions, 'coveragePaths'>>;
  quickWins: QuickWin[];
  lowCtr: LowCtr[];
  newQueries: NewQuery[];
  pages: PageRow[];
  coverage: { tracked: number; zeroImpressions: string[] };
  cannibalization: Cannibalization[];
}

export const NO_PAGE = '(sin página en el CSV)';

// ── CSV ─────────────────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<keyof GscRow, RegExp> = {
  date: /^(date|fecha)$/,
  page: /^(page|pagina|paginas principales|top pages|url|landing page)$/,
  query: /^(query|consulta|consultas principales|top queries|search query)$/,
  clicks: /^(clicks|clics)$/,
  impressions: /^(impressions|impresiones)$/,
  ctr: /^ctr$/,
  position: /^(position|posicion|posicion media|average position)$/,
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Parser CSV mínimo con comillas dobles; detecta `,` o `;` en la cabecera. */
function parseCsvLines(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const header = lines.find((l) => l.trim().length > 0) ?? '';
  const sep = (header.match(/;/g) ?? []).length > (header.match(/,/g) ?? []).length ? ';' : ',';
  const out: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === sep) {
        cells.push(cur);
        cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    out.push(cells.map((c) => c.trim()));
  }
  return out;
}

/** «3,5 %» → 0.035 · «3.6%» → 0.036 · «0.04» → 0.04 · «6,2» → 6.2 */
function parseNumber(raw: string, percent = false): number {
  const cleaned = raw.replace(/\s|%/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  // Redondeo a 6 decimales: «3.6%» → 0.036 exacto, sin residuo binario.
  return percent && (raw.includes('%') || n > 1) ? Math.round((n / 100) * 1e6) / 1e6 : n;
}

export function parseGscCsv(text: string, opts: { defaultDate?: string } = {}): GscRow[] {
  const table = parseCsvLines(text);
  if (table.length === 0) return [];
  const header = table[0].map(fold);
  const col = (key: keyof GscRow): number => header.findIndex((h) => HEADER_ALIASES[key].test(h));
  const idx = {
    date: col('date'),
    page: col('page'),
    query: col('query'),
    clicks: col('clicks'),
    impressions: col('impressions'),
    ctr: col('ctr'),
    position: col('position'),
  };
  if (idx.clicks === -1 || idx.impressions === -1) {
    throw new Error(`CSV sin columnas de clics/impresiones (cabecera: ${table[0].join(' | ')})`);
  }
  const rows: GscRow[] = [];
  for (const cells of table.slice(1)) {
    if (cells.every((c) => c === '')) continue;
    const clicks = parseNumber(cells[idx.clicks] ?? '0');
    const impressions = parseNumber(cells[idx.impressions] ?? '0');
    rows.push({
      date: idx.date >= 0 && cells[idx.date] ? cells[idx.date].slice(0, 10) : (opts.defaultDate ?? ''),
      page: idx.page >= 0 ? (cells[idx.page] ?? '') : '',
      query: idx.query >= 0 ? (cells[idx.query] ?? '') : '',
      clicks,
      impressions,
      ctr: idx.ctr >= 0 && cells[idx.ctr] ? parseNumber(cells[idx.ctr], true) : impressions > 0 ? clicks / impressions : 0,
      position: idx.position >= 0 ? parseNumber(cells[idx.position] ?? '0') : 0,
    });
  }
  return rows;
}

// ── Informe ─────────────────────────────────────────────────────────────────

/** Misma frontera que `gsc-queries.ts`: solo pixeltec.mx / www, nunca subdominios. */
export function isOwnHost(page: string): boolean {
  return page === '' || /^https:\/\/(www\.)?pixeltec\.mx(\/|$)/i.test(page);
}

export function pathOf(page: string): string {
  if (page === '') return NO_PAGE;
  const withoutOrigin = page.replace(/^https:\/\/(www\.)?pixeltec\.mx/i, '');
  return normalizeContentPath(withoutOrigin === '' ? '/' : withoutOrigin) || '/';
}

interface Agg {
  path: string;
  query: string;
  clicks: number;
  impressions: number;
  positionWeighted: number;
}

function aggregate(rows: GscRow[], keyOf: (r: GscRow) => string): Map<string, Agg> {
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const key = keyOf(r);
    const prev = map.get(key) ?? { path: pathOf(r.page), query: r.query, clicks: 0, impressions: 0, positionWeighted: 0 };
    map.set(key, {
      ...prev,
      clicks: prev.clicks + r.clicks,
      impressions: prev.impressions + r.impressions,
      positionWeighted: prev.positionWeighted + r.position * r.impressions,
    });
  }
  return map;
}

const positionOf = (a: Agg): number => (a.impressions === 0 ? 0 : a.positionWeighted / a.impressions);
const ctrOf = (a: Agg): number => (a.impressions === 0 ? 0 : a.clicks / a.impressions);

export function defaultCoveragePaths(): string[] {
  return [...CONTENT_LANDING_PATHS, '/industrias', ...industriesWithPage().map((i) => industryPagePath(i.page))];
}

/** Último día completo de Search Console a partir de una fecha de referencia. */
export function defaultEndsOn(today: Date = new Date()): Date {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - GSC_LAG_DAYS);
  return d;
}

export function buildWeeklyReport(allRows: GscRow[], endsOn: Date, options: ReportOptions = {}): WeeklyReport {
  const thresholds = {
    minImpressions: options.minImpressions ?? DEFAULT_THRESHOLDS.minImpressions,
    newQueryMinImpressions: options.newQueryMinImpressions ?? 5,
    quickWinRange: options.quickWinRange ?? ([4, 15] as [number, number]),
    topPages: options.topPages ?? 20,
  };
  const windows = buildComparisonWindows(endsOn, WINDOW_DAYS);
  const own = allRows.filter((r) => isOwnHost(r.page));
  const current = own.filter((r) => isWithin(windows.current, r.date));
  const previous = own.filter((r) => isWithin(windows.previous, r.date));
  const hasPrevious = previous.length > 0;
  const hasPages = current.some((r) => r.page !== '');

  const qpKey = (r: GscRow) => `${pathOf(r.page)} ${r.query}`;
  const curQP = aggregate(current, qpKey);
  const prevQP = aggregate(previous, qpKey);
  const curQ = aggregate(current, (r) => r.query);
  const prevQ = aggregate(previous, (r) => r.query);
  const curP = aggregate(current, (r) => pathOf(r.page));
  const prevP = aggregate(previous, (r) => pathOf(r.page));

  // 1. Quick wins — consulta×página en zona media con demanda real.
  const [lo, hi] = thresholds.quickWinRange;
  const quickWins: QuickWin[] = [...curQP.values()]
    .filter((a) => a.query !== '' && !isBrandQuery(a.query) && a.impressions >= thresholds.minImpressions)
    .filter((a) => positionOf(a) >= lo && positionOf(a) <= hi)
    .sort((a, b) => b.impressions - a.impressions)
    .map((a) => ({
      path: a.path,
      query: a.query,
      clicks: a.clicks,
      impressions: a.impressions,
      ctr: ctrOf(a),
      position: positionOf(a),
      action: `Poner «${a.query}» en el título, el H1 o el primer párrafo de ${a.path === NO_PAGE ? 'la página que ya rankea' : a.path} y enlazarla desde el home o su hub con ese anchor.`,
    }));

  // 2. CTR bajo — ya arriba, pero nadie hace clic: title/description. La regla
  //    (y su CTR esperable por posición) vive en rules.ts; aquí solo se aplica
  //    por consulta×página.
  const lowCtr: LowCtr[] = [...curQP.values()]
    .filter((a) => a.query !== '' && !isBrandQuery(a.query))
    .flatMap((a) => {
      const finding = ruleImproveCtr(
        { path: a.path, gsc: { clicks: a.clicks, impressions: a.impressions, ctr: ctrOf(a), position: positionOf(a) }, visits: 0, reads: 0, ctaClicks: 0, leads: 0 },
        { ...DEFAULT_THRESHOLDS, minImpressions: thresholds.minImpressions, topPosition: 5 },
      );
      if (!finding) return [];
      return [
        {
          path: a.path,
          query: a.query,
          clicks: a.clicks,
          impressions: a.impressions,
          ctr: ctrOf(a),
          position: positionOf(a),
          message: finding.message,
          action: `Reescribir title y meta description de ${a.path === NO_PAGE ? 'la página' : a.path} con «${a.query}» y un beneficio concreto; no tocar el cuerpo.`,
        },
      ];
    })
    .sort((a, b) => b.impressions - a.impressions);

  // 3. Consultas nuevas — solo con ventana anterior real; la marca no es demanda nueva.
  const newQueries: NewQuery[] = hasPrevious
    ? [...curQ.values()]
        .filter((a) => a.query !== '' && !isBrandQuery(a.query) && a.impressions >= thresholds.newQueryMinImpressions && (prevQ.get(a.query)?.impressions ?? 0) === 0)
        .sort((a, b) => b.impressions - a.impressions)
        .map((a) => {
          const best = [...curQP.values()].filter((x) => x.query === a.query).sort((x, y) => y.impressions - x.impressions)[0];
          return { query: a.query, path: best?.path ?? NO_PAGE, clicks: a.clicks, impressions: a.impressions, position: positionOf(a) };
        })
    : [];

  // 4. Páginas — top por impresiones con delta.
  const pages: PageRow[] = [...curP.values()]
    .filter((a) => a.path !== NO_PAGE)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, thresholds.topPages)
    .map((a) => {
      const p = prevP.get(a.path);
      const imp = delta(a.impressions, p?.impressions ?? 0);
      const clk = delta(a.clicks, p?.clicks ?? 0);
      return {
        path: a.path,
        impressions: { current: imp.current, previous: imp.previous },
        impressionsDelta: formatDelta(imp),
        clicks: { current: clk.current, previous: clk.previous },
        clicksDelta: formatDelta(clk),
        position: { current: a.impressions === 0 ? null : positionOf(a), previous: p && p.impressions > 0 ? positionOf(p) : null },
      };
    });

  // 5. Cobertura — qué landings/industrias no aparecen en Google esta ventana.
  const coveragePaths = options.coveragePaths ?? defaultCoveragePaths();
  const zeroImpressions = hasPages ? coveragePaths.filter((p) => (curP.get(p)?.impressions ?? 0) === 0) : [];

  // 6. Canibalización — la misma consulta reparte impresiones entre ≥ 2 páginas del top 20.
  const byQuery = new Map<string, Agg[]>();
  for (const a of curQP.values()) {
    if (a.query === '' || a.path === NO_PAGE || positionOf(a) > 20) continue;
    byQuery.set(a.query, [...(byQuery.get(a.query) ?? []), a]);
  }
  const cannibalization: Cannibalization[] = [...byQuery.entries()]
    .filter(([, list]) => new Set(list.map((a) => a.path)).size >= 2)
    .sort((a, b) => b[1].reduce((s, x) => s + x.impressions, 0) - a[1].reduce((s, x) => s + x.impressions, 0))
    .map(([query, list]) => ({
      query,
      pages: list
        .sort((a, b) => b.impressions - a.impressions)
        .map((a) => ({ path: a.path, impressions: a.impressions, clicks: a.clicks, position: positionOf(a) })),
    }));

  return {
    generatedFor: windows.current.end,
    windows,
    rowsTotal: allRows.length,
    rowsUsed: current.length + previous.length,
    hasPrevious,
    hasPages,
    thresholds,
    quickWins,
    lowCtr,
    newQueries,
    pages,
    coverage: { tracked: coveragePaths.length, zeroImpressions },
    cannibalization,
  };
}

// ── Markdown ────────────────────────────────────────────────────────────────

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pos = (v: number | null) => (v === null ? '—' : v.toFixed(1));
const cell = (v: string) => v.replace(/\|/g, '\\|');

export function renderMarkdown(r: WeeklyReport): string {
  const lines: string[] = [];
  lines.push(`# Informe semanal de Search Console — pixeltec.mx (${r.generatedFor})`);
  lines.push('');
  lines.push(`- Ventana actual: ${r.windows.current.start} → ${r.windows.current.end} (${r.windows.days} días)`);
  lines.push(
    `- Ventana anterior: ${r.hasPrevious ? `${r.windows.previous.start} → ${r.windows.previous.end}` : 'sin ventana anterior (un solo CSV sin fechas: no hay comparación ni consultas nuevas)'}`,
  );
  lines.push(`- Filas: ${r.rowsUsed} usadas de ${r.rowsTotal} (solo pixeltec.mx/www, dentro de las ventanas)`);
  lines.push(`- Pisos: ≥ ${r.thresholds.minImpressions} impresiones para quick wins y CTR; ≥ ${r.thresholds.newQueryMinImpressions} para consultas nuevas; quick win = posición ${r.thresholds.quickWinRange[0]}–${r.thresholds.quickWinRange[1]}`);
  if (!r.hasPages) lines.push('- El CSV no trae páginas: las secciones por página (4, 5, 6) se omiten; usa `--from-db` o el CSV largo.');
  lines.push('');

  lines.push(`## 1. Quick wins (${r.quickWins.length})`);
  lines.push('');
  if (r.quickWins.length === 0) lines.push('_Ninguna consulta×página en posición media 4–15 con impresiones por encima del piso._');
  else {
    lines.push('| Página | Consulta | Impr. | Clics | CTR | Pos. | Acción |');
    lines.push('|---|---|---:|---:|---:|---:|---|');
    for (const q of r.quickWins) lines.push(`| ${cell(q.path)} | ${cell(q.query)} | ${q.impressions} | ${q.clicks} | ${pct(q.ctr)} | ${pos(q.position)} | ${cell(q.action)} |`);
  }
  lines.push('');

  lines.push(`## 2. CTR bajo (${r.lowCtr.length})`);
  lines.push('');
  if (r.lowCtr.length === 0) lines.push('_Ninguna consulta×página en top 5 con CTR por debajo del esperable._');
  else {
    lines.push('| Página | Consulta | Impr. | CTR | Pos. | Diagnóstico | Acción |');
    lines.push('|---|---|---:|---:|---:|---|---|');
    for (const q of r.lowCtr) lines.push(`| ${cell(q.path)} | ${cell(q.query)} | ${q.impressions} | ${pct(q.ctr)} | ${pos(q.position)} | ${cell(q.message)} | ${cell(q.action)} |`);
  }
  lines.push('');

  lines.push(`## 3. Consultas nuevas (${r.newQueries.length})`);
  lines.push('');
  if (!r.hasPrevious) lines.push('_Sin ventana anterior: no se puede saber qué es nuevo._');
  else if (r.newQueries.length === 0) lines.push('_Ninguna consulta nueva con impresiones por encima del piso._');
  else {
    lines.push('| Consulta | Página que rankea | Impr. | Clics | Pos. |');
    lines.push('|---|---|---:|---:|---:|');
    for (const n of r.newQueries) lines.push(`| ${cell(n.query)} | ${cell(n.path)} | ${n.impressions} | ${n.clicks} | ${pos(n.position)} |`);
  }
  lines.push('');

  lines.push(`## 4. Páginas (top ${r.pages.length})`);
  lines.push('');
  if (r.pages.length === 0) lines.push('_Sin datos por página._');
  else {
    lines.push('| Página | Impr. | Δ impr. | Clics | Δ clics | Pos. | Pos. ant. |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|');
    for (const p of r.pages) lines.push(`| ${cell(p.path)} | ${p.impressions.current} | ${p.impressionsDelta} | ${p.clicks.current} | ${p.clicksDelta} | ${pos(p.position.current)} | ${pos(p.position.previous)} |`);
  }
  lines.push('');

  lines.push(`## 5. Cobertura (${r.coverage.zeroImpressions.length} de ${r.coverage.tracked} sin impresiones)`);
  lines.push('');
  if (!r.hasPages) lines.push('_Requiere datos por página._');
  else if (r.coverage.zeroImpressions.length === 0) lines.push('_Todas las landings y páginas de industria tuvieron impresiones._');
  else for (const p of r.coverage.zeroImpressions) lines.push(`- ${p}`);
  lines.push('');

  lines.push(`## 6. Canibalización (${r.cannibalization.length})`);
  lines.push('');
  if (!r.hasPages) lines.push('_Requiere datos por página._');
  else if (r.cannibalization.length === 0) lines.push('_Ninguna consulta reparte impresiones entre dos páginas del top 20._');
  else {
    for (const c of r.cannibalization) {
      lines.push(`- **${cell(c.query)}** → ${c.pages.map((p) => `${p.path} (${p.impressions} impr., pos. ${pos(p.position)})`).join(' · ')}`);
    }
    lines.push('');
    lines.push('_Decisión con datos (Miguel): consolidar con 301 solo si dos páginas compiten de forma sostenida por la misma intención; vigilar en especial home vs. landings de Puerto Vallarta y /industrias/hoteles vs. /desarrollo-web-puerto-vallarta._');
  }
  lines.push('');
  return lines.join('\n');
}
