import Link from "next/link";
import { SEO_WIDTH, SeoCard, SeoPageHeader, StatusDot } from "@/components/seo/seo-ui";
import { getSettings, getFlag } from "@/lib/settings/queries";
import { SEO_TOOLS } from "@/lib/seo/tools";
import { SETTING_PAGE_SCHEMA, parsePageSchemaMap } from "@/lib/seo/page-schema";
import { SETTING_SOCIAL_LINKS, parseSocialLinks, visibleSocialLinks } from "@/lib/seo/social";
import { SETTING_SITEMAP_ENABLED } from "@/lib/seo/keys";
import { buildHealthChecks, summarizeHealth, type SeoSnapshot } from "@/lib/seo/health";
import { getPublishedPosts } from "@/lib/blog/queries/posts";

/**
 * Salud SEO (WO-2026-00095) — paridad con `/seo/salud` de Muebles Encino.
 * Reúne el estado real de cada pieza y delega el veredicto en la función pura
 * `buildHealthChecks`, que sí está cubierta por tests.
 */
export default async function SeoHealthPage() {
  const keys = [
    ...Object.values(SEO_TOOLS).flatMap((t) => [t.settingKey, t.enabledKey]),
    SETTING_PAGE_SCHEMA,
    SETTING_SOCIAL_LINKS,
  ];
  const stored = await getSettings(keys);

  const has = (k: string) => (stored[k] ?? "").trim().length > 0;
  const on = (k: string) => stored[k] === "1";

  const posts = await getPublishedPosts().catch(() => []);

  const snapshot: SeoSnapshot = {
    llms: { enabled: on(SEO_TOOLS.llms.enabledKey), hasContent: has(SEO_TOOLS.llms.settingKey) },
    robots: { enabled: on(SEO_TOOLS.robots.enabledKey), hasContent: has(SEO_TOOLS.robots.settingKey) },
    localBusiness: {
      enabled: on(SEO_TOOLS["local-business"].enabledKey),
      hasContent: has(SEO_TOOLS["local-business"].settingKey),
    },
    structuredData: {
      enabled: on(SEO_TOOLS["structured-data"].enabledKey),
      hasContent: has(SEO_TOOLS["structured-data"].settingKey),
    },
    sitemapEnabled: await getFlag(SETTING_SITEMAP_ENABLED, true),
    pageSchemaCount: Object.keys(parsePageSchemaMap(stored[SETTING_PAGE_SCHEMA])).length,
    socialCount: visibleSocialLinks(parseSocialLinks(stored[SETTING_SOCIAL_LINKS])).length,
    blog: {
      published: posts.length,
      missingMetaDescription: posts.filter((p) => !(p.seo?.metaDescription ?? p.excerpt ?? "").trim()).length,
    },
  };

  const checks = buildHealthChecks(snapshot);
  const totals = summarizeHealth(checks);

  return (
    <div className={SEO_WIDTH}>
      <SeoPageHeader
        title="Salud SEO"
        description="Un vistazo a qué está publicado, qué está a medias y qué falta. Cada fila lleva al sitio donde se arregla."
      />

      <div className="mt-8 grid grid-cols-3 gap-3">
        {(
          [
            ["ok", "Publicado", totals.ok],
            ["warn", "A medias", totals.warn],
            ["off", "Sin usar", totals.off],
          ] as const
        ).map(([status, label, value]) => (
          <SeoCard key={status}>
            <div className="flex items-center gap-2">
              <StatusDot status={status} />
              <span className="text-2xl font-semibold text-foreground">{value}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </SeoCard>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {checks.map((check) => (
          <Link
            key={check.id}
            href={check.href}
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
          >
            <div className="flex items-center gap-2">
              <StatusDot status={check.status} />
              <p className="text-sm font-medium text-foreground">{check.label}</p>
            </div>
            <p className="mt-1 pl-4 text-xs text-muted-foreground">{check.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
