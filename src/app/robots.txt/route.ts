import { getSettings } from "@/lib/settings/queries";
import { SEO_TOOLS } from "@/lib/seo/tools";
import { derivedRobots, reconcileRobots } from "@/lib/seo/robots";

/**
 * /robots.txt (WO-2026-00095) — antes era `app/robots.ts` (derivado y estático);
 * ahora es un route handler para que el módulo SEO pueda publicar su propia
 * versión, como en Muebles Encino.
 *
 * La composición vive en `@/lib/seo/robots` (módulo puro y testeado): un
 * archivo publicado se completa con las rutas privadas derivadas de
 * ADMIN_ROUTES, nunca las reemplaza.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const tool = SEO_TOOLS.robots;
  let body = derivedRobots();
  try {
    const stored = await getSettings([tool.settingKey, tool.enabledKey]);
    const content = (stored[tool.settingKey] ?? "").trim();
    if (stored[tool.enabledKey] === "1" && content) body = reconcileRobots(content);
  } catch (error) {
    // Sin base de datos se sirve el derivado: nunca un robots.txt vacío.
    console.error("[robots.txt] settings unavailable:", error);
  }
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300" },
  });
}
