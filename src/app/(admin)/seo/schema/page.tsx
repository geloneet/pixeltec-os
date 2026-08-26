import { SEO_WIDTH, SeoPageHeader } from "@/components/seo/seo-ui";
import { PageSchemaEditor } from "@/components/seo/page-schema-editor";
import { getSetting } from "@/lib/settings/queries";
import { SETTING_PAGE_SCHEMA, SITE_PAGES, parsePageSchemaMap } from "@/lib/seo/page-schema";

export default async function SeoSchemaPage() {
  const map = parsePageSchemaMap(await getSetting(SETTING_PAGE_SCHEMA));
  return (
    <div className={SEO_WIDTH}>
      <SeoPageHeader
        title="Schema por página"
        description="Tipos de datos estructurados asignados a cada página del sitio. Las entradas del blog tienen su propio selector en la pestaña «Snippets» del editor."
      />
      <div className="mt-8">
        <PageSchemaEditor pages={SITE_PAGES} initial={map} />
      </div>
    </div>
  );
}
