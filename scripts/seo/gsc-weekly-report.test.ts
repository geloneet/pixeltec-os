import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWeeklyReport, parseGscCsv, renderMarkdown, type GscRow } from './gsc-weekly-report.lib';

/**
 * L5 (WO-2026-00345): informe semanal query×page reproducible con CSV o DB.
 * La fixture cubre cada sección: quick win sí/no por piso y posición, CTR
 * bajo con `expectedCtr` (vía ruleImproveCtr), consulta nueva vs. existente,
 * canibalización, filtro de host y de marca, www→path, fechas fuera de ventana.
 */
const FIXTURE = resolve(__dirname, 'fixtures', 'gsc-sample.csv');
const ENDS_ON = new Date('2026-09-11T00:00:00Z');

function loadFixture(): GscRow[] {
  return parseGscCsv(readFileSync(FIXTURE, 'utf8'), { defaultDate: '2026-09-11' });
}

describe('parseGscCsv', () => {
  it('lee el CSV largo (fecha, página, consulta) con porcentajes y decimales', () => {
    const rows = loadFixture();
    expect(rows).toHaveLength(22);
    expect(rows[0]).toEqual({
      date: '2026-09-01',
      page: 'https://pixeltec.mx/desarrollo-web-puerto-vallarta',
      query: 'desarrollo web puerto vallarta',
      clicks: 12,
      impressions: 400,
      ctr: 0.03,
      position: 6.2,
    });
  });

  it('acepta la exportación nativa de Search Console (Consultas principales, sin fecha ni página) con «;», «%» y coma decimal', () => {
    const csv = ['Consultas principales;Clics;Impresiones;CTR;Posición', 'desarrollo web puerto vallarta;12;400;"3,5 %";"6,2"', '"software, a medida";4;110;3.6%;12'].join('\n');
    const rows = parseGscCsv(csv, { defaultDate: '2026-09-11' });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: '2026-09-11', page: '', query: 'desarrollo web puerto vallarta', ctr: 0.035, position: 6.2 });
    expect(rows[1]).toMatchObject({ query: 'software, a medida', impressions: 110, ctr: 0.036 });
  });

  it('acepta la exportación de Páginas principales (sin consulta) y cabeceras en inglés', () => {
    const rows = parseGscCsv('Top pages,Clicks,Impressions,CTR,Position\nhttps://pixeltec.mx/pixelbot,2,500,0.4%,2.5', { defaultDate: '2026-09-11' });
    expect(rows[0]).toMatchObject({ page: 'https://pixeltec.mx/pixelbot', query: '', clicks: 2, impressions: 500 });
  });

  it('ignora filas vacías y lanza si faltan clics/impresiones', () => {
    expect(parseGscCsv('query,clicks,impressions,ctr,position\n\n', {})).toEqual([]);
    expect(() => parseGscCsv('consulta,ctr\nx,1%', {})).toThrow(/impresiones/i);
  });
});

