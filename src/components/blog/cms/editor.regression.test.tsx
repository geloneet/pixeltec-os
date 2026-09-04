// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EMPTY_EDITORIAL, EMPTY_SEO, type BlogPostSerialized } from "@/lib/blog/types";
import type { BlogPostVersionMeta } from "@/lib/blog/versions";

/**
 * WO-2026-00206 — regresión: el popup «crear con IA» del editor de blog
 * dejaba de responder (se cerraba solo, perdiendo lo escrito) al crear una
 * entrada nueva. Causa raíz: `src/app/(admin)/blog-cms/[id]/editar/page.tsx`
 * remontaba `<BlogCmsEditor key={post.updatedAt}>` en CUALQUIER revalidación
 * en segundo plano de la página `force-dynamic` (verificado en vivo, dev y
 * build de producción: el editor se remonta por completo ~20-30s después de
 * abrirlo sin que el usuario haga nada, aunque `post.updatedAt` no cambie de
 * VALOR — el remonte lo dispara el router de Next, no el key en sí) — cada
 * remonte reiniciaba `aiOpen`/`step` del wizard y descartaba el brief que el
 * usuario llevaba escrito. El fix quita ese `key` y hace que «Restaurar
 * revisión» (el único caso que sí necesita releer `post` en el formulario)
 * resincronice el estado local explícitamente en vez de depender de un
 * remontaje completo (ver `restoringRef`/`syncFormFromPost` en editor.tsx).
 *
 * Un test de React puro no puede reproducir el remontaje que dispara el
 * propio App Router de Next.js (eso se verificó en vivo, en navegador, contra
 * dev y contra un build de producción local — ver bitácora del WO). Lo que sí
 * se puede — y se prueba aquí — es el contrato exacto que evita el bug:
 * (1) page.tsx ya no ata el remontaje a un dato que el servidor puede refrescar
 *     solo (`post.updatedAt`);
 * (2) el estado local de BlogCmsEditor (wizard abierto + brief escrito)
 *     sobrevive a un refresco de props ordinario (sin key nuevo) — que es
 *     justo lo que antes destruía un remontaje espurio;
 * (3) «Restaurar revisión» sigue reflejando el contenido restaurado en el
 *     formulario aunque ya no remonte el componente.
 */

