import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Capa de lectura/escritura del Blog (WO-2026-00088) — foco en la lógica que
 * no es "un SELECT más": el throttle del barrido de programados (paridad
 * Encino `publishDueScheduledPosts`) y el bucle de unicidad de slug.
 */

const { updateMock, updateSetMock, updateWhereMock, selectResultQueue } = vi.hoisted(() => {
  const selectResultQueue: unknown[][] = [];
  const updateWhereMock = vi.fn(() => ({ returning: vi.fn(async () => updateWhereMock.mock.results.length ? [] : []) }));
  return { updateMock: vi.fn(), updateSetMock: vi.fn(), updateWhereMock, selectResultQueue };
});

function selectChain() {
  const c: Record<string, unknown> = {};
  c.from = () => c;
  c.where = () => c;
  c.limit = () => c;
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(selectResultQueue.shift() ?? []).then(res, rej);
  return c;
}

const returningMock = vi.fn(async () => [] as Array<{ slug: string }>);

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => selectChain()),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: returningMock })),
      })),
    })),
  },
}));
vi.mock("@/lib/db/schema", () => ({
  blogPosts: { id: {}, slug: {}, status: {}, scheduledAt: {}, publishedAt: {}, updatedAt: {}, title: {}, body: {}, coverImage: {}, category: {} },
  blogCategories: { id: {}, name: {}, slug: {}, parentId: {}, description: {} },
  postRedirects: { fromSlug: {}, postId: {} },
}));
vi.mock("@/lib/blog/queries/posts", () => ({ serializePost: vi.fn((r: unknown) => r) }));

import { publishDueScheduledPosts, resetScheduledSweepThrottle, uniqueBlogSlug } from "./queries";

beforeEach(() => {
  vi.clearAllMocks();
  returningMock.mockResolvedValue([]);
  resetScheduledSweepThrottle();
});

describe("publishDueScheduledPosts — barrido en render (paridad Encino)", () => {
  test("publica los slugs devueltos por el UPDATE", async () => {
    returningMock.mockResolvedValueOnce([{ slug: "post-vencido" }, { slug: "otro-post" }]);
    const slugs = await publishDueScheduledPosts({ force: true });
    expect(slugs).toEqual(["post-vencido", "otro-post"]);
  });

  test("throttle: una segunda llamada dentro del minuto no vuelve a tocar la DB", async () => {
    returningMock.mockResolvedValueOnce([{ slug: "a" }]);
    const first = await publishDueScheduledPosts({ now: new Date("2026-08-25T12:00:00.000Z") });
    expect(first).toEqual(["a"]);

    const second = await publishDueScheduledPosts({ now: new Date("2026-08-25T12:00:30.000Z") });
    expect(second).toEqual([]);
    expect(returningMock).toHaveBeenCalledTimes(1);
  });

  test("force ignora el throttle", async () => {
    returningMock.mockResolvedValue([{ slug: "a" }]);
    await publishDueScheduledPosts({ now: new Date("2026-08-25T12:00:00.000Z") });
    const forced = await publishDueScheduledPosts({ now: new Date("2026-08-25T12:00:01.000Z"), force: true });
    expect(forced).toEqual(["a"]);
    expect(returningMock).toHaveBeenCalledTimes(2);
  });

  test("pasado el minuto, vuelve a barrer", async () => {
    returningMock.mockResolvedValue([{ slug: "a" }]);
    await publishDueScheduledPosts({ now: new Date("2026-08-25T12:00:00.000Z") });
    await publishDueScheduledPosts({ now: new Date("2026-08-25T12:01:01.000Z") });
    expect(returningMock).toHaveBeenCalledTimes(2);
  });
});

describe("uniqueBlogSlug — dedupe con sufijo -2, -3… evitando redirects históricos", () => {
  test("slug libre: se devuelve tal cual", async () => {
    selectResultQueue.push([], []); // sin choque de post, sin choque de redirect
    const slug = await uniqueBlogSlug("mi-articulo");
    expect(slug).toBe("mi-articulo");
  });

  test("colisión con un post existente → agrega -2", async () => {
    selectResultQueue.push([{ id: "otro-post" }], []); // choque post, sin choque redirect
    selectResultQueue.push([], []); // mi-articulo-2 libre
    const slug = await uniqueBlogSlug("mi-articulo");
    expect(slug).toBe("mi-articulo-2");
  });

  test("colisión con un redirect histórico también fuerza el siguiente sufijo", async () => {
    selectResultQueue.push([], [{ fromSlug: "mi-articulo" }]); // sin post, pero hay redirect
    selectResultQueue.push([], []); // -2 libre
    const slug = await uniqueBlogSlug("mi-articulo");
    expect(slug).toBe("mi-articulo-2");
  });

  test("más de 50 intentos → lanza (protección contra loops)", async () => {
    for (let i = 0; i < 60; i++) selectResultQueue.push([{ id: "x" }], []);
    await expect(uniqueBlogSlug("colisiona")).rejects.toThrow("No se pudo generar una URL única.");
  });
});
