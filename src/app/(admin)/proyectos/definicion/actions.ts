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
  getDefinition,
  sealStation,
  reopenStation,
  markConverted,
  type Actor,
} from "@/lib/db/repos/definitions";
import { createDefinitionSchema, reopenSchema } from "@/lib/definition/schemas";
import type { DefinitionStation } from "@/lib/definition/types";
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

function titleFromBrainDump(brainDump: string): string {
  const firstLine = brainDump.trim().split("\n")[0]?.trim() ?? "";
  const base = firstLine || brainDump.trim();
  return base.length > 80 ? `${base.slice(0, 77)}…` : base || "Idea sin título";
}

export async function createDefinitionAction(input: {
  clientCrmId: string;
  brainDump: string;
}): Promise<PortalActionResult<{ id: string }>> {
  try {
    const { ownerId, actor } = await requireAuth();
    const parsed = createDefinitionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { clientCrmId, brainDump } = parsed.data;

    // El id que manda el workspace es `firestoreId ?? pgId` (ver getFullCrmData).
    const client = await db
      .select({ id: clients.id, firestoreId: clients.firestoreId })
      .from(clients)
      .where(
        and(
          eq(clients.ownerId, ownerId),
          or(eq(clients.firestoreId, clientCrmId), eq(clients.id, clientCrmId))
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
      title: titleFromBrainDump(brainDump),
      brainDump,
      actor,
    });

    revalidatePath("/proyectos/definicion");
    return { success: true, data: { id } };
  } catch (err) {
    console.error("[createDefinitionAction]", err);
    return { success: false, error: "No se pudo crear la definición" };
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

export async function markConvertedAction(input: {
  definitionId: string;
  projectCrmId: string;
}): Promise<PortalActionResult> {
  try {
    const { ownerId, actor } = await requireAuth();
    await markConverted(input.definitionId, ownerId, input.projectCrmId, actor);
    revalidatePath(`/proyectos/definicion/${input.definitionId}`);
    revalidatePath("/proyectos/definicion");
    return { success: true };
  } catch (err) {
    console.error("[markConvertedAction]", err);
    return { success: false, error: "No se pudo registrar la conversión" };
  }
}
