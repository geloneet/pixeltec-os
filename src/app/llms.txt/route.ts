import { getSettings } from "@/lib/settings/queries";
import { SEO_TOOLS } from "@/lib/seo/tools";

/**
 * /llms.txt (WO-2026-00095) — paridad con Muebles Encino. Se sirve solo si la
 * herramienta está publicada y tiene contenido; si no, 404 (no se inventa un
 * archivo vacío que los modelos leerían como «este sitio no tiene nada»).
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const tool = SEO_TOOLS.llms;
  try {
    const stored = await getSettings([tool.settingKey, tool.enabledKey]);
    const content = (stored[tool.settingKey] ?? "").trim();
    if (stored[tool.enabledKey] !== "1" || !content) return new Response("Not found", { status: 404 });
    return new Response(`${content}\n`, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300" },
    });
  } catch (error) {
    console.error("[llms.txt] settings unavailable:", error);
    return new Response("Not found", { status: 404 });
  }
}
