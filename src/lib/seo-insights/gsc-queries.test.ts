import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * `gsc-queries.ts` (WO-2026-00219, Fase 2): KPIs y desglose por path de
 * Search Console. La base se mockea completa — nunca se toca Postgres desde
 * un test — devolviendo directamente las filas ya "agregadas" que Postgres
 * habría calculado, para poder probar la aritmética de JS (brand split,
 * consultas nuevas, promedio ponderado de posición) sin un motor SQL real.
 */

const { selectMock, whereMock, groupByMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  whereMock: vi.fn(),
  groupByMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: whereMock,
      })),
    })),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  gscPageDaily: { siteId: {}, date: {}, page: {}, clicks: {}, impressions: {}, ctr: {}, position: {} },
  gscQueryDaily: { siteId: {}, date: {}, page: {}, query: {}, clicks: {}, impressions: {}, ctr: {}, position: {} },
}));

import { getGscKpis, getGscByPath, pathFromGscPage } from "./gsc-queries";
import type { ComparisonWindows } from "./period";

const WINDOWS: ComparisonWindows = {
  current: { start: "2026-08-07", end: "2026-09-03" },
  previous: { start: "2026-07-10", end: "2026-08-06" },
  days: 28,
};

beforeEach(() => {
  vi.clearAllMocks();
  // `pageTotals` termina en `.where(...)` (sin groupBy); `queryTotals` y
  // `getGscByPath` terminan en `.where(...).groupBy(...)`. `whereMock` sirve
  // ambos casos: como valor resuelto directo (pageTotals hace `await` sobre
  // el resultado de `where`) y como objeto con `.groupBy`.
  whereMock.mockReturnValue({ groupBy: groupByMock });
});

describe("pathFromGscPage", () => {
  test("quita el origen de pixeltec.mx", () => {
    expect(pathFromGscPage("https://pixeltec.mx/blog/agente-de-ia")).toBe("/blog/agente-de-ia");
  });

  test("quita el origen con www", () => {
    expect(pathFromGscPage("https://www.pixeltec.mx/blog/agente-de-ia")).toBe("/blog/agente-de-ia");
  });

  test("la raíz del sitio normaliza a '/'", () => {
    expect(pathFromGscPage("https://pixeltec.mx/")).toBe("/");
    expect(pathFromGscPage("https://pixeltec.mx")).toBe("/");
  });
});

describe("getGscKpis", () => {
  test("null cuando no hay ninguna impresión en ninguna ventana", async () => {
    // pageTotals: where() resuelve directo a un array con la fila agregada.
    whereMock.mockResolvedValueOnce([
      { impressionsCurrent: 0, clicksCurrent: 0, impressionsPrevious: 0, clicksPrevious: 0 },
    ]);
    // queryTotals: where().groupBy() resuelve a filas vacías.
    whereMock.mockReturnValueOnce({ groupBy: vi.fn().mockResolvedValue([]) });
    const kpis = await getGscKpis(WINDOWS);
    expect(kpis).toBeNull();
  });

  test("separa impresiones de marca vs. no-marca y cuenta consultas nuevas", async () => {
    whereMock.mockResolvedValueOnce([
      { impressionsCurrent: 500, clicksCurrent: 20, impressionsPrevious: 300, clicksPrevious: 10 },
    ]);
    whereMock.mockReturnValueOnce({
      groupBy: vi.fn().mockResolvedValue([
        // Consulta de marca: cuenta para el total pero no para "no-marca".
        { query: "pixeltec puerto vallarta", impressions: 200, clicks: 15, impressionsPrevious: 150 },
        // Consulta genérica ya conocida (tenía impresiones antes también).
        { query: "automatizar whatsapp negocio", impressions: 180, clicks: 4, impressionsPrevious: 100 },
        // Consulta genérica NUEVA: 0 impresiones en la ventana anterior.
        { query: "cuanto cuesta un chatbot", impressions: 120, clicks: 1, impressionsPrevious: 0 },
      ]),
    });

    const kpis = await getGscKpis(WINDOWS);
    expect(kpis).not.toBeNull();
    expect(kpis!.impressions).toEqual({ current: 500, previous: 300 });
    expect(kpis!.clicks).toEqual({ current: 20, previous: 10 });
    expect(kpis!.ctr.current).toBeCloseTo(20 / 500);
    // No-marca = 180 + 120 (se excluye la de "pixeltec puerto vallarta").
    expect(kpis!.impressionsNonBrand.current).toBe(300);
    // Solo "cuanto cuesta un chatbot" es nueva (0 en la ventana anterior).
    expect(kpis!.newQueries).toBe(1);
  });

  test("CTR null sin impresiones en una de las dos ventanas", async () => {
    whereMock.mockResolvedValueOnce([
      { impressionsCurrent: 100, clicksCurrent: 2, impressionsPrevious: 0, clicksPrevious: 0 },
    ]);
    whereMock.mockReturnValueOnce({ groupBy: vi.fn().mockResolvedValue([]) });
    const kpis = await getGscKpis(WINDOWS);
    expect(kpis!.ctr.current).toBeCloseTo(0.02);
    expect(kpis!.ctr.previous).toBeNull();
  });
});

describe("getGscByPath", () => {
  test("agrega por path normalizado, uniendo pixeltec.mx y www.pixeltec.mx del mismo artículo", async () => {
    whereMock.mockReturnValueOnce({
      groupBy: vi.fn().mockResolvedValue([
        {
          page: "https://pixeltec.mx/blog/agente-de-ia",
          impressionsCurrent: 100,
          clicksCurrent: 5,
          positionWeightedCurrent: 100 * 8, // posición 8 en las 100 impresiones
          impressionsPrevious: 50,
          clicksPrevious: 1,
          positionWeightedPrevious: 50 * 12,
        },
        {
          page: "https://www.pixeltec.mx/blog/agente-de-ia",
          impressionsCurrent: 20,
          clicksCurrent: 1,
          positionWeightedCurrent: 20 * 6,
          impressionsPrevious: 0,
          clicksPrevious: 0,
          positionWeightedPrevious: 0,
        },
      ]),
    });

    const byPath = await getGscByPath(WINDOWS);
    const row = byPath.get("/blog/agente-de-ia");
    expect(row).toBeDefined();
    expect(row!.current.impressions).toBe(120);
    expect(row!.current.clicks).toBe(6);
    // Posición ponderada por impresiones: (100*8 + 20*6) / 120.
    expect(row!.current.position).toBeCloseTo((100 * 8 + 20 * 6) / 120);
    expect(row!.previous.position).toBeCloseTo(12); // solo la fila sin www tenía impresiones previas.
  });

  test("path sin impresiones en ninguna ventana no aparece en el mapa", async () => {
    whereMock.mockReturnValueOnce({ groupBy: vi.fn().mockResolvedValue([]) });
    const byPath = await getGscByPath(WINDOWS);
    expect(byPath.size).toBe(0);
    expect(byPath.get("/blog/lo-que-sea")).toBeUndefined();
  });
});
