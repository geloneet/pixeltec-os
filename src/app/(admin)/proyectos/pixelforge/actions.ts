"use server";

/**
 * Server actions del módulo PixelForge (landings por estaciones, F1:
 * fundaciones). Mismo patrón que
 * src/app/(admin)/proyectos/definicion/actions.ts: `requireAuth()` local,
 * `resolveClientByCrmId` adaptado, zod `safeParse` de inputs, retorno
 * `PortalActionResult<T>`, `revalidatePath`, try/catch con
 * `console.error("[nombreAction]", err)`.
 */
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import {
  createPixelforgeProject,
  addContextSource,
  updateArtifactDraft,
  sealArtifact,
  reopenArtifact,
  setRunUserDecision,
  addVisualReference,
  createReferenceAsset,
  removeVisualReference,
  chooseDirection,
  type Actor,
} from "@/lib/db/repos/pixelforge";
import { getDefinitionFull } from "@/lib/db/repos/definitions";
import {
  PIXELFORGE_STATION_SEQUENCE,
  stationForKind,
  type OperativeArtifactKind,
  type PixelforgeSourceType,
  type PixelforgeStation,
} from "@/lib/pixelforge/types";
import { safeFetch } from "@/lib/pixelforge/visual/safe-fetch";
import { extractSignals } from "@/lib/pixelforge/visual/extract";
import { uploadReferenceImage } from "@/lib/pixelforge/visual/storage";
import type { PortalActionResult } from "@/lib/action-types";
// Un archivo "use server" solo puede exportar funciones async, por eso el
// enum runtime y el mapa de schemas viven en su propio módulo (gate F6A).
import { KIND_SCHEMAS, OPERATIVE_ARTIFACT_KIND } from "@/lib/pixelforge/kind-schemas";

interface Auth {
  ownerId: string;
  actor: Actor;
}

async function requireAuth(): Promise<Auth> {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) throw new Error("No autenticado");
  const name = session.user?.name ?? session.user?.email ?? "Usuario";
  return { ownerId, actor: { id: ownerId, name } };
}

/**
 * Resuelve el id interno de Postgres (`clients.id`) a partir del id que manda
 * el workspace CRM (`firestoreId ?? pgId`, ver getFullCrmData). `clients.id` es
 * uuid: si `clientCrmId` no tiene forma de uuid, comparar contra esa columna en
 * la misma query revienta el bind del parámetro antes de evaluar el OR (mismo
 * caso que getPostById) — por eso el chequeo `isUuid` antes de armar el OR.
 */
