/**
 * Ruta admin del Blog nuevo (WO-2026-00088, D-A del Supervisor General):
 * `/blog-cms`. Vive fuera de `actions.ts` porque un archivo `'use server'`
 * solo puede exportar funciones async — una constante ahí rompe el build.
 */
export const ADMIN_BLOG_PATH = '/blog-cms';
