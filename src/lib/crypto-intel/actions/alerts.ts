"use server";
import { revalidatePath } from "next/cache";
import {
  createAlertRule,
  getAlertRuleById,
  softDeleteAlertRule,
  updateAlertRule,
} from "@/lib/db/repos/crypto-intel";
import { getSessionUid } from "@/lib/auth/session";
import { log } from "../logger";
import { CreateAlertSchema, UpdateAlertSchema } from "../schemas/alert";
import type { CreateAlertInput, UpdateAlertInput } from "../schemas/alert";

async function assertAlertOwnership(
  id: string,
  uid: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rule = await getAlertRuleById(id);
  if (!rule) {
    return { ok: false, error: "Alerta no encontrada" };
  }
  if (rule.userId !== uid) {
    void log("admin", "warn", "IDOR attempt blocked on alertRules", {
      alertId: id,
      attemptedBy: uid,
      ownerUid: rule.userId,
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

  await createAlertRule({
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

  const updateData: Parameters<typeof updateAlertRule>[1] = { updatedAt: new Date() };
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

  await updateAlertRule(id, updateData);
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

  await updateAlertRule(id, { active, updatedAt: new Date() });
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
  await softDeleteAlertRule(id);
  revalidatePath("/crypto-intel/alertas");
  return { ok: true };
}
