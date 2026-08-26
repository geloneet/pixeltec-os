import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Server Actions del Blog (WO-2026-00088): permisos backend (publicar/programar/
 * archivar/eliminar/categorías exigen admin; leer/crear/guardar-borrador exigen
 * solo sesión), validación zod en frontera, transición de estado (incl.
 * `scheduled`), slug único. Todo con `db`/auth/guards mockeados — sin red ni DB
 * real (esta suite corre en cualquier entorno, incluida CI sin Postgres).
 */

const {
  requireUserSessionMock,
  requireAdminMock,
  resolvePostRowMock,
  getUserDisplayNameMock,
  logBlogActivityMock,
  snapshotPostMock,
  uniqueBlogSlugMock,
  upsertBlogCategoryMock,
  deleteBlogCategoryMock,
  deleteBlogPostIfEmptyMock,
  selectResultQueue,
  updateSetMock,
  deleteWhereMock,
} = vi.hoisted(() => {
  const selectResultQueue: unknown[][] = [];
  function selectChain() {
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.where = () => c;
    c.limit = () => c;
    c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(selectResultQueue.shift() ?? []).then(res, rej);
    return c;
  }
  const updateSetMock = vi.fn((_payload: Record<string, unknown>) => ({ where: vi.fn(async () => undefined) }));
  const deleteWhereMock = vi.fn(async () => undefined);
  return {
    requireUserSessionMock: vi.fn(),
    requireAdminMock: vi.fn(),
    resolvePostRowMock: vi.fn(),
    getUserDisplayNameMock: vi.fn(async () => "Miguel"),
    logBlogActivityMock: vi.fn(async () => undefined),
    snapshotPostMock: vi.fn(async () => 1),
    uniqueBlogSlugMock: vi.fn(async (base: string) => base),
    upsertBlogCategoryMock: vi.fn(async () => true),
    deleteBlogCategoryMock: vi.fn(async () => true),
    deleteBlogPostIfEmptyMock: vi.fn(async () => true),
    selectResultQueue,
    updateSetMock,
    deleteWhereMock,
    dbSelectChain: selectChain,
  };
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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => selectChain()),
    update: vi.fn(() => ({ set: updateSetMock })),
    delete: vi.fn(() => ({ where: deleteWhereMock })),
  },
}));
vi.mock("@/lib/db/schema", () => ({ blogPosts: { id: {}, slug: {} } }));
vi.mock("@/lib/auth/session", () => ({ requireUserSession: requireUserSessionMock }));
vi.mock("@/lib/auth-guards", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/blog/pg", () => ({
  resolvePostRow: resolvePostRowMock,
  getUserDisplayName: getUserDisplayNameMock,
}));
vi.mock("@/lib/blog/activity", () => ({ logBlogActivity: logBlogActivityMock }));
vi.mock("@/lib/blog/versions", () => ({
  snapshotPost: snapshotPostMock,
  restoreVersion: vi.fn(async () => ({ restoredVersion: 2 })),
  listVersions: vi.fn(async () => []),
}));
vi.mock("@/lib/blog/ai/generate-post", () => ({
  computeWordCount: (body: string) => body.split(/\s+/).filter(Boolean).length,
  computeReadingTime: (n: number) => Math.max(1, Math.ceil(n / 200)),
  generateSlug: (title: string) =>
    title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-"),
}));
vi.mock("./queries", () => ({
  uniqueBlogSlug: uniqueBlogSlugMock,
  upsertBlogCategory: upsertBlogCategoryMock,
  deleteBlogCategory: deleteBlogCategoryMock,
  deleteBlogPostIfEmpty: deleteBlogPostIfEmptyMock,
}));

import {
  archiveBlogCmsPost,
  createBlogCmsCategory,
  deleteBlogCmsCategory,
  deleteBlogCmsPost,
  discardEmptyBlogCmsDraft,
  saveBlogCmsPost,
  unarchiveBlogCmsPost,
} from "./actions";

const EXISTING = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "articulo-original",
  status: "draft",
  publishedAt: null,
  scheduledAt: null,
  category: "",
  tags: [],
  faq: [],
  seo: {},
  editorial: {},
  ai: {},
  coverImage: null,
  title: "Original",
};

