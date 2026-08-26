/**
 * Pantalla genérica de una herramienta SEO (WO-2026-00095) — paridad con
 * `seo-tool-page.tsx` de Muebles Encino: las cuatro herramientas comparten
 * pantalla y solo cambian su ficha del catálogo.
 */
import { notFound } from "next/navigation";
import { SEO_WIDTH, SeoPageHeader } from "@/components/seo/seo-ui";
import { SeoToolEditor } from "@/components/seo/tool-editor";
import { getSeoTool, type SeoToolKey } from "@/lib/seo/tools";
import { getSettings } from "@/lib/settings/queries";

const PUBLIC_PATH: Partial<Record<SeoToolKey, string>> = {
  llms: "/llms.txt",
  robots: "/robots.txt",
};

export async function SeoToolPage({ toolKey }: { toolKey: SeoToolKey }) {
  const tool = getSeoTool(toolKey);
  if (!tool) notFound();

  const stored = await getSettings([tool.settingKey, tool.enabledKey]);

  return (
    <div className={SEO_WIDTH}>
      <SeoPageHeader title={tool.title} description={tool.description} />
      <div className="mt-8">
        <SeoToolEditor
          tool={{ key: tool.key, title: tool.title, description: tool.description, format: tool.format }}
          initialContent={stored[tool.settingKey] ?? ""}
          initialEnabled={stored[tool.enabledKey] === "1"}
          publicPath={PUBLIC_PATH[toolKey]}
        />
      </div>
    </div>
  );
}
