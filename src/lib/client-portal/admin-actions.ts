'use server';

import { z } from 'zod';
import { requireOwner, resolveClientPgId } from '@/lib/documents/pg';
import type { PortalActionResult } from '@/lib/action-types';
import {
  listAllClientsForPortalAdmin,
  setPortalAccessEnabled as setPortalAccessEnabledDb,
  publishPortalUpdate as publishPortalUpdateDb,
  portalLoginBlockerFor,
  type PortalAdminClientRow,
} from './pg';

export async function listClientsForPortalAdminAction(): Promise<PortalAdminClientRow[]> {
  const { ownerId } = await requireOwner();
  return listAllClientsForPortalAdmin(ownerId);
}

export async function setPortalAccessEnabledAction(clientId: string, enabled: boolean): Promise<PortalActionResult<null>> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return { success: false, error: 'Cliente no encontrado.' };

  if (enabled) {
    const blocker = await portalLoginBlockerFor(clientPgId);
    if (blocker) return { success: false, error: blocker };
  }

  const updated = await setPortalAccessEnabledDb(clientPgId, ownerId, enabled);
  if (!updated) return { success: false, error: 'Cliente no encontrado.' };
  return { success: true, data: null };
}

const publishUpdateSchema = z.object({
  text: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

export async function publishPortalUpdateAction(
  clientId: string,
  input: { text: string; imageUrl?: string },
): Promise<PortalActionResult<{ id: string }>> {
  const parsed = publishUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Datos inválidos.' };

  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return { success: false, error: 'Cliente no encontrado.' };

  // `createdBy` NO se toma del input — lo deriva el data layer del owner
  // autenticado (ver publishPortalUpdate) para que no sea spoofeable.
  const id = await publishPortalUpdateDb(clientPgId, ownerId, {
    text: parsed.data.text,
    imageUrl: parsed.data.imageUrl || null,
  });
  if (!id) return { success: false, error: 'Cliente no encontrado.' };
  return { success: true, data: { id } };
}