function validSave(overrides: Record<string, unknown> = {}) {
  return {
    id: EXISTING.id,
    title: "Cómo migrar tu inventario a la nube",
    body: "Contenido suficientemente largo para pasar la validación de integridad del guardado.",
    metaDescription: "Resumen breve del artículo para Google.",
    slug: "como-migrar-inventario",
    category: null,
    coverImage: null,
    intent: "draft",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResultQueue.length = 0;
  requireUserSessionMock.mockResolvedValue({ userId: "user-1", email: "staff@pixeltec.mx", role: "staff" });
  requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  resolvePostRowMock.mockResolvedValue({ ...EXISTING });
  uniqueBlogSlugMock.mockImplementation(async (base: string) => base);
});

describe("saveBlogCmsPost — validación zod en frontera", () => {
  test("payload inválido (id no-uuid) → error genérico, sin tocar la DB", async () => {
    const res = await saveBlogCmsPost(validSave({ id: "no-es-un-uuid" }));
    expect(res).toEqual({ ok: false, error: "Datos inválidos. Revisa los campos." });
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  test("intent fuera del enum → rechazado por zod", async () => {
    const res = await saveBlogCmsPost(validSave({ intent: "eliminar" }));
    expect(res.ok).toBe(false);
  });
});

describe("saveBlogCmsPost — permisos backend", () => {
  test("autosave/draft: exige sesión pero NO admin (staff puede)", async () => {
    selectResultQueue.push([EXISTING]);
    const res = await saveBlogCmsPost(validSave({ intent: "draft" }));
    expect(res.ok).toBe(true);
    expect(requireAdminMock).not.toHaveBeenCalled();
    expect(requireUserSessionMock).toHaveBeenCalledTimes(1);
  });

  test("publish sin sesión de admin → 'Solo un administrador puede publicar o programar.', sin escribir", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "forbidden", status: 403 });
    const res = await saveBlogCmsPost(validSave({ intent: "publish" }));
    expect(res).toEqual({ ok: false, error: "Solo un administrador puede publicar o programar." });
    expect(updateSetMock).not.toHaveBeenCalled();
    expect(requireUserSessionMock).not.toHaveBeenCalled();
  });

  test("schedule sin sesión de admin → mismo rechazo que publish", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "forbidden", status: 403 });
    const res = await saveBlogCmsPost(validSave({ intent: "schedule", scheduledAt: "2027-01-01T00:00:00.000Z" }));
    expect(res.ok).toBe(false);
  });

  test("publish con admin: guarda, marca approvedBy y publishedAt", async () => {
    selectResultQueue.push([EXISTING], [{ ...EXISTING, status: "published" }]);
    const res = await saveBlogCmsPost(validSave({ intent: "publish" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.status).toBe("published");
    const setArg = updateSetMock.mock.calls[0][0];
    expect(setArg.status).toBe("published");
    expect(setArg.approvedBy).toBe("admin-1");
    expect(snapshotPostMock).toHaveBeenCalled();
  });
});

