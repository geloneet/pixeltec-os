import { SEO_WIDTH, SeoPageHeader } from "@/components/seo/seo-ui";
import { SitemapToggle } from "@/components/seo/sitemap-toggle";
import { getFlag } from "@/lib/settings/queries";
import { SETTING_SITEMAP_ENABLED } from "@/lib/seo/keys";
import { SEO_SITE } from "@/lib/seo/tools";

export default async function SeoSitemapPage() {
  // Ausente ⇒ encendido: el sitemap completo es lo que ya servía PixelTEC OS
  // antes de este módulo. Portarlo no puede apagarle el SEO al sitio.
  const enabled = await getFlag(SETTING_SITEMAP_ENABLED, true);
  return (
    <div className={SEO_WIDTH}>
      <SeoPageHeader
        title="Sitemap"
        description="El mapa del sitio que entregas a Google. Se genera solo a partir de tus páginas y de las entradas publicadas del blog."
      />
      <div className="mt-8">
        <SitemapToggle initialEnabled={enabled} sitemapUrl={`${SEO_SITE.url}/sitemap.xml`} />
      </div>
    </div>
  );
}
