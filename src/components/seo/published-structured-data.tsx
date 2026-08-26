import { getSettings } from '@/lib/settings/queries';
import { SEO_TOOLS } from '@/lib/seo/tools';

/**
 * JSON-LD publicado desde el módulo SEO (WO-2026-00095): «Negocio local» y
 * «Datos estructurados». Se renderiza en el layout raíz, junto al
 * `OrganizationStructuredData` que ya existía — no lo reemplaza.
 *
 * Solo emite lo que esté publicado Y sea JSON válido. Si la base de datos no
 * responde, no emite nada: una página sin schema extra es correcta; una con
 * JSON roto le rompe los rich results al sitio.
 */
export async function PublishedStructuredData() {
  let blocks: string[] = [];
  try {
    const tools = [SEO_TOOLS['local-business'], SEO_TOOLS['structured-data']];
    const stored = await getSettings(tools.flatMap((t) => [t.settingKey, t.enabledKey]));
    blocks = tools
      .filter((t) => stored[t.enabledKey] === '1')
      .map((t) => (stored[t.settingKey] ?? '').trim())
      .filter(Boolean)
      .filter((raw) => {
        try {
          JSON.parse(raw);
          return true;
        } catch {
          return false;
        }
      });
  } catch (error) {
    console.error('[seo] structured data unavailable:', error);
    return null;
  }

  if (blocks.length === 0) return null;

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
    </>
  );
}