describe("saveBlogCmsPost — programación y gate de integridad", () => {
  test("schedule sin fecha futura → mensaje exacto, sin escribir", async () => {
    selectResultQueue.push([EXISTING]);
    const res = await saveBlogCmsPost(validSave({ intent: "schedule", scheduledAt: "2020-01-01T00:00:00.000Z" }));
    expect(res).toEqual({ ok: false, error: "Elige una fecha y hora futuras para programar la entrada." });
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  test("schedule con fecha futura → status scheduled, scheduledAt serializado ISO", async () => {
    selectResultQueue.push([EXISTING], [{ ...EXISTING, status: "scheduled" }]);
    const res = await saveBlogCmsPost(validSave({ intent: "schedule", scheduledAt: "2027-06-01T10:00:00.000Z" }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data?.status).toBe("scheduled");
      expect(res.data?.scheduledAt).toBe("2027-06-01T10:00:00.000Z");
    }
    expect(updateSetMock.mock.calls[0][0].status).toBe("scheduled");
  });

  test("publicar sin título/cuerpo → blockers de integridad, sin escribir", async () => {
    const res = await saveBlogCmsPost(validSave({ intent: "publish", title: "", body: "" }));
    expect(res.ok).toBe(false);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  test("autosave nunca crea revisión ni entra a logBlogActivity", async () => {
    selectResultQueue.push([EXISTING]);
    await saveBlogCmsPost(validSave({ intent: "autosave" }));
    expect(snapshotPostMock).not.toHaveBeenCalled();
    expect(logBlogActivityMock).not.toHaveBeenCalled();
  });
});

describe("saveBlogCmsPost — categoría y slug", () => {
  test("newCategory se crea en el catálogo y gana sobre category", async () => {
    selectResultQueue.push([EXISTING]);
    await saveBlogCmsPost(validSave({ intent: "draft", category: "otra", newCategory: "Automatización" }));
    expect(upsertBlogCategoryMock).toHaveBeenCalledWith("Automatización", "user-1", expect.objectContaining({ slug: "automatizacion" }));
    expect(updateSetMock.mock.calls[0][0].category).toBe("Automatización");
  });

  test("slug pedido pasa por uniqueBlogSlug excluyendo el propio post", async () => {
    selectResultQueue.push([EXISTING]);
    uniqueBlogSlugMock.mockResolvedValueOnce("como-migrar-inventario-2");
    const res = await saveBlogCmsPost(validSave({ intent: "draft", slug: "como-migrar-inventario" }));
    expect(uniqueBlogSlugMock).toHaveBeenCalledWith("como-migrar-inventario", EXISTING.id);
    expect(res.ok && res.data?.slug).toBe("como-migrar-inventario-2");
  });

  test("post inexistente → 'Esta entrada ya no existe.'", async () => {
    selectResultQueue.push([]);
    const res = await saveBlogCmsPost(validSave());
    expect(res).toEqual({ ok: false, error: "Esta entrada ya no existe." });
  });
});

describe("Acciones admin-only: archivar / restaurar / eliminar / categorías", () => {
  test("archiveBlogCmsPost sin admin → error del guard, sin tocar DB", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "forbidden", status: 403 });
    const res = await archiveBlogCmsPost(EXISTING.id);
    expect(res).toEqual({ ok: false, error: "forbidden" });
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  test("archiveBlogCmsPost con admin: status=archived y cancela scheduledAt", async () => {
    const res = await archiveBlogCmsPost(EXISTING.id);
    expect(res.ok).toBe(true);
    expect(updateSetMock.mock.calls[0][0]).toMatchObject({ status: "archived", scheduledAt: null });
  });

  test("unarchiveBlogCmsPost restaura a 'draft', no al estado previo", async () => {
    await unarchiveBlogCmsPost(EXISTING.id);
    expect(updateSetMock.mock.calls[0][0].status).toBe("draft");
  });

  test("deleteBlogCmsPost sin admin → denegado", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "forbidden", status: 403 });
    const res = await deleteBlogCmsPost(EXISTING.id);
    expect(res.ok).toBe(false);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  test("deleteBlogCmsPost con admin: hard delete", async () => {
    const res = await deleteBlogCmsPost(EXISTING.id);
    expect(res.ok).toBe(true);
    expect(deleteWhereMock).toHaveBeenCalled();
  });

  test("createBlogCmsCategory exige admin y nombre válido", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "forbidden", status: 403 });
    expect((await createBlogCmsCategory({ name: "Case Study" })).ok).toBe(false);
    expect(upsertBlogCategoryMock).not.toHaveBeenCalled();

    const ok = await createBlogCmsCategory({ name: "Case Study" });
    expect(ok.ok).toBe(true);

    upsertBlogCategoryMock.mockResolvedValueOnce(false);
    const dup = await createBlogCmsCategory({ name: "Case Study" });
    expect(dup).toEqual({ ok: false, error: "Ya existe una categoría con ese nombre." });
  });

  test("deleteBlogCmsCategory exige admin y un id con forma de uuid", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "forbidden", status: 403 });
    expect((await deleteBlogCmsCategory("cat-1")).ok).toBe(false);

    const badId = await deleteBlogCmsCategory("no-es-uuid");
    expect(badId).toEqual({ ok: false, error: "Categoría inválida." });
    expect(deleteBlogCategoryMock).not.toHaveBeenCalled();

    const good = await deleteBlogCmsCategory("22222222-2222-2222-2222-222222222222");
    expect(good.ok).toBe(true);
  });
});

describe("discardEmptyBlogCmsDraft", () => {
  test("id no-uuid → no-op silencioso (paridad Encino)", async () => {
    const res = await discardEmptyBlogCmsDraft("abc");
    expect(res).toEqual({ ok: true, data: { deleted: false } });
    expect(deleteBlogPostIfEmptyMock).not.toHaveBeenCalled();
  });

  test("borrador vacío real → se descarta", async () => {
    const res = await discardEmptyBlogCmsDraft(EXISTING.id);
    expect(res).toEqual({ ok: true, data: { deleted: true } });
    expect(deleteBlogPostIfEmptyMock).toHaveBeenCalledWith(EXISTING.id);
  });
});
