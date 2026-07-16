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
  type Actor,
} from "@/lib/db/repos/pixelforge";
import { getDefinitionFull } from "@/lib/db/repos/definitions";
import { stationForKind, type PixelforgeSourceType } from "@/lib/pixelforge/types";
import type { PortalActionResult } from "@/lib/action-types";
// OJO: estos schemas usan `zod/v4` (ver docstring de sus archivos) — el resto
// de este módulo sigue con `zod` v3 clásico a propósito, no lo migres.
// `safeParse` funciona igual desde cualquiera de las dos versiones.
import { contextBriefSchema } from "@/lib/pixelforge/schemas/analyze-context";
import { landingDnaSchema } from "@/lib/pixelforge/schemas/generate-strategy";

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
}): Promise<PortalActionResult<{ id: string }>> {
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
    return { success: true, data: { id } };
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
// tenía `context_brief`; F3 suma `landing_dna`.

const OPERATIVE_ARTIFACT_KIND = z.enum(["context_brief", "landing_dna"], {
  errorMap: () => ({ message: "Tipo de artefacto inválido" }),
});
type OperativeArtifactKind = z.infer<typeof OPERATIVE_ARTIFACT_KIND>;

/** Mapa kind → schema de FORMA (zod v4, ver imports arriba) para validar el draft antes de persistir. */
const KIND_SCHEMAS = {
  context_brief: contextBriefSchema,
  landing_dna: landingDnaSchema,
} as const;

const artifactDraftSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  kind: OPERATIVE_ARTIFACT_KIND,
});

/**
 * Guarda el borrador editado de un artifact operativo. Valida la FORMA con
 * el schema del `kind` (mapa `KIND_SCHEMAS`) antes de persistir — el caller
 * siempre manda el artifact COMPLETO (clonado y modificado), nunca un parche
 * parcial (mismo contrato que la vieja `updateContextBriefDraftAction`).
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

// ─── Context Brief (F2) ─────────────────────────────────────────────────────
// Delegan en las genéricas de arriba — se conservan como wrappers finos para
// no tocar los call sites de ContextBriefPanel/SealBar (la UI real de F3 es
// F3-T2; acá solo se generaliza el backend de las actions).

/** @deprecated usa `updateArtifactDraftAction({ kind: "context_brief", ... })` — se mantiene por compat con ContextBriefPanel. */
export async function updateContextBriefDraftAction(input: {
  projectId: string;
  draft: unknown;
}): Promise<PortalActionResult> {
  return updateArtifactDraftAction({ projectId: input.projectId, kind: "context_brief", draft: input.draft });
}

/** @deprecated usa `sealArtifactByKindAction({ kind: "context_brief", ... })` — se mantiene por compat con SealBar. */
export async function sealContextBriefAction(input: { projectId: string }): Promise<PortalActionResult> {
  return sealArtifactByKindAction({ projectId: input.projectId, kind: "context_brief" });
}

/** @deprecated usa `reopenArtifactByKindAction({ kind: "context_brief", ... })` — se mantiene por compat con SealBar. */
export async function reopenContextBriefAction(input: {
  projectId: string;
  reason: string;
}): Promise<PortalActionResult> {
  return reopenArtifactByKindAction({ projectId: input.projectId, kind: "context_brief", reason: input.reason });
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