const { toastMock, actionsMock, aiMock, routerMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
  actionsMock: {
    discardEmptyBlogCmsDraft: vi.fn().mockResolvedValue({ ok: true, data: { deleted: false } }),
    restoreBlogCmsRevision: vi.fn(),
    saveBlogCmsPost: vi.fn(),
  },
  aiMock: {
    generateBlogCmsArticle: vi.fn(),
    generateBlogCmsFaq: vi.fn(),
  },
  routerMock: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/blog-cms/actions", () => actionsMock);
vi.mock("@/lib/blog-cms/ai", () => aiMock);
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
// El editor real usa Tiptap vía next/dynamic — se sustituye por un stub
// mínimo controlado; no es lo que este WO prueba (eso lo cubre el smoke en
// navegador real, ver bitácora).
vi.mock("@/components/blog/rich-markdown-editor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (md: string) => void }) => (
    <textarea aria-label="Cuerpo (stub)" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
// UnsplashPicker importa `searchCoverImages` (server action con
// `requireUserSession` → next-auth), que no resuelve en el entorno de test —
// ajeno a lo que este WO prueba (ver bitácora: backend de Unsplash sin
// cambios en WO-2026-00198).
vi.mock("@/components/blog/cms/unsplash-picker", () => ({
  UnsplashPicker: () => null,
}));

import { BlogCmsEditor } from "./editor";

function fullPost(overrides: Partial<BlogPostSerialized> = {}): BlogPostSerialized {
  return {
    id: "post-1",
    slug: "articulo-de-prueba",
    title: "Título original",
    excerpt: "Extracto de prueba.",
    body: "Cuerpo original.",
    category: "arquitectura",
    tags: [],
    coverImage: null,
    author: { name: "Administrador", uid: "uid-1" },
    status: "draft",
    briefSource: { topic: "", angle: "", targetAudience: "", keyPoints: [], tone: "" },
    ai: { model: "", generatedAt: "2026-08-04T00:00:00.000Z", editedByHuman: false, wordsAdded: 0, iterations: 0 },
    seo: { ...EMPTY_SEO },
    editorial: { ...EMPTY_EDITORIAL },
    sources: [],
    internalLinks: [],
    wordCount: 0,
    readingTimeMin: 0,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    publishedAt: null,
    scheduledAt: null,
    faq: [],
    mapsEmbed: null,
    aiParams: null,
    approvedBy: null,
    ...overrides,
  };
}

const REVISIONS: BlogPostVersionMeta[] = [
  { id: "v2", version: 2, reason: "draft", title: "Título original", bodyLength: 10, excerptLength: 5, createdByName: "Administrador", createdAt: "2026-09-03T00:00:00.000Z" },
  { id: "v1", version: 1, reason: "draft", title: "Título viejo", bodyLength: 8, excerptLength: 4, createdByName: "Administrador", createdAt: "2026-09-02T00:00:00.000Z" },
];

beforeEach(() => {
  Object.values(toastMock).forEach((fn) => fn.mockReset());
  actionsMock.discardEmptyBlogCmsDraft.mockReset().mockResolvedValue({ ok: true, data: { deleted: false } });
  actionsMock.restoreBlogCmsRevision.mockReset();
  actionsMock.saveBlogCmsPost.mockReset();
  aiMock.generateBlogCmsArticle.mockReset();
  aiMock.generateBlogCmsFaq.mockReset();
  routerMock.replace.mockReset();
  routerMock.refresh.mockReset();
});
afterEach(() => cleanup());

describe("page.tsx ya no remonta BlogCmsEditor con un key derivado de datos revalidables", () => {
  const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const pageSrc = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/(admin)/blog-cms/[id]/editar/page.tsx"),
    "utf8"
  );

  it("no pasa key={post.updatedAt} (ni ningún key) a <BlogCmsEditor>", () => {
    const call = pageSrc.slice(pageSrc.indexOf("<BlogCmsEditor"), pageSrc.indexOf("/>", pageSrc.indexOf("<BlogCmsEditor")));
    expect(call).not.toMatch(/\bkey\s*=/);
  });
});

describe("el wizard «Con IA» sobrevive a un refresco de props que no cambia identidad (revalidación en segundo plano)", () => {
  it("el brief escrito y el wizard abierto no se pierden si BlogCmsEditor recibe un `post` nuevo (misma entrada) sin remontarse", async () => {
    const post = fullPost();
    const { rerender } = render(
      <BlogCmsEditor post={post} categories={[]} revisions={[]} isAdmin startWithAi viewCount={0} />
    );

    const brief = await screen.findByPlaceholderText("¿De qué trata el artículo? Puntos clave, contexto, objetivo…");
    fireEvent.change(brief, { target: { value: "Brief de prueba con más de diez caracteres" } });
    expect((brief as HTMLTextAreaElement).value).toBe("Brief de prueba con más de diez caracteres");

    // Simula exactamente lo que Next.js hace al revalidar la página en
    // segundo plano: el Server Component vuelve a construir `post` (objeto
    // NUEVO, mismo contenido) y BlogCmsEditor se re-renderiza con esas props
    // — SIN remontarse (page.tsx ya no le pone un key nuevo). Antes del fix,
    // el remonte real de Next perdía todo esto; aquí se comprueba que, sin
    // ese remonte forzado, el estado local del componente sencillamente
    // sobrevive — que es justo la garantía que rompía el bug.
    const revalidatedPost = fullPost();
    rerender(<BlogCmsEditor post={revalidatedPost} categories={[]} revisions={[]} isAdmin startWithAi viewCount={0} />);

    expect(screen.getByPlaceholderText("¿De qué trata el artículo? Puntos clave, contexto, objetivo…")).toBeTruthy();
    expect((screen.getByPlaceholderText("¿De qué trata el artículo? Puntos clave, contexto, objetivo…") as HTMLTextAreaElement).value).toBe(
      "Brief de prueba con más de diez caracteres"
    );
  });

  it("startWithAi=false (entrada YA existente, WO-2026-00198) — el wizard no se abre solo, y sigue cerrado tras un refresco de props", async () => {
    const post = fullPost({ status: "published", title: "Entrada publicada" });
    const { rerender } = render(
      <BlogCmsEditor post={post} categories={[]} revisions={[]} isAdmin startWithAi={false} viewCount={0} />
    );

    await waitFor(() => expect(screen.queryByText(/Generar con IA/)).toBeNull());

    rerender(<BlogCmsEditor post={fullPost({ status: "published", title: "Entrada publicada" })} categories={[]} revisions={[]} isAdmin startWithAi={false} viewCount={0} />);

    expect(screen.queryByText(/Generar con IA/)).toBeNull();
  });
});

describe("«Restaurar revisión» sigue reflejando el contenido restaurado sin remontar el editor", () => {
  it("tras Restaurar, el título del formulario refleja el `post` restaurado (sync explícito, no key)", async () => {
    actionsMock.restoreBlogCmsRevision.mockResolvedValue({ ok: true, data: { restoredVersion: 1 } });

    const post = fullPost();
    const { rerender } = render(
      <BlogCmsEditor post={post} categories={[]} revisions={REVISIONS} isAdmin startWithAi={false} viewCount={0} />
    );

    const titleInput = screen.getByPlaceholderText("Título de la entrada") as HTMLInputElement;
    expect(titleInput.value).toBe("Título original");

    fireEvent.click(screen.getByText("Restaurar"));

    await waitFor(() => expect(actionsMock.restoreBlogCmsRevision).toHaveBeenCalledWith("post-1", "v1"));
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));

    // Lo que hace `router.refresh()` en la app real: el Server Component trae
    // un `post` fresco con el contenido restaurado. Aquí se simula ese
    // refresco de props (mismo componente, sin remontar).
    const restoredPost = fullPost({ title: "Título viejo", body: "Cuerpo viejo restaurado" });
    rerender(<BlogCmsEditor post={restoredPost} categories={[]} revisions={REVISIONS} isAdmin startWithAi={false} viewCount={0} />);

    await waitFor(() => expect((screen.getByPlaceholderText("Título de la entrada") as HTMLInputElement).value).toBe("Título viejo"));
  });
});
