/**
 * Constantes de "Trabajo" (WO-2026-00132) compartidas entre server y
 * cliente. Viven fuera de `queries.ts` a propósito: ese archivo es
 * `'use server'` y solo puede exportar funciones async (Next.js las
 * convierte en referencias RPC para el cliente) — un `const` exportado ahí
 * rompe el build ("A 'use server' file can only export async functions").
 */

/** Estatus disponibles — mismos que ya usa el portal de clientes, sin inventar uno nuevo. */
export const PROJECT_STATUSES = ['Activo', 'En desarrollo', 'Pausado', 'Completado'] as const;
