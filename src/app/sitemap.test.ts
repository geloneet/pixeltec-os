import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * sitemap.xml (WO-2026-00348): `lastModified` veraz. El 2026-09-14 cambiaron en
 * producción la portada, /services (+ sus 3 páginas), /blog, /about, /contact y
 * las landings de ciudad que ganaron sección «Trabajo real» (`localProof`).
 * Todo lo demás conserva su fecha. La DB no se toca: se mockean las queries.
 */

const { getFlagMock } = vi.hoisted(() => ({
  getFlagMock: vi.fn(async (_key: string, fallback = false) => fallback),
}));

vi.mock("@/lib/blog/queries/posts", () => ({ getPublishedPosts: vi.fn(async () => []) }));
vi.mock("@/lib/blog-cms/queries", () => ({ publishDueScheduledPosts: vi.fn(async () => []) }));
vi.mock("@/lib/settings/queries", () => ({ getFlag: getFlagMock }));

import sitemap from "./sitemap";
import { SITE } from "@/lib/site-config";
import { LOCAL_AUTOMATION_CITIES } from "@/lib/content/automatizacion-local";
import { DESARROLLO_WEB_CITIES, CONSULTORIA_CITIES } from "@/lib/content/local-services";

const CHANGED_ON = "2026-09-14";
const CITY_BASELINE = "2026-08-28";

type Entry = Awaited<ReturnType<typeof sitemap>>[number];

function isoDay(value: Entry["lastModified"]): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value?.toString().slice(0, 10);
}

function lastModOf(entries: Entry[], path: string): string | undefined {
  const url = path === "/" ? SITE.url : `${SITE.url}${path}`;
  const entry = entries.find((e) => e.url === url);
  if (!entry) throw new Error(`sitemap sin entrada para ${url}`);
  return isoDay(entry.lastModified);
}

beforeEach(() => {
  vi.clearAllMocks();
  getFlagMock.mockImplementation(async (_key: string, fallback = false) => fallback);
});

describe("sitemap — lastModified veraz tras los cambios del 2026-09-14", () => {
  test.each([
    "/",
    "/services",
    "/services/ecosistemas-web",
    "/services/automatizacion",
    "/services/consultoria",
    "/blog",
    "/about",
    "/contact",
    "/industrias",
  ])("%s ⇒ 2026-09-14", async (path) => {
    const entries = await sitemap();
    expect(lastModOf(entries, path)).toBe(CHANGED_ON);
  });

  test("landing con localProof ⇒ 2026-09-14; sin localProof ⇒ 2026-08-28", async () => {
    const entries = await sitemap();
    expect(lastModOf(entries, "/desarrollo-web-guadalajara")).toBe(CHANGED_ON);
    expect(lastModOf(entries, "/desarrollo-web-zapopan")).toBe(CITY_BASELINE);
  });

  test("la fecha de cada ciudad se deriva del registro, no de una lista a mano", async () => {
    const entries = await sitemap();
    const cities = [...LOCAL_AUTOMATION_CITIES, ...DESARROLLO_WEB_CITIES, ...CONSULTORIA_CITIES];
    expect(cities.some((c) => c.localProof)).toBe(true);
    expect(cities.some((c) => !c.localProof)).toBe(true);
    for (const city of cities) {
      expect(lastModOf(entries, `/${city.slug}`), city.slug).toBe(city.localProof ? CHANGED_ON : CITY_BASELINE);
    }
  });

  test("lo que no cambió conserva su fecha: /pixelbot sigue en 2026-08-04", async () => {
    const entries = await sitemap();
    expect(lastModOf(entries, "/pixelbot")).toBe("2026-08-04");
    expect(lastModOf(entries, "/diagnostico")).toBe("2026-07-09");
    expect(lastModOf(entries, "/equipo")).toBe("2026-06-16");
    expect(lastModOf(entries, "/aviso-de-privacidad")).toBe("2026-04-01");
    expect(lastModOf(entries, "/industrias/clinicas-dentales")).toBe(CHANGED_ON);
  });

  test("total sin blog: 12 estáticas + 3 servicios + 2 industrias + 12 ciudades + 26 keyword = 55", async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(55);
    expect(new Set(entries.map((e) => e.url)).size).toBe(55);
  });

  test("interruptor apagado ⇒ solo la portada", async () => {
    getFlagMock.mockResolvedValueOnce(false);
    const entries = await sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe(SITE.url);
  });
});
