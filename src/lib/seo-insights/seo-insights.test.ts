import { describe, expect, test } from "vitest";

import { blogSlugFromPath, isContentPath, normalizeContentPath, DEFAULT_THRESHOLDS } from "./config";
import { brandClickShare, isBrandQuery, splitBrandQueries } from "./brand-filter";
import { buildComparisonWindows, daysBetween, delta, formatDelta, isWithin, toDateKey } from "./period";
import { contentRole, landingRole } from "./classify";
import { buildFunnel, isMissingSearchData, worstStep, type FunnelInput } from "./funnel";
import { evaluateRules, ruleDeadContent, ruleImproveCtr, ruleReviewCta, ruleUpdate, type RuleSubject } from "./rules";

// ── config ──────────────────────────────────────────────────────────────────

describe("normalizeContentPath", () => {
  test("descarta query string y fragmento (frontera de privacidad)", () => {
    expect(normalizeContentPath("/blog/x?utm_source=news&email=a@b.mx")).toBe("/blog/x");
    expect(normalizeContentPath("/blog/x#seccion")).toBe("/blog/x");
  });

  test("descarta el origen y la barra final", () => {
    expect(normalizeContentPath("https://pixeltec.mx/blog/x/")).toBe("/blog/x");
    expect(normalizeContentPath("/")).toBe("/");
  });

  test("un path que no empieza por / no es un path", () => {
    expect(normalizeContentPath("javascript:alert(1)")).toBe("");
    expect(normalizeContentPath("")).toBe("");
  });
});

describe("isContentPath", () => {
  test("los artículos del blog son contenido; el índice no", () => {
    expect(isContentPath("/blog/algun-articulo")).toBe(true);
    expect(isContentPath("/blog/")).toBe(false);
    expect(isContentPath("/blog")).toBe(false);
  });

  test("una landing real del registro es contenido", () => {
    expect(isContentPath("/desarrollo-web-puerto-vallarta")).toBe(true);
    expect(isContentPath("/automatizar-whatsapp-business")).toBe(true);
  });

  test("una ruta que no es contenido no lo es", () => {
    expect(isContentPath("/contact")).toBe(false);
    expect(isContentPath("/hoy")).toBe(false);
  });
});

describe("blogSlugFromPath", () => {
  test("extrae el slug solo de /blog/<slug>", () => {
    expect(blogSlugFromPath("/blog/mi-articulo?x=1")).toBe("mi-articulo");
    expect(blogSlugFromPath("/blog/mi-articulo/extra")).toBeNull();
    expect(blogSlugFromPath("/otra-cosa")).toBeNull();
  });
});

// ── brand-filter ────────────────────────────────────────────────────────────

describe("isBrandQuery", () => {
  test("cubre las variantes reales de tecleo", () => {
    for (const q of ["pixeltec", "pixel tec", "pixeltek", "pixel tek", "PIXELTEC PUERTO VALLARTA"]) {
      expect(isBrandQuery(q)).toBe(true);
    }
  });

  test("una consulta genérica no es de marca", () => {
    expect(isBrandQuery("desarrollo web puerto vallarta")).toBe(false);
    expect(isBrandQuery("automatizar whatsapp")).toBe(false);
  });

  test("el regex usa el flag i de JS, no el (?i) en línea de PCRE", () => {
    // Si el patrón llevara `(?i)` literal, esta consulta no casaría.
    expect(isBrandQuery("PixelTec")).toBe(true);
  });
});

describe("splitBrandQueries / brandClickShare", () => {
  const rows = [
    { query: "pixeltec", clicks: 30, impressions: 40 },
    { query: "desarrollo web pv", clicks: 10, impressions: 500 },
  ];

  test("parte conservando el orden", () => {
    const { brand, generic } = splitBrandQueries(rows);
    expect(brand.map((r) => r.query)).toEqual(["pixeltec"]);
    expect(generic.map((r) => r.query)).toEqual(["desarrollo web pv"]);
  });

  test("share de marca sobre el total de clics", () => {
    expect(brandClickShare(rows)).toBeCloseTo(30 / 40);
  });

  test("sin clics devuelve null, no 0 — 'no hay datos' ≠ 'nadie llega por marca'", () => {
    expect(brandClickShare([{ query: "x", clicks: 0, impressions: 100 }])).toBeNull();
  });
});

// ── period ──────────────────────────────────────────────────────────────────

