import { getSettings } from '@/lib/settings/queries';
import { SEO_TOOLS } from '@/lib/seo/tools';
import { PageSchemaJsonLd } from './page-schema-jsonld';
import { SETTING_PAGE_SCHEMA, parsePageSchemaMap, type PageSchemaMap } from '@/lib/seo/page-schema';
import { mergePublishedGraph } from '@/lib/seo/structured-graph';
import { CODE_EMITTED_IDS } from './structured-data';

/**
 * JSON-LD publicado desde el módulo SEO (WO-2026-00095): «Negocio local»,
 * «Datos estructurados» y el «Schema por página» de `/seo/schema`. Se renderiza
 * en el layout raíz, junto al `OrganizationStructuredData` que ya existía — no
 * lo reemplaza.
 *
 * Solo emite lo que esté publicado Y sea JSON válido. Si la base de datos no
 * responde, no emite nada: una página sin schema extra es correcta; una con
 * JSON roto le rompe los rich results al sitio.
 */
export async function PublishedStructuredData() {
  let blocks: string[] = [];
  let pageSchema: PageSchemaMap = {};
  try {
    const tools = [SEO_TOOLS['local-business'], SEO_TOOLS['structured-data']];
    const stored = await getSettings([
      ...tools.flatMap((t) => [t.settingKey, t.enabledKey]),
      SETTING_PAGE_SCHEMA,
    ]);
    pageSchema = parsePageSchemaMap(stored[SETTING_PAGE_SCHEMA]);
    blocks = tools
      .filter((t) => stored[t.enabledKey] === '1')
      .map((t) => (stored[t.settingKey] ?? '').trim())
      .filter(Boolean)
      // SEO-03 (WO-2026-00268): el prompt de «Datos estructurados» pide
      // Organization y WebSite, que el código YA emite desde site-config con
      // más campos. Sin este filtro la página salía con dos nodos del mismo
      // `@id` y datos distintos, y Google elegía uno arbitrariamente. Lo que
      // el código no emite (LocalBusiness, etc.) pasa intacto.
      // `mergePublishedGraph` valida el JSON de paso: devuelve null si está roto.
      .map((raw) => mergePublishedGraph(CODE_EMITTED_IDS, raw))
      .filter((raw): raw is string => raw !== null);
  } catch (error) {
    console.error('[seo] structured data unavailable:', error);
    return null;
  }

  // Ojo: el schema por página se emite SIEMPRE que haya mapa, aunque no haya
  // bloques publicados — son dos ajustes independientes. Un `return null`
  // temprano por `blocks` vacío se llevaría también el JSON-LD por ruta (que es
  // justo el bug que arregló WO-2026-00220).
  return (
    <>
      {blocks.map((raw, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Ya validado como JSON arriba; se re-serializa para neutralizar
          // cualquier `</script>` incrustado en el texto guardado.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON.parse(raw)) }}
        />
      ))}
      <PageSchemaJsonLd map={pageSchema} />
    </>
  );
}
