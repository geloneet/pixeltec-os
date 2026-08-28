'use server';

/**
 * "Trabajo" (WO-2026-00132) — reemplaza Proyectos/Definición/PixelForge.
 * Fuente única: la tabla `projects` real (la misma que usa el flujo
 * cotización→venta→proyecto). Nada de blobs de Firestore ni de las 3 fuentes
 * que unía el código anterior — un proyecto es una fila de `projects`.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, projects } from '@/lib/db/schema';
import { requireOwner } from '@/lib/documents/pg';

export interface ProjectRow {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: string;
  progressPercent: number;
  createdAt: string;
}

/** Proyectos del owner autenticado, más reciente primero. */
export async function listProjects(): Promise<ProjectRow[]> {
  const { ownerId } = await requireOwner();
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
      clientName: clients.name,
      status: projects.status,
      progressPercent: projects.progressPercent,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(clients.ownerId, ownerId))
    .orderBy(desc(projects.createdAt));

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export interface ProjectDetail extends ProjectRow {
  observaciones: string;
  recursos: string;
  quickNotes: string;
  domain: string;
  budget: string;
}

/** Un proyecto por id, solo si pertenece a un cliente del owner autenticado. */
export async function getProject(id: string): Promise<ProjectDetail | null> {
  const { ownerId } = await requireOwner();
  const [row] = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
      clientName: clients.name,
      status: projects.status,
      progressPercent: projects.progressPercent,
      observaciones: projects.observaciones,
      recursos: projects.recursos,
      quickNotes: projects.quickNotes,
      domain: projects.domain,
      budget: projects.budget,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.id, id), eq(clients.ownerId, ownerId)))
    .limit(1);

  if (!row) return null;
  return { ...row, createdAt: row.createdAt.toISOString() };
}