describe("buildComparisonWindows", () => {
  const windows = buildComparisonWindows(new Date("2026-09-03T00:00:00Z"), 28);

  test("la ventana actual incluye el día final y dura exactamente 28 días", () => {
    expect(windows.current.end).toBe("2026-09-03");
    expect(daysBetween(windows.current.start, windows.current.end)).toBe(27);
  });

  test("la anterior es contigua y no se solapa", () => {
    expect(daysBetween(windows.previous.end, windows.current.start)).toBe(1);
    expect(daysBetween(windows.previous.start, windows.previous.end)).toBe(27);
  });

  test("isWithin respeta ambos extremos", () => {
    expect(isWithin(windows.current, windows.current.start)).toBe(true);
    expect(isWithin(windows.current, windows.current.end)).toBe(true);
    expect(isWithin(windows.current, windows.previous.end)).toBe(false);
  });

  test("no lee el reloj: la misma entrada da siempre la misma ventana", () => {
    const again = buildComparisonWindows(new Date("2026-09-03T23:59:59Z"), 28);
    expect(again.current).toEqual(windows.current);
  });

  test("toDateKey trabaja en UTC", () => {
    expect(toDateKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
  });
});

describe("delta", () => {
  test("subida y bajada", () => {
    expect(delta(120, 100)).toMatchObject({ absolute: 20, relative: 0.2, direction: "up" });
    expect(delta(80, 100)).toMatchObject({ absolute: -20, direction: "down" });
    expect(delta(100, 100)).toMatchObject({ absolute: 0, relative: 0, direction: "flat" });
  });

  test("base cero → relative null (nunca +∞% ni +100% inventado)", () => {
    const d = delta(3, 0);
    expect(d.relative).toBeNull();
    expect(d.direction).toBe("up");
    expect(formatDelta(d)).toBe("+3");
  });

  test("sin datos en ninguna ventana → '—'", () => {
    expect(formatDelta(delta(0, 0))).toBe("—");
  });
});

// ── classify ────────────────────────────────────────────────────────────────

describe("contentRole", () => {
  test("deriva de searchIntent", () => {
    expect(contentRole({ seo: { searchIntent: "informational" } })).toBe("awareness");
    expect(contentRole({ seo: { searchIntent: "commercial-investigation" } })).toBe("consideration");
    expect(contentRole({ seo: { searchIntent: "transactional" } })).toBe("commercial");
  });

  test("navigational cuenta como awareness (marca, no demanda nueva)", () => {
    expect(contentRole({ seo: { searchIntent: "navigational" } })).toBe("awareness");
  });

  test("sin intención declarada → awareness, el default conservador", () => {
    expect(contentRole({ seo: { searchIntent: "" } })).toBe("awareness");
    expect(contentRole({ seo: {} })).toBe("awareness");
    expect(contentRole(null)).toBe("awareness");
  });

  test("el override explícito gana sobre la derivación", () => {
    expect(contentRole({ seo: { searchIntent: "informational", contentRole: "commercial" } })).toBe("commercial");
  });

  test("un override basura se ignora en vez de propagarse", () => {
    expect(contentRole({ seo: { searchIntent: "transactional", contentRole: "vender-mucho" } })).toBe("commercial");
  });
});

describe("landingRole", () => {
  test("por CTA: /contact es comercial, /diagnostico consideración", () => {
    expect(landingRole({ ctaHref: "/contact" })).toBe("commercial");
    expect(landingRole({ ctaHref: "/diagnostico" })).toBe("consideration");
  });
});

// ── funnel ──────────────────────────────────────────────────────────────────

function funnelInput(over: Partial<FunnelInput> = {}): FunnelInput {
  return {
    path: "/blog/x",
    gscPage: { clicks: 100, impressions: 2000, ctr: 0.05, position: 4 },
    events: { views: 80, reads: 40, ctaClicks: 8 },
    leads: { total: 2, qualified: 1 },
    ...over,
  };
}

describe("buildFunnel", () => {
  test("siete pasos en orden", () => {
    const steps = buildFunnel(funnelInput());
    expect(steps.map((s) => s.key)).toEqual([
      "impressions",
      "clicks",
      "visits",
      "reads",
      "cta_clicks",
      "leads",
      "qualified",
    ]);
  });

  test("la conversión encadena con el paso anterior", () => {
    const steps = buildFunnel(funnelInput());
    expect(steps[0].conversion).toBeNull(); // primer paso: sin base
    expect(steps[1].conversion).toBeCloseTo(100 / 2000);
    expect(steps[2].conversion).toBeCloseTo(80 / 100);
    expect(steps[3].dropoff).toBeCloseTo(1 - 40 / 80);
  });

  test("sin GSC los dos primeros pasos son null, NO 0", () => {
    const steps = buildFunnel(funnelInput({ gscPage: null }));
    expect(steps[0].value).toBeNull();
    expect(steps[1].value).toBeNull();
    expect(isMissingSearchData(steps)).toBe(true);
    // …y la cadena sigue siendo correcta desde visitas.
    expect(steps[2].conversion).toBeNull();
    expect(steps[3].conversion).toBeCloseTo(40 / 80);
  });

  test("cero medido sí es cero (distinto de null)", () => {
    const steps = buildFunnel(
      funnelInput({ gscPage: { clicks: 0, impressions: 0, ctr: 0, position: 0 } })
    );
    expect(steps[0].value).toBe(0);
    expect(isMissingSearchData(steps)).toBe(false);
  });

  test("worstStep señala la mayor caída, o null sin datos suficientes", () => {
    const steps = buildFunnel(funnelInput());
    expect(worstStep(steps)?.key).toBe("clicks"); // 2000 → 100
    const barren = buildFunnel(
      funnelInput({ gscPage: null, events: { views: 0, reads: 0, ctaClicks: 0 }, leads: { total: 0, qualified: 0 } })
    );
    expect(worstStep(barren)).toBeNull();
  });
});

// ── rules ───────────────────────────────────────────────────────────────────

function subject(over: Partial<RuleSubject> = {}): RuleSubject {
  return {
    path: "/blog/x",
    gsc: { clicks: 20, impressions: 1000, ctr: 0.02, position: 12 },
    visits: 100,
    reads: 50,
    ctaClicks: 5,
    leads: 1,
    ...over,
  };
}

describe("ruleUpdate", () => {
  test("dispara en la zona media con demanda", () => {
    expect(ruleUpdate(subject())?.rule).toBe("update");
  });

  test("no dispara por debajo del piso de impresiones", () => {
    expect(ruleUpdate(subject({ gsc: { clicks: 0, impressions: 3, ctr: 0, position: 12 } }))).toBeNull();
  });

  test("no dispara si ya está arriba ni si está fuera de juego", () => {
    expect(ruleUpdate(subject({ gsc: { clicks: 200, impressions: 1000, ctr: 0.2, position: 2 } }))).toBeNull();
    expect(ruleUpdate(subject({ gsc: { clicks: 1, impressions: 1000, ctr: 0.001, position: 60 } }))).toBeNull();
  });

  test("sin GSC no opina", () => {
    expect(ruleUpdate(subject({ gsc: null }))).toBeNull();
  });
});

describe("ruleImproveCtr", () => {
  test("posición alta + CTR bajo → dispara", () => {
    const f = ruleImproveCtr(subject({ gsc: { clicks: 10, impressions: 1000, ctr: 0.01, position: 2 } }));
    expect(f?.rule).toBe("improve_ctr");
    expect(f?.severity).toBe("high");
  });

  test("CTR sano para su posición → no dispara", () => {
    expect(ruleImproveCtr(subject({ gsc: { clicks: 300, impressions: 1000, ctr: 0.3, position: 2 } }))).toBeNull();
  });

  test("posición baja no es asunto de esta regla", () => {
    expect(ruleImproveCtr(subject({ gsc: { clicks: 1, impressions: 1000, ctr: 0.001, position: 30 } }))).toBeNull();
  });
});

describe("ruleReviewCta", () => {
  test("lee pero no pulsa → dispara, y no necesita GSC", () => {
    const f = ruleReviewCta(subject({ gsc: null, ctaClicks: 0 }));
    expect(f?.rule).toBe("review_cta");
  });

  test("con clics de CTA no dispara", () => {
    expect(ruleReviewCta(subject({ ctaClicks: 1 }))).toBeNull();
  });

  test("por debajo del piso de visitas no opina", () => {
    expect(ruleReviewCta(subject({ visits: DEFAULT_THRESHOLDS.minVisits - 1, ctaClicks: 0 }))).toBeNull();
  });

  test("sin lecturas completas no es problema de CTA", () => {
    expect(ruleReviewCta(subject({ reads: 0, ctaClicks: 0 }))).toBeNull();
  });
});

describe("ruleDeadContent", () => {
  test("cero impresiones y cero visitas → dispara", () => {
    const f = ruleDeadContent(subject({ gsc: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, visits: 0 }));
    expect(f?.rule).toBe("dead_content");
    expect(f?.message).toContain("Cero impresiones");
  });

  test("sin GSC el mensaje NO afirma que esté fuera del índice", () => {
    const f = ruleDeadContent(subject({ gsc: null, visits: 0 }));
    expect(f?.message).toContain("Sin Search Console conectado");
  });

  test("con visitas no está muerto", () => {
    expect(ruleDeadContent(subject({ gsc: null, visits: 1 }))).toBeNull();
  });
});

describe("evaluateRules", () => {
  test("puede devolver varios hallazgos, ordenados por severidad", () => {
    const findings = evaluateRules(
      subject({ gsc: { clicks: 5, impressions: 5000, ctr: 0.001, position: 12 }, ctaClicks: 0 })
    );
    expect(findings.length).toBeGreaterThan(1);
    expect(findings[0].severity).toBe("high");
  });

  test("un contenido sano no genera ruido", () => {
    const findings = evaluateRules(
      subject({ gsc: { clicks: 300, impressions: 1000, ctr: 0.3, position: 2 }, ctaClicks: 20 })
    );
    expect(findings).toEqual([]);
  });

  test("los pisos son configurables por llamada", () => {
    const strict = { ...DEFAULT_THRESHOLDS, minImpressions: 10_000 };
    expect(evaluateRules(subject(), strict).some((f) => f.rule === "update")).toBe(false);
  });
});
