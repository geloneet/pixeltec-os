'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, projects } from '@/lib/db/schema';
import { requireOwner } from '@/lib/documents/pg';
import { PROJECT_STATUSES } from './constants';

interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(err: unknown, message: string): ActionResult {
  console.error('[projects/actions]', err);
  return { ok: false, error: message };
}

/** Todos los campos editables de "Trabajo" desde la pantalla de detalle. */
export async function updateProjectWork(
  id: string,
  input: { status?: string; progressPercent?: number; observaciones?: string; recursos?: string; quickNotes?: string }
): Promise<ActionResult> {
  try {
    const { ownerId } = await requireOwner();

    if (input.status !== undefined && !PROJECT_STATUSES.includes(input.status as (typeof PROJECT_STATUSES)[number])) {
      return { ok: false, error: 'Estatus inválido.' };
    }
    if (input.progressPercent !== undefined && (input.progressPercent < 0 || input.progressPercent > 100)) {
      return { ok: false, error: 'El porcentaje debe estar entre 0 y 100.' };
    }

    // El UPDATE solo afecta filas cuyo cliente pertenece al owner autenticado
    // (join implícito vía subquery) — no un simple `eq(projects.id, id)`.
    const [owned] = await db
      .select({ id: projects.id })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(and(eq(projects.id, id), eq(clients.ownerId, ownerId)))
      .limit(1);
    if (!owned) return { ok: false, error: 'Proyecto no encontrado.' };

    await db.update(projects).set(input).where(eq(projects.id, id));

    revalidatePath('/proyectos');
    revalidatePath(`/proyectos/${id}`);
    return { ok: true };
  } catch (err) {
    return fail(err, 'No se pudo guardar el cambio.');
  }
}
