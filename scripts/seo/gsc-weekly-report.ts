#!/usr/bin/env -S npx tsx
/**
 * Informe semanal de Search Console (WO-2026-00345, L5).
 *
 *   # Con un CSV exportado de Search Console (Rendimiento → Consultas o Páginas → Exportar):
 *   npx tsx scripts/seo/gsc-weekly-report.ts --csv ~/Downloads/Consultas.csv --out docs/seo/gsc-weekly/2026-W38.md
 *   # Con dos CSV (ventana actual y anterior) para tener consultas nuevas y deltas:
 *   npx tsx scripts/seo/gsc-weekly-report.ts --csv actual.csv --prev anterior.csv
 *   # Contra la base de datos (en el VPS, con DATABASE_URL; misma NODE_OPTIONS que `npm test`):
 *   NODE_OPTIONS=--no-experimental-webstorage npx tsx scripts/seo/gsc-weekly-report.ts --from-db --out docs/seo/gsc-weekly/2026-W38.md
 *
 * Opciones: --ends-on YYYY-MM-DD (último día incluido; por defecto hoy − GSC_LAG_DAYS),
 *           --min-impressions N (piso de quick wins/CTR), --json (imprime el objeto en vez de markdown).
 *
 * Solo lee. Los informes generados NO se versionan salvo que Miguel lo pida
 * (ver docs/seo/gsc-weekly/README.md).
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { addDays, toDateKey } from '../../src/lib/seo-insights/period';
import { WINDOW_DAYS } from '../../src/lib/seo-insights/config';
import { buildWeeklyReport, defaultEndsOn, parseGscCsv, renderMarkdown, type GscRow } from './gsc-weekly-report.lib';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function rowsFromDb(endsOn: Date): Promise<GscRow[]> {
  // Import dinámico: el cliente de Postgres solo se carga con --from-db.
  const [{ db }, { gscQueryDaily }, { and, eq, gte, lte }, { SITE_ID }] = await Promise.all([
    import('../../src/lib/db'),
    import('../../src/lib/db/schema'),
    import('drizzle-orm'),
    import('../../src/lib/seo-insights/config'),
  ]);
  const start = toDateKey(addDays(endsOn, -(WINDOW_DAYS * 2 - 1)));
  const end = toDateKey(endsOn);
  const rows = await db
    .select({
      date: gscQueryDaily.date,
      page: gscQueryDaily.page,
      query: gscQueryDaily.query,
      clicks: gscQueryDaily.clicks,
      impressions: gscQueryDaily.impressions,
      ctr: gscQueryDaily.ctr,
      position: gscQueryDaily.position,
    })
    .from(gscQueryDaily)
    .where(and(eq(gscQueryDaily.siteId, SITE_ID), gte(gscQueryDaily.date, start), lte(gscQueryDaily.date, end)));
  return rows.map((r) => ({ ...r, date: String(r.date).slice(0, 10) }));
}

async function main() {
  const endsOn = arg('ends-on') ? new Date(`${arg('ends-on')}T00:00:00Z`) : defaultEndsOn();
  if (Number.isNaN(endsOn.getTime())) throw new Error('--ends-on debe ser YYYY-MM-DD');

  let rows: GscRow[];
  if (flag('from-db')) {
    if (!process.env.DATABASE_URL) throw new Error('--from-db requiere DATABASE_URL');
    rows = await rowsFromDb(endsOn);
  } else if (arg('csv')) {
    rows = parseGscCsv(readFileSync(resolve(arg('csv')!), 'utf8'), { defaultDate: toDateKey(endsOn) });
    const prev = arg('prev');
    if (prev) {
      // El CSV anterior se fecha en el último día de la ventana anterior.
      const previousEnd = toDateKey(addDays(endsOn, -WINDOW_DAYS));
      rows = [...rows, ...parseGscCsv(readFileSync(resolve(prev), 'utf8'), { defaultDate: previousEnd })];
    }
  } else {
    console.error('Uso: gsc-weekly-report.ts (--csv <archivo> [--prev <archivo>] | --from-db) [--out <ruta.md>] [--json] [--ends-on YYYY-MM-DD] [--min-impressions N]');
    process.exit(2);
  }

  const minImpressions = arg('min-impressions') ? Number(arg('min-impressions')) : undefined;
  const report = buildWeeklyReport(rows, endsOn, { minImpressions });
  const output = flag('json') ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);

  const out = arg('out');
  if (out) {
    const target = resolve(out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, output);
    console.log(`informe escrito en ${out} (${report.quickWins.length} quick wins · ${report.lowCtr.length} CTR bajo · ${report.newQueries.length} nuevas · ${report.cannibalization.length} canibalizaciones)`);
  } else {
    process.stdout.write(output);
  }
  if (flag('from-db')) process.exit(0); // cierra el pool de Postgres
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