describe('buildWeeklyReport', () => {
  const report = buildWeeklyReport(loadFixture(), ENDS_ON);

  it('ventanas de 28 días contiguas terminando en endsOn; filas fuera de ventana y de otro host se descartan', () => {
    expect(report.windows.current).toEqual({ start: '2026-08-15', end: '2026-09-11' });
    expect(report.windows.previous).toEqual({ start: '2026-07-18', end: '2026-08-14' });
    expect(report.rowsTotal).toBe(22);
    expect(report.rowsUsed).toBe(19); // − encino (host) − 2 fuera de ventana
    expect(report.hasPrevious).toBe(true);
    expect(JSON.stringify(report)).not.toContain('encino');
  });

  it('quick wins: posición media 4–15, impresiones ≥ piso, sin marca, ordenados por impresiones', () => {
    expect(report.quickWins.map((q) => [q.path, q.query, q.impressions])).toEqual([
      ['/desarrollo-web-puerto-vallarta', 'desarrollo web puerto vallarta', 700],
      ['/services/automatizacion', 'automatizacion de procesos', 120],
      ['/sistemas-a-medida', 'sistemas a medida', 110],
    ]);
    expect(report.quickWins[0].position).toBeCloseTo(6.46, 1);
    expect(report.quickWins[0].clicks).toBe(22);
    expect(report.quickWins[0].action).toMatch(/título|H1|enlace interno/i);
    const keys = report.quickWins.map((q) => q.query);
    expect(keys).not.toContain('pixeltec'); // marca
    expect(keys).not.toContain('automatizacion guadalajara'); // 50 impresiones < piso
    expect(keys).not.toContain('software para clinicas'); // posición 18
  });

  it('CTR bajo: posición ≤ 5 y CTR por debajo del esperable (rules.ts), sin marca', () => {
    expect(report.lowCtr.map((r) => [r.path, r.query])).toEqual([['/pixelbot', 'chatbot whatsapp para empresas']]);
    expect(report.lowCtr[0].ctr).toBeCloseTo(0.004, 3);
    expect(report.lowCtr[0].action).toMatch(/title|description/i);
    expect(report.lowCtr[0].message).toMatch(/esperable/);
  });

  it('consultas nuevas: en la ventana actual, ausentes en la anterior, ≥ 5 impresiones, sin marca', () => {
    expect(report.newQueries.map((n) => [n.query, n.impressions])).toEqual([
      ['sistemas a medida', 110],
      ['software para clinicas', 40],
      ['sistema a la medida', 8],
    ]);
    const names = report.newQueries.map((n) => n.query);
    expect(names).not.toContain('software para hoteles'); // 3 impresiones < piso
    expect(names).not.toContain('desarrollo web puerto vallarta'); // ya existía
    expect(names).not.toContain('contacto pixeltec'); // marca
  });

  it('páginas: top por impresiones con delta y www fusionado al mismo path', () => {
    const pv = report.pages.find((p) => p.path === '/desarrollo-web-puerto-vallarta')!;
    expect(pv.impressions.current).toBe(700);
    expect(pv.impressions.previous).toBe(200);
    expect(pv.impressionsDelta).toBe('+250%');
    expect(pv.clicks.current).toBe(22);
    expect(pv.position.current).toBeCloseTo(6.46, 1);
    expect(report.pages[0].path).toBe('/desarrollo-web-puerto-vallarta');
    expect(report.pages.some((p) => p.path === '/contact')).toBe(true);
    expect(report.pages.length).toBeLessThanOrEqual(20);
  });

  it('cobertura: landings e industrias con 0 impresiones en la ventana actual', () => {
    expect(report.coverage.zeroImpressions).toContain('/desarrollo-web-zapopan');
    expect(report.coverage.zeroImpressions).toContain('/industrias/hoteles');
    expect(report.coverage.zeroImpressions).not.toContain('/sistemas-a-medida');
    expect(report.coverage.zeroImpressions).not.toContain('/automatizacion-guadalajara');
    expect(report.coverage.tracked).toBeGreaterThan(report.coverage.zeroImpressions.length);
  });

  it('canibalización: una consulta con ≥ 2 páginas distintas en el top 20', () => {
    expect(report.cannibalization.map((c) => c.query)).toEqual(['automatizacion de procesos']);
    expect(report.cannibalization[0].pages.map((p) => p.path).sort()).toEqual(['/automatizacion-puerto-vallarta', '/services/automatizacion']);
  });

  it('con un solo CSV sin fechas no hay ventana anterior: sin consultas nuevas y aviso explícito', () => {
    const csv = 'Consultas principales,Clics,Impresiones,CTR,Posición\ndesarrollo web puerto vallarta,12,400,3%,6.2';
    const single = buildWeeklyReport(parseGscCsv(csv, { defaultDate: '2026-09-11' }), ENDS_ON);
    expect(single.hasPrevious).toBe(false);
    expect(single.newQueries).toEqual([]);
    expect(single.quickWins).toHaveLength(1);
    expect(single.quickWins[0].path).toBe('(sin página en el CSV)');
    expect(renderMarkdown(single)).toMatch(/sin ventana anterior/i);
  });
});

describe('renderMarkdown', () => {
  it('imprime las 6 secciones con fecha y ventanas', () => {
    const md = renderMarkdown(buildWeeklyReport(loadFixture(), ENDS_ON));
    for (const h of ['## 1. Quick wins', '## 2. CTR bajo', '## 3. Consultas nuevas', '## 4. Páginas', '## 5. Cobertura', '## 6. Canibalización']) {
      expect(md).toContain(h);
    }
    expect(md).toContain('2026-08-15 → 2026-09-11');
    expect(md).toContain('| /desarrollo-web-puerto-vallarta |');
    expect(md).toContain('chatbot whatsapp para empresas');
  });
});
