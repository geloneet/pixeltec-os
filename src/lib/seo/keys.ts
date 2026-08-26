/**
 * Claves de ajuste del módulo SEO que no pertenecen a una herramienta del
 * catálogo (WO-2026-00095).
 *
 * Viven aquí y no en `actions.ts` porque un archivo `'use server'` solo puede
 * exportar funciones async: exportar una constante desde ahí rompe en tiempo
 * de compilación cualquier módulo que la importe (lo descubrió el 500 de
 * /sitemap.xml durante la verificación).
 */
export const SETTING_SITEMAP_ENABLED = 'seo_sitemap_enabled';
