import { describe, expect, test, vi, beforeEach } from "vitest";
import { SafeUserError } from "@/lib/ai/errors";
import { PixelforgeRunError } from "@/lib/pixelforge/ai/failures";

/**
 * Saneamiento de errores en las Server Actions de PixelForge — los 11 puntos de
 * G-04 de este archivo (E0f-3a).
 *
 * Vive aparte de `actions.test.ts` (que cubre `KIND_SCHEMAS`) porque aquí hace
 * falta mockear el repo, la base y el almacenamiento, y ese entorno no debe
 * contaminar al otro suite.
 *
 * El valor de retorno de una Server Action es tan público como una respuesta
 * HTTP: los paneles lo pintan literalmente con `toast.error(r.error ?? …)`.
 * Cada caso ejercita el `catch` real haciendo que `auth()` rechace —un fallo de
 * infraestructura anterior a la validación, que es justo el camino por el que
 * antes salían SQL y stacks—.
 */

const { authMock, uploadReferenceImageMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  uploadReferenceImageMock: vi.fn(),
}));

const repo = vi.hoisted(() => ({
  createPixelforgeProject: vi.fn(),
  addContextSource: vi.fn(),
  updateArtifactDraft: vi.fn(),
  sealArtifact: vi.fn(),
  reopenArtifact: vi.fn(),
  setRunUserDecision: vi.fn(),
  addVisualReference: vi.fn(),
  createReferenceAsset: vi.fn(),
  removeVisualReference: vi.fn(),
  chooseDirection: vi.fn(),
}));

