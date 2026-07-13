"use server";

/**
 * Server actions del pipeline de Definición de Proyecto. Autentican vía
 * NextAuth (`auth()`), escopan por owner, y delegan la lógica de estados al
 * repo (src/lib/db/repos/definitions.ts). La generación IA NO vive aquí — va
 * por la route handler /api/definition/generate (convención de la app).
 */
import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import {
  createDefinition,
  startDefinition,
  updateDraft,
  getDefinition,
  getDefinitionFull,
  sealStation,
  reopenStation,
  attachProposal,
  type Actor,
} from "@/lib/db/repos/definitions";
import { createProposal } from "@/lib/documents/proposals";
import {
  createDefinitionSchema,
  updateDraftSchema,
  reopenSchema,
} from "@/lib/definition/schemas";
import type { DefinitionStation } from "@/lib/definition/types";
import { stripCongeladora } from "@/lib/definition/proposal-content";
import type { PortalActionResult } from "@/lib/action-types";

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

export async function createDefinitionAction(input: {
  clientCrmId: string;
  title: string;
  brainDump: string;
  start: boolean;
}): Promise<PortalActionResult<{ id: string }>> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = createDefinitionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { clientCrmId, title, brainDump, start } = parsed.data;

    // El id que manda el workspace es `firestoreId ?? pgId` (ver getFullCrmData).
    // `clients.id` es uuid en Postgres: si clientCrmId es un id viejo de Firestore
    // (no-uuid), comparar contra esa columna en la misma query revienta el bind
    // del parámetro antes de evaluar el OR (mismo caso que getPostById).
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      clientCrmId
    );
    const client = await db
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

    if (!client) return { success: false, error: "Cliente no encontrado" };

    const id = await createDefinition({
      ownerId,
      clientId: client.id,
      // Id canónico que usa el contexto CRM (necesario para la conversión).
      clientCrmId: client.firestoreId ?? client.id,
      title,
      brainDump,
      start,
      actor,
    });

    revalidatePath("/proyectos/definicion");
    return { success: true, data: { id } };
  } catch (err) {
    console.error("[createDefinitionAction]", err);
    return { success: false, error: "No se pudo crear la definición" };
  }
}

export async function startDefinitionAction(input: {
  definitionId: string;
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    await startDefinition(input.definitionId, ownerId, actor);
    revalidatePath(`/proyectos/definicion/${input.definitionId}`);
    revalidatePath("/proyectos/definicion");
    return { success: true };
  } catch (err) {
    console.error("[startDefinitionAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo iniciar la definición",
    };
  }
}

export async function updateDraftAction(input: {
  definitionId: string;
  title: string;
  brainDump: string;
}): Promise<PortalActionResult> {
  try {
    const { ownerId } = await requireAuth();
    const parsed = updateDraftSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    await updateDraft(parsed.data.definitionId, ownerId, {
      title: parsed.data.title,
      brainDump: parsed.data.brainDump,
    });
    revalidatePath(`/proyectos/definicion/${input.definitionId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateDraftAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo guardar el borrador",
    };
  }
}

export async function approveStationAction(input: {
  definitionId: string;
  station: DefinitionStation;
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    const def = await getDefinition(input.definitionId, ownerId);
    if (!def) return { success: false, error: "Definición no encontrada" };

    await sealStation(input.definitionId, input.station, actor);
    revalidatePath(`/proyectos/definicion/${input.definitionId}`);
    revalidatePath("/proyectos/definicion");
    return { success: true };
  } catch (err) {
    console.error("[approveStationAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo aprobar la estación",
    };
  }
}

export async function reopenStationAction(input: {
  definitionId: string;
  station: DefinitionStation;
  reason: string;
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = reopenSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const def = await getDefinition(input.definitionId, ownerId);
    if (!def) return { success: false, error: "Definición no encontrada" };

    await reopenStation(input.definitionId, input.station, parsed.data.reason, actor);
    revalidatePath(`/proyectos/definicion/${input.definitionId}`);
    revalidatePath("/proyectos/definicion");
    return { success: true };
  } catch (err) {
    console.error("[reopenStationAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo reabrir la estación",
    };
  }
}

/**
 * Genera una Propuesta comercial a partir del contenido sellado de una
 * definición completa (boceto → scope, mvp → solution, flujo → deliverables).
 * `benefits`/`budget`/`timeline` quedan vacíos para llenarse en la parte
 * comercial. Idempotente: si la definición ya tiene una propuesta, la
 * devuelve en vez de crear otra.
 */
export async function createProposalFromDefinitionAction(input: {
  definitionId: string;
}): Promise<PortalActionResult<{ proposalId: string }>> {
  try {
    const { ownerId, actor } = await requireAuth();
    const full = await getDefinitionFull(input.definitionId, ownerId);
    if (!full) return { success: false, error: "Definición no encontrada" };

    if (full.definition.proposalId) {
      return { success: true, data: { proposalId: full.definition.proposalId } };
    }
    if (full.definition.status !== "completed") {
      return { success: false, error: "La definición todavía no está completa" };
    }

    const sealedFor = (station: DefinitionStation) =>
      full.stations.find((s) => s.station === station)?.sealedContent ?? "";

    const [client] = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, full.definition.clientId))
      .limit(1);

    const proposalId = await createProposal(
      ownerId,
      full.definition.clientCrmId,
      client?.name ?? "Cliente",
      {
        title: full.definition.title,
        scope: sealedFor("boceto"),
        // El sellado de "mvp" trae "# MVP 1.0" + "# Congeladora" en el mismo
        // bloque (uso interno del PM) — la propuesta al cliente solo debe
        // mostrar lo aceptado. Ver src/lib/definition/proposal-content.ts.
        solution: stripCongeladora(sealedFor("mvp")),
        deliverables: sealedFor("flujo"),
        status: "borrador",
      }
    );

    await attachProposal(input.definitionId, ownerId, proposalId, actor);
    revalidatePath(`/proyectos/definicion/${input.definitionId}`);
    revalidatePath("/proyectos/definicion");
    return { success: true, data: { proposalId } };
  } catch (err) {
    console.error("[createProposalFromDefinitionAction]", err);
    return { success: false, error: "No se pudo generar la propuesta" };
  }
}
