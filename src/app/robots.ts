import type { MetadataRoute } from "next";
import { PROTECTED_PATHS } from "@/lib/routes/admin-routes";
import { SITE } from "@/lib/site-config";

/**
 * El disallow de rutas admin se DERIVA de ADMIN_ROUTES (la misma fuente que
 * protege el middleware): agregar una ruta admin nueva la bloquea aquí sin
 * paso manual. Antes esta lista se mantenía a mano y llevaba 6 rutas admin
 * reales sin bloquear (/hoy, /cobros, /documentos, /crecimiento, /ia-factory,
 * /whatsapp) y una ya inexistente (/dashboard, hoy solo redirect).
 *
 * robots controla RASTREO, no indexación: las rutas que pueden llegar a estar
 * indexadas llevan además meta noindex (login, reset-password, portal, p/*).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          ...PROTECTED_PATHS,
          "/login",
          "/portal",
          "/reset-password",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