async function resolveClientByCrmId(ownerId: string, clientCrmId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    clientCrmId
  );
  return db
    .select({ id: clients.id, firestoreId: clients.firestoreId })
    .from(clients)
    .where(
      and(
        eq(clients.ownerId, ownerId),
        isUuid
          ? or(eq(clients.firestoreId, clientCrmId), eq(clients.id, clientCrmId))
          : eq(clients.firestoreId, clientCrmId)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

const createPixelforgeProjectSchema = z.object({
  clientCrmId: z.string().min(1, "Falta el cliente"),
  title: z.string().trim().min(1, "Falta el título"),
  brainDump: z
    .string()
    .trim()
    .min(20, "Describe el proyecto con al menos 20 caracteres"),
  definitionId: z.string().uuid("Definición inválida").optional(),
});

/**
 * Crea un proyecto PixelForge para un cliente. Opcionalmente importa el
 * contenido sellado de una Definición de Proyecto ya completa (concatena las
 * estaciones selladas como una fuente de contexto `definition_import`; ver
 * `createPixelforgeProject` en el repo).
 */
export async function createPixelforgeProjectAction(input: {
  clientCrmId: string;
  title: string;
  brainDump: string;
  definitionId?: string;
}): Promise<PortalActionResult<{ id: string; station: PixelforgeStation }>> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = createPixelforgeProjectSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { clientCrmId, title, brainDump, definitionId } = parsed.data;

    const client = await resolveClientByCrmId(ownerId, clientCrmId);
    if (!client) return { success: false, error: "Cliente no encontrado" };

    let definitionImport: { title: string; content: string } | null = null;
    if (definitionId) {
      const full = await getDefinitionFull(definitionId, ownerId);
      if (!full) return { success: false, error: "Definición no encontrada" };
      if (full.definition.clientId !== client.id) {
        return { success: false, error: "La definición no pertenece a ese cliente" };
      }

      const content = full.stations
        .filter((s) => s.sealedContent)
        .map((s) => `## ${s.station}\n\n${s.sealedContent}`)
        .join("\n\n---\n\n");

      if (!content) {
        return {
          success: false,
          error: "La definición no tiene estaciones selladas para importar",
        };
      }

      definitionImport = {
        title: `Definición importada: ${full.definition.title}`,
        content,
      };
    }

    const id = await createPixelforgeProject({
      ownerId,
      clientId: client.id,
      clientCrmId: client.firestoreId ?? client.id,
      title,
      brainDump,
      definitionId: definitionId ?? null,
      definitionImport,
      actor,
    });

    revalidatePath("/proyectos/pixelforge");
    // El repo crea todo proyecto en la primera estación de la secuencia
    // canónica; devolverla permite al form navegar DIRECTO a la estación
    // (un solo cambio de pathname — el salto intermedio por el [id] pelado
    // dispara el crash de hooks del AnimatePresence del shell admin).
    return { success: true, data: { id, station: PIXELFORGE_STATION_SEQUENCE[0] } };
  } catch (err) {
    console.error("[createPixelforgeProjectAction]", err);
    return { success: false, error: "No se pudo crear el proyecto" };
  }
}

const addContextSourceSchema = z
  .object({
    projectId: z.string().uuid("Proyecto inválido"),
    type: z.enum(["note", "document", "url"], {
      errorMap: () => ({ message: "Tipo de fuente inválido" }),
    }),
    title: z.string().trim().min(1, "Falta el título"),
    content: z.string().trim().min(1, "Falta el contenido"),
    url: z
      .string()
      .url("URL inválida")
      .refine((u) => /^https?:\/\//i.test(u), "Solo URLs http(s)")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "url" && !data.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "Falta la URL de la fuente",
      });
    }
  });

/**
 * Anexa una fuente de contexto a un proyecto ya existente. `definition_import`
 * NO se acepta acá — esa fuente solo se crea internamente al crear el
 * proyecto (ver `createPixelforgeProjectAction`). El repo (`addContextSource`)
 * ya verifica ownership.
 */
export async function addContextSourceAction(input: {
  projectId: string;
  type: Exclude<PixelforgeSourceType, "definition_import">;
  title: string;
  content: string;
  url?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = addContextSourceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { projectId, type, title, content, url } = parsed.data;

    const id = await addContextSource(
      projectId,
      ownerId,
      { type, title, content, url },
      actor
    );

    revalidatePath(`/proyectos/pixelforge/${projectId}`);
    revalidatePath(`/proyectos/pixelforge/${projectId}/contexto`);
    return { success: true, data: { id } };
  } catch (err) {
    console.error("[addContextSourceAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo anexar la fuente",
    };
  }
}

// ─── Artifacts por kind (F3) ────────────────────────────────────────────────
// Generaliza las 3 acciones de edición/sellado/reapertura a cualquier kind
// OPERATIVO (los que ya tienen operación IA + UI habilitadas) — no a los 5
// kinds completos de `ARTIFACT_KINDS`, ese universo crece por fase. F2 solo
// tenía `context_brief`; F3 suma `landing_dna`; F4 suma `visual_dna` (la
// edición inline de `VisualDnaPanel` y `SealBar` con `kind="visual_dna"`
// dependen de que esté acá — el route de `synthesize_visual_dna` ya persiste
// directo vía el repo y no pasa por este mapa).

const artifactDraftSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  kind: OPERATIVE_ARTIFACT_KIND,
});

/**
 * Guarda el borrador editado de un artifact operativo. Valida la FORMA con
 * el schema del `kind` (mapa `KIND_SCHEMAS`) antes de persistir — el caller
 * siempre manda el artifact COMPLETO (clonado y modificado), nunca un parche
 * parcial.
 */
export async function updateArtifactDraftAction(input: {
  projectId: string;
  kind: OperativeArtifactKind;
  draft: unknown;
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    const headerParsed = artifactDraftSchema.safeParse({ projectId: input.projectId, kind: input.kind });
    if (!headerParsed.success) {
      return { success: false, error: headerParsed.error.errors[0]?.message };
    }
    const { projectId, kind } = headerParsed.data;

    // La decisión de dirección NO se edita como un draft libre — la única
    // escritura legítima es `chooseDirectionAction` (elección auditada,
    // repo `chooseDirection`). Rechazo explícito ANTES de validar la forma.
    if (kind === "direction_decision") {
      return {
        success: false,
        error: "La decisión de dirección se registra eligiendo una dirección",
      };
    }

    const draftParsed = KIND_SCHEMAS[kind].safeParse(input.draft);
    if (!draftParsed.success) {
      return { success: false, error: `El borrador no tiene la forma válida para ${kind}` };
    }

    await updateArtifactDraft(projectId, ownerId, kind, draftParsed.data, actor);

    const station = stationForKind(kind);
    revalidatePath(`/proyectos/pixelforge/${projectId}`);
    revalidatePath(`/proyectos/pixelforge/${projectId}/${station}`);
    return { success: true };
  } catch (err) {
    console.error("[updateArtifactDraftAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo guardar el borrador",
    };
  }
}

const sealByKindSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  kind: OPERATIVE_ARTIFACT_KIND,
});

/** Sella el artifact operativo: congela el borrador actual, avanza la estación si corresponde. */
export async function sealArtifactByKindAction(input: {
  projectId: string;
  kind: OperativeArtifactKind;
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = sealByKindSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { projectId, kind } = parsed.data;

    await sealArtifact(projectId, ownerId, kind, actor);

    const station = stationForKind(kind);
    revalidatePath(`/proyectos/pixelforge/${projectId}`);
    revalidatePath(`/proyectos/pixelforge/${projectId}/${station}`);
    return { success: true };
  } catch (err) {
    console.error("[sealArtifactByKindAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo sellar el artefacto",
    };
  }
}

const reopenByKindSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  kind: OPERATIVE_ARTIFACT_KIND,
  reason: z.string().trim().min(5, "Explica por qué reabres"),
});

/** Reabre un artifact operativo sellado — invalida los sellos downstream (repo se encarga). */
export async function reopenArtifactByKindAction(input: {
  projectId: string;
  kind: OperativeArtifactKind;
  reason: string;
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = reopenByKindSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { projectId, kind, reason } = parsed.data;

    await reopenArtifact(projectId, ownerId, kind, reason, actor);

    const station = stationForKind(kind);
    revalidatePath(`/proyectos/pixelforge/${projectId}`);
    revalidatePath(`/proyectos/pixelforge/${projectId}/${station}`);
    return { success: true };
  } catch (err) {
    console.error("[reopenArtifactByKindAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo reabrir el artefacto",
    };
  }
}

const setRunDecisionSchema = z.object({
  runId: z.string().uuid("Corrida inválida"),
  decision: z.enum(["accepted", "rejected"], {
    errorMap: () => ({ message: "Decisión inválida" }),
  }),
});

/** Registra si el usuario consideró útil o no el resultado de una corrida IA. */
export async function setRunDecisionAction(input: {
  runId: string;
  decision: "accepted" | "rejected";
}): Promise<PortalActionResult> {
  try {
    const { ownerId } = await requireAuth();
    const parsed = setRunDecisionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }

    await setRunUserDecision(parsed.data.runId, ownerId, parsed.data.decision);
    return { success: true };
  } catch (err) {
    console.error("[setRunDecisionAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo registrar tu respuesta",
    };
  }
}

const chooseDirectionSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  directionId: z.string().uuid("Dirección inválida"),
  rationale: z.string().trim().min(10, "Explica en al menos 10 caracteres por qué elegiste esta dirección"),
  acceptedRisks: z.array(z.string()),
  combinedFromDirectionIds: z.array(z.string().uuid("Dirección inválida")),
});

/**
 * Elección auditada de una dirección creativa (estación Direcciones, F5) — la
 * ÚNICA escritura legítima del draft de `direction_decision` (`updateArtifactDraftAction`
 * la rechaza explícitamente arriba). El repo (`chooseDirection`) valida que
 * `directionId`/`combinedFromDirectionIds` pertenezcan al proyecto (ownership +
 * IDOR) y que el artifact no esté sellado.
 */
export async function chooseDirectionAction(input: {
  projectId: string;
  directionId: string;
  rationale: string;
  acceptedRisks: string[];
  combinedFromDirectionIds: string[];
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = chooseDirectionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { projectId, directionId, rationale, acceptedRisks, combinedFromDirectionIds } = parsed.data;

    await chooseDirection(
      projectId,
      ownerId,
      { directionId, rationale, acceptedRisks, combinedFromDirectionIds },
      actor
    );

    revalidatePath(`/proyectos/pixelforge/${projectId}`);
    revalidatePath(`/proyectos/pixelforge/${projectId}/direcciones`);
    return { success: true };
  } catch (err) {
    console.error("[chooseDirectionAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo registrar la elección",
    };
  }
}

// ─── Referencias visuales (F4) ──────────────────────────────────────────────
// Insumo de la estación `visual`: agregar/quitar referencias en cualquier
// momento (no hay compuerta dura acá — son insumo libre, se editan sin
// depender de en qué estación esté el proyecto). La IA
// (analyze_reference/synthesize_visual_dna) es F4-T4; la UI es F4-T5.

function visualReferencePaths(projectId: string) {
  revalidatePath(`/proyectos/pixelforge/${projectId}`);
  revalidatePath(`/proyectos/pixelforge/${projectId}/visual`);
}

const addUrlReferenceSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  label: z.string().trim().min(1, "Falta la etiqueta"),
  url: z
    .string()
    .url("URL inválida")
    .refine((u) => /^https?:\/\//i.test(u), "Solo URLs http(s)"),
});

/**
 * Agrega una referencia visual de tipo URL. Pega la URL con `safeFetch`
 * (fetcher anti-SSRF real, `src/lib/pixelforge/visual/safe-fetch.ts`) y, si
 * responde ok, extrae señales SANEADAS con `extractSignals` — el HTML crudo
 * de `fetchResult.body` NUNCA se persiste, ni entero ni en fragmentos: solo
 * las señales de `extractSignals` (+ `fetchedUrl`/`status`) van a
 * `fetchedMeta`. Cobertura siempre `semantic-only` — una URL sin screenshot
 * es semántica; el screenshot (si el usuario lo sube) es OTRA referencia,
 * de `kind: "image"`. Si `safeFetch` falla (bloqueado, timeout, no-html,
 * etc.) la referencia se agrega igual, con `fetchedMeta: { error: reason }`
 * — el usuario puede complementar subiendo un screenshot a mano.
 */
export async function addUrlReferenceAction(input: {
  projectId: string;
  label: string;
  url: string;
}): Promise<PortalActionResult<{ id: string }>> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = addUrlReferenceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { projectId, label, url } = parsed.data;

    const fetchResult = await safeFetch(url);

    const fetchedMeta = fetchResult.ok
      ? {
          ...extractSignals(fetchResult.body, fetchResult.finalUrl),
          fetchedUrl: fetchResult.finalUrl,
          status: fetchResult.status,
        }
      : { error: fetchResult.reason };

    const id = await addVisualReference(
      projectId,
      ownerId,
      { kind: "url", label, url, coverage: "semantic-only", fetchedMeta },
      actor
    );

    visualReferencePaths(projectId);
    return { success: true, data: { id } };
  } catch (err) {
    console.error("[addUrlReferenceAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo agregar la referencia",
    };
  }
}

const addImageReferenceHeaderSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  label: z.string().trim().min(1, "Falta la etiqueta"),
});

/**
 * Agrega una referencia visual de tipo imagen (screenshot subido a mano).
 * Recibe `FormData` (campos `projectId`, `label`, `file`) porque es un
 * upload real, no JSON. Genera `referenceId = randomUUID()` ANTES de subir
 * — se usa como nombre del objeto en R2 (`uploadReferenceImage`, que valida
 * mime whitelist + cap 5MB) Y como id explícito de la fila al insertar
 * (`addVisualReference(..., referenceId)`), para no tener que renombrar el
 * objeto después de crear la fila. Cobertura SIEMPRE `static-visual-partial`
 * por defecto: un screenshot nunca prueba el sitio completo (scroll,
 * estados, responsive) — nunca se marca `fullpage` automáticamente; eso
 * queda a criterio explícito del usuario en la UI (F4-T5).
 */
export async function addImageReferenceAction(
  formData: FormData
): Promise<PortalActionResult<{ id: string }>> {
  try {
    const { ownerId, actor } = await requireAuth();

    const headerParsed = addImageReferenceHeaderSchema.safeParse({
      projectId: formData.get("projectId"),
      label: formData.get("label"),
    });
    if (!headerParsed.success) {
      return { success: false, error: headerParsed.error.errors[0]?.message };
    }
    const { projectId, label } = headerParsed.data;

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "Falta la imagen" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const referenceId = randomUUID();

    let uploaded: { url: string; key: string };
    try {
      uploaded = await uploadReferenceImage(ownerId, projectId, referenceId, buffer, file.type);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "No se pudo subir la imagen",
      };
    }

    const assetId = await createReferenceAsset(
      projectId,
      ownerId,
      { url: uploaded.url, r2Key: uploaded.key, contentType: file.type, sizeBytes: buffer.length },
      actor
    );

    const id = await addVisualReference(
      projectId,
      ownerId,
      { kind: "image", label, assetId, coverage: "static-visual-partial" },
      actor,
      referenceId
    );

    visualReferencePaths(projectId);
    return { success: true, data: { id } };
  } catch (err) {
    console.error("[addImageReferenceAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo agregar la referencia",
    };
  }
}

const addNoteReferenceSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  label: z.string().trim().min(1, "Falta la etiqueta"),
  note: z.string().trim().min(1, "Falta la nota"),
});

/** Agrega una referencia visual de tipo nota (texto libre, sin fetch ni upload). */
export async function addNoteReferenceAction(input: {
  projectId: string;
  label: string;
  note: string;
}): Promise<PortalActionResult<{ id: string }>> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = addNoteReferenceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { projectId, label, note } = parsed.data;

    const id = await addVisualReference(projectId, ownerId, { kind: "note", label, note }, actor);

    visualReferencePaths(projectId);
    return { success: true, data: { id } };
  } catch (err) {
    console.error("[addNoteReferenceAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo agregar la nota",
    };
  }
}

const removeReferenceSchema = z.object({
  referenceId: z.string().uuid("Referencia inválida"),
});

/** Quita una referencia visual (cualquier kind). El repo borra el asset/objeto R2 si aplica. */
export async function removeReferenceAction(input: {
  referenceId: string;
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = removeReferenceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }

    const { projectId } = await removeVisualReference(parsed.data.referenceId, ownerId, actor);

    visualReferencePaths(projectId);
    return { success: true };
  } catch (err) {
    console.error("[removeReferenceAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo eliminar la referencia",
    };
  }
}