vi.mock("@/lib/auth/config", () => ({ auth: authMock }));
vi.mock("@/lib/db/repos/pixelforge", () => repo);
vi.mock("@/lib/db/repos/definitions", () => ({ getDefinitionFull: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/db/schema", () => ({ clients: {} }));
vi.mock("@/lib/pixelforge/visual/storage", () => ({
  uploadReferenceImage: uploadReferenceImageMock,
}));
vi.mock("@/lib/pixelforge/visual/safe-fetch", () => ({ safeFetch: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addContextSourceAction,
  updateArtifactDraftAction,
  sealArtifactByKindAction,
  reopenArtifactByKindAction,
  setRunDecisionAction,
  chooseDirectionAction,
  addUrlReferenceAction,
  addImageReferenceAction,
  addNoteReferenceAction,
  removeReferenceAction,
} from "./actions";

const UUID = "11111111-1111-4111-8111-111111111111";

const RAW_SQL = "SELECT * FROM pixelforge_artifacts WHERE project_id = $1";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";
const TOKEN_PRIVADO = "EAAG9ZBx0kZCZBsBO1ZC7tokenprivadodemeta";
const ENV_SECRET_NAME = "DATABASE_URL";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/db/index.ts:42:11)";
const PROVIDER_BODY = '{"error":{"message":"prompt: Eres un experto en landings..."}}';

const MARCADORES = [
  RAW_SQL,
  CLIENTE_CONFIDENCIAL,
  TOKEN_PRIVADO,
  ENV_SECRET_NAME,
  STACK_INTERNO,
  PROVIDER_BODY,
];

const MESSAGE_ENVENENADO = [
  STACK_INTERNO,
  RAW_SQL,
  `env ${ENV_SECRET_NAME} is not set`,
  CLIENTE_CONFIDENCIAL,
  `token=${TOKEN_PRIVADO}`,
  PROVIDER_BODY,
].join(" | ");

function sinFugas(result: unknown) {
  const salida = JSON.stringify(result);
  for (const marcador of MARCADORES) {
    expect(salida).not.toContain(marcador);
  }
}

type ActionResult = { success: boolean; error?: string };

/** Los 10 puntos cuyo `catch` externo se alcanza si `auth()` revienta. */
const ACCIONES: Array<{ punto: string; run: () => Promise<unknown>; fallback: string }> = [
  {
    punto: "addContextSourceAction",
    fallback: "No se pudo anexar la fuente",
    run: () => addContextSourceAction({ projectId: UUID, type: "note", title: "t", content: "c" }),
  },
  {
    punto: "updateArtifactDraftAction",
    fallback: "No se pudo guardar el borrador",
    run: () =>
      updateArtifactDraftAction({ projectId: UUID, kind: "context_brief", artifact: {} } as never),
  },
  {
    punto: "sealArtifactByKindAction",
    fallback: "No se pudo sellar el artefacto",
    run: () => sealArtifactByKindAction({ projectId: UUID, kind: "context_brief" } as never),
  },
  {
    punto: "reopenArtifactByKindAction",
    fallback: "No se pudo reabrir el artefacto",
    run: () =>
      reopenArtifactByKindAction({
        projectId: UUID,
        kind: "context_brief",
        reason: "motivo suficiente",
      } as never),
  },
  {
    punto: "setRunDecisionAction",
    fallback: "No se pudo registrar tu respuesta",
    run: () => setRunDecisionAction({ runId: UUID, decision: "accepted" }),
  },
  {
    punto: "chooseDirectionAction",
    fallback: "No se pudo registrar la elección",
    run: () =>
      chooseDirectionAction({
        projectId: UUID,
        directionId: UUID,
        rationale: "razón suficiente",
        acceptedRisks: [],
        combinedFromDirectionIds: [],
      }),
  },
  {
    punto: "addUrlReferenceAction",
    fallback: "No se pudo agregar la referencia",
    run: () => addUrlReferenceAction({ projectId: UUID, label: "l", url: "https://ejemplo.mx" }),
  },
  {
    punto: "addImageReferenceAction (catch externo)",
    fallback: "No se pudo agregar la referencia",
    run: () => {
      const fd = new FormData();
      fd.set("projectId", UUID);
      fd.set("label", "etiqueta");
      return addImageReferenceAction(fd);
    },
  },
  {
    punto: "addNoteReferenceAction",
    fallback: "No se pudo agregar la nota",
    run: () => addNoteReferenceAction({ projectId: UUID, label: "l", note: "n" }),
  },
  {
    punto: "removeReferenceAction",
    fallback: "No se pudo eliminar la referencia",
    run: () => removeReferenceAction({ referenceId: UUID }),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  authMock.mockResolvedValue({ user: { id: "user-1", name: "Miguel" } });
});

describe("Server Actions de PixelForge — ningún error desconocido llega al panel", () => {
  test.each(ACCIONES)("$punto devuelve el fallback sin filtrar nada", async ({ run, fallback }) => {
    authMock.mockRejectedValueOnce(new Error(MESSAGE_ENVENENADO));

    const result = (await run()) as ActionResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe(fallback);
    sinFugas(result);
  });

  test.each(ACCIONES)("$punto tampoco filtra un error de Drizzle", async ({ run, fallback }) => {
    authMock.mockRejectedValueOnce(
      Object.assign(new Error(`relation "pixelforge_artifacts" does not exist`), {
        name: "PostgresError",
        code: "42P01",
        query: RAW_SQL,
        stack: STACK_INTERNO,
      })
    );

    const result = (await run()) as ActionResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe(fallback);
    sinFugas(result);
  });
});

describe("Server Actions de PixelForge — clases propias", () => {
  test("un SafeUserError sí conserva su mensaje: lo redactamos nosotros", async () => {
    authMock.mockRejectedValueOnce(
      new SafeUserError("Créditos insuficientes. Necesitas 6, tienes 2.", "insufficient_credits")
    );

    const result = (await addContextSourceAction({
      projectId: UUID,
      type: "note",
      title: "t",
      content: "c",
    })) as ActionResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe("Créditos insuficientes. Necesitas 6, tienes 2.");
  });

  test("un PixelforgeRunError NO conserva su mensaje, aunque sea clase nuestra", async () => {
    // Su constructor acepta cualquier string: ser propia no la vuelve pública.
    authMock.mockRejectedValueOnce(new PixelforgeRunError("provider_error", MESSAGE_ENVENENADO));

    const result = (await addContextSourceAction({
      projectId: UUID,
      type: "note",
      title: "t",
      content: "c",
    })) as ActionResult;

    expect(result.success).toBe(false);
    expect(result.error).toBe("No se pudo anexar la fuente");
    sinFugas(result);
  });
});

describe("Server Actions de PixelForge — el catch interno de la subida", () => {
  test("un fallo de R2 al subir la imagen no revela bucket, clave ni stack", async () => {
    // Punto 8 de los 11: el `catch` que envuelve `uploadReferenceImage`.
    repo.createReferenceAsset.mockResolvedValue(UUID);
    uploadReferenceImageMock.mockRejectedValueOnce(
      new Error(`R2 PutObject failed: bucket=pixeltec-pixelforge-prod key=${TOKEN_PRIVADO}`)
    );

    const fd = new FormData();
    fd.set("projectId", UUID);
    fd.set("label", "etiqueta");
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "ref.png", { type: "image/png" }));

    const result = (await addImageReferenceAction(fd)) as ActionResult;

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("pixeltec-pixelforge-prod");
    sinFugas(result);
  });
});

describe("Server Actions de PixelForge — el camino de éxito no cambia", () => {
  test("addContextSourceAction devuelve success con el id creado", async () => {
    repo.addContextSource.mockResolvedValue("fuente-1");

    const result = await addContextSourceAction({
      projectId: UUID,
      type: "note",
      title: "Título",
      content: "Contenido de la fuente",
    });

    expect(result).toEqual({ success: true, data: { id: "fuente-1" } });
  });

  test("removeReferenceAction devuelve success sin datos", async () => {
    // El repo devuelve `{ projectId }` — la acción lo desestructura para
    // revalidar las rutas.
    repo.removeVisualReference.mockResolvedValue({ projectId: UUID });

    const result = await removeReferenceAction({ referenceId: UUID });

    expect(result).toEqual({ success: true });
  });
});
