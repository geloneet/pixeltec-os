"use server";
import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { db, COL } from "../firebase-admin";
import { getSessionUid } from "../auth";
import { log } from "../logger";
import { CreateAlertSchema, UpdateAlertSchema } from "../schemas/alert";
import type { CreateAlertInput, UpdateAlertInput } from "../schemas/alert";

async function assertAlertOwnership(
  id: string,
  uid: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snap = await db().collection(COL.alertRules).doc(id).get();
  if (!snap.exists) {
    return { ok: false, error: "Alerta no encontrada" };
  }
  if (snap.data()?.userId !== uid) {
    void log("admin", "warn", "IDOR attempt blocked on alertRules", {
      alertId: id,
      attemptedBy: uid,
      ownerUid: snap.data()?.userId,
    });
    return { ok: false, error: "Sin permisos sobre esta alerta" };
  }
  return { ok: true };
}

export async function createAlert(
  input: CreateAlertInput
): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  const parsed = CreateAlertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const { symbol, type, threshold, pctWindow, pctDirection, channels, telegramChatId, cooldownMinutes, displayName } = parsed.data;

  await db().collection(COL.alertRules).add({
    userId: uid,
    symbol,
    type,
    params: {
      threshold,
      ...(type === "change_percent"
        ? { window: pctWindow ?? "24h", direction: pctDirection ?? "down" }
        : {}),
    },
    channels,
    telegramChatId: telegramChatId ?? null,
    displayName: displayName ?? null,
    cooldownMinutes,
    triggerCount: 0,
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    deletedAt: null,
    lastTriggeredAt: null,
  });

  revalidatePath("/crypto-intel/alertas");
  return { ok: true };
}

export async function updateAlert(
  id: string,
  input: UpdateAlertInput
): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  const ownership = await assertAlertOwnership(id, uid);
  if (!ownership.ok) return ownership;

  const parsed = UpdateAlertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const { symbol, type, threshold, pctWindow, pctDirection, channels, telegramChatId, cooldownMinutes, displayName, active } = parsed.data;

  const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() };
  if (symbol !== undefined) updateData.symbol = symbol;
  if (type !== undefined) updateData.type = type;
  if (threshold !== undefined) {
    updateData.params = {
      threshold,
      ...(type === "change_percent"
        ? { window: pctWindow ?? "24h", direction: pctDirection ?? "down" }
        : {}),
    };
  }
  if (channels !== undefined) updateData.channels = channels;
  if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId;
  if (cooldownMinutes !== undefined) updateData.cooldownMinutes = cooldownMinutes;
  if (displayName !== undefined) updateData.displayName = displayName;
  if (active !== undefined) updateData.active = active;

  await db().collection(COL.alertRules).doc(id).update(updateData);
  revalidatePath("/crypto-intel/alertas");
  return { ok: true };
}

export async function toggleAlert(
  id: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  const ownership = await assertAlertOwnership(id, uid);
  if (!ownership.ok) return ownership;

  await db().collection(COL.alertRules).doc(id).update({
    active,
    updatedAt: Timestamp.now(),
  });
  revalidatePath("/crypto-intel/alertas");
  return { ok: true };
}

export async function deleteAlert(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  const ownership = await assertAlertOwnership(id, uid);
  if (!ownership.ok) return ownership;

  // Soft delete
  await db().collection(COL.alertRules).doc(id).update({
    deletedAt: Timestamp.now(),
    active: false,
    updatedAt: Timestamp.now(),
  });
  revalidatePath("/crypto-intel/alertas");
  return { ok: true };
}
