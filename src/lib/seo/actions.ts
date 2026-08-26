'use server';

/**
 * Server Actions del módulo SEO (WO-2026-00095, paridad Muebles Encino
 * `src/app/actions/seo*.ts`) adaptadas a PixelTEC OS.
 *
 * Permisos: TODA escritura exige rol administrador. Estas herramientas cambian
 * lo que ven Google y los buscadores en pixeltec.mx — misma política que
 * publicar en el Blog.
 *
 * Generación con IA: `anthropicCreate`, la única puerta de inferencia
 * permitida (sin dependencias ni variables de entorno nuevas). No se llama a
 * `api.pixeltec.mx`: los prompts viven en el catálogo local.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth-guards';
import { anthropicCreate } from '@/lib/ai/anthropic-egress';
import { getModel } from '@/lib/blog/ai/client';
import { toPublicFailure } from '@/lib/errors/public-failure';
import type { ActionResult } from '@/lib/blog/schemas';
import { getSetting, setSetting } from '@/lib/settings/queries';
import { getSeoTool, isSeoToolKey, validateToolContent, SEO_SITE, type SeoTool } from './tools';
import { SETTING_PAGE_SCHEMA, parsePageSchemaMap, serializePageSchemaMap, type PageSchemaMap } from './page-schema';
import { SETTING_SOCIAL_LINKS, serializeSocialLinks, type SocialLink } from './social';
import { SETTING_SITEMAP_ENABLED } from './keys';

function fail(err: unknown, code: string, message: string): ActionResult<never> {
  console.error(`[seo] ${code}:`, err instanceof Error ? err.name : typeof err);
  return { ok: false, error: toPublicFailure(err, { code, message }).message };
}

/** Guard común: devuelve el id del admin o `null` si no lo es. */
async function adminId(): Promise<string | null> {
  const guard = await requireAdmin();
  return guard.ok ? guard.uid : null;
}

/** Las superficies públicas que dependen de los ajustes SEO. */
function revalidateSeoSurfaces() {
  revalidatePath('/robots.txt');
  revalidatePath('/llms.txt');
  revalidatePath('/sitemap.xml');
  revalidatePath('/', 'layout');
}

const SaveToolSchema = z.object({
  key: z.string().max(40),
  content: z.string().max(100_000),
  enabled: z.boolean(),
});

/** Guarda el contenido y el interruptor de una herramienta. */
export async function saveSeoTool(input: z.infer<typeof SaveToolSchema>): Promise<ActionResult> {
  try {
    const actor = await adminId();
    if (!actor) return { ok: false, error: 'Necesitas rol administrador.' };

    const data = SaveToolSchema.parse(input);
    if (!isSeoToolKey(data.key)) return { ok: false, error: 'Herramienta desconocida.' };
    const tool = getSeoTool(data.key) as SeoTool;

    const invalid = validateToolContent(tool, data.content);
    if (invalid) return { ok: false, error: invalid };

    await setSetting(tool.settingKey, data.content, actor);
    await setSetting(tool.enabledKey, data.enabled ? '1' : '0', actor);
    revalidateSeoSurfaces();
    return { ok: true };
  } catch (err) {
    return fail(err, 'save_tool_failed', 'No se pudo guardar la herramienta.');
  }
}

/**
 * «Crear con IA»: genera el contenido de una herramienta con las reglas del
 * catálogo local más los datos reales del sitio. NO guarda — devuelve el
 * borrador para que Miguel lo revise y decida.
 */
export async function generateSeoTool(key: string): Promise<ActionResult<{ content: string }>> {
  try {
    const actor = await adminId();
    if (!actor) return { ok: false, error: 'Necesitas rol administrador.' };
    if (!isSeoToolKey(key)) return { ok: false, error: 'Herramienta desconocida.' };
    const tool = getSeoTool(key) as SeoTool;

    const context = [
      `Sitio: ${SEO_SITE.name}`,
      `URL: ${SEO_SITE.url}`,
      `Sitemap: ${SEO_SITE.url}/sitemap.xml`,
      'Rutas públicas: /, /services, /pixelbot, /blog, /industrias, /diagnostico, /about, /equipo, /contact, /metodologia, /guias-transformacion',
      'Rutas privadas que NO deben rastrearse: /login, /portal, /hoy, /clientes, /whatsapp, /cobros, /blog-cms, /usuarios, /api',
    ].join('\n');

    const message = await anthropicCreate({
      operation: 'generate_text',
      model: getModel(),
      buildParams: () => ({
        max_tokens: 2000,
        system: tool.prompt,
        messages: [{ role: 'user' as const, content: `Datos del sitio:\n${context}` }],
      }),
    });

    const content = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .replace(/^```[a-z]*\n?|\n?```$/g, '')
      .trim();

    if (!content) return { ok: false, error: 'La IA no devolvió contenido.' };
    const invalid = validateToolContent(tool, content);
    if (invalid) return { ok: false, error: `La IA devolvió algo inválido: ${invalid}` };

    return { ok: true, data: { content } };
  } catch (err) {
    return fail(err, 'generate_tool_failed', 'No se pudo generar con IA.');
  }
}

/** Enciende o apaga el sitemap completo (apagado ⇒ solo la portada). */
export async function setSitemapEnabled(enabled: boolean): Promise<ActionResult> {
  try {
    const actor = await adminId();
    if (!actor) return { ok: false, error: 'Necesitas rol administrador.' };
    await setSetting(SETTING_SITEMAP_ENABLED, enabled ? '1' : '0', actor);
    revalidatePath('/sitemap.xml');
    return { ok: true };
  } catch (err) {
    return fail(err, 'sitemap_toggle_failed', 'No se pudo cambiar el sitemap.');
  }
}

/** Reemplaza los tipos de schema asignados a una ruta del sitio. */
export async function savePageSchema(path: string, types: string[]): Promise<ActionResult> {
  try {
    const actor = await adminId();
    if (!actor) return { ok: false, error: 'Necesitas rol administrador.' };

    const map: PageSchemaMap = parsePageSchemaMap(await getSetting(SETTING_PAGE_SCHEMA));
    map[path] = types;
    const serialized = serializePageSchemaMap(map);
    // Una ruta desconocida se cae al serializar: si no sobrevivió y se pedían
    // tipos, la ruta no es del catálogo.
    if (types.length > 0 && !JSON.parse(serialized)[path]) {
      return { ok: false, error: 'Esa página no está en el catálogo del sitio.' };
    }
    await setSetting(SETTING_PAGE_SCHEMA, serialized, actor);
    revalidateSeoSurfaces();
    return { ok: true };
  } catch (err) {
    return fail(err, 'page_schema_failed', 'No se pudo guardar el schema de la página.');
  }
}

/** Guarda los enlaces de redes sociales. */
export async function saveSocialLinks(links: SocialLink[]): Promise<ActionResult> {
  try {
    const actor = await adminId();
    if (!actor) return { ok: false, error: 'Necesitas rol administrador.' };
    await setSetting(SETTING_SOCIAL_LINKS, serializeSocialLinks(links), actor);
    revalidateSeoSurfaces();
    return { ok: true };
  } catch (err) {
    return fail(err, 'social_links_failed', 'No se pudieron guardar las redes.');
  }
}
