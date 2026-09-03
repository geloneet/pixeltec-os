import Link from "next/link";
import { SEO_WIDTH, SeoCard, SeoPageHeader } from "@/components/seo/seo-ui";
import { getContentOverview, type ContentRow } from "@/lib/seo-insights/queries";
import { formatDelta, type Delta } from "@/lib/seo-insights/period";
import { CONTENT_ROLE_LABELS } from "@/lib/seo-insights/classify";
import { READ_DEPTH } from "@/lib/analytics/events";
import { WINDOW_DAYS } from "@/lib/seo-insights/config";

/**
 * SEO & Contenido (WO-2026-00214, Fase 1) — qué contenido trae gente, quién la
 * retiene y qué acaba en lead.
 *
 * Lo que esta pantalla NO hace todavía: mostrar impresiones, clics, posición ni
 * CTR. Esos datos vienen de Search Console y hasta que la credencial esté
 * cargada se muestra un estado vacío explícito. Pintar ceros ahí haría que un
 * contenido sano pareciera muerto — y un dashboard que confunde "no lo sé" con
 * "cero" deja de ser confiable para todo lo demás.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

export const metadata = { title: "Contenido" };

/** La pantalla lee eventos en vivo; una versión cacheada no serviría de nada. */
export const dynamic = "force-dynamic";

function DeltaBadge({ value }: { value: Delta }) {
  const tone =
    value.direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : value.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  return <span className={`ml-1.5 text-[11px] tabular-nums ${tone}`}>{formatDelta(value)}</span>;
}

function MetricCell({ current, delta }: { current: number; delta: Delta }) {
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
      {current}
      <DeltaBadge value={delta} />
    </td>
  );
}

function ContentRowCells({ row }: { row: ContentRow }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <Link
          href={row.path}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground hover:text-primary"
        >
          {row.title}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">{row.path}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
        {row.kind === "blog" ? "Artículo" : "Landing"} · {CONTENT_ROLE_LABELS[row.role]}
      </td>
      <MetricCell current={row.current.views} delta={row.deltas.views} />
      <MetricCell current={row.current.reads} delta={row.deltas.reads} />
      <MetricCell current={row.current.ctaClicks} delta={row.deltas.ctaClicks} />
      <MetricCell current={row.current.leads} delta={row.deltas.leads} />
      <MetricCell current={row.current.qualified} delta={row.deltas.qualified} />
    </tr>
  );
}

export default async function SeoContenidoPage() {
  const overview = await getContentOverview();
  const { windows, rows, totals, searchConsoleConnected } = overview;

  const sinDatos = totals.current.views === 0 && totals.previous.views === 0;

  return (
    <div className={SEO_WIDTH}>
      <SeoPageHeader
        title="Contenido"
        description={`Qué contenido trae gente y qué acaba en lead. Últimos ${WINDOW_DAYS} días (${windows.current.start} → ${windows.current.end}) comparados con los ${WINDOW_DAYS} anteriores.`}
      />

      <div className="mt-8 space-y-6">
        {!searchConsoleConnected && (
          <SeoCard title="Search Console">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Search Console aún no conectado.</strong> Las columnas de
              impresiones, clics, CTR y posición estarán vacías hasta que se carguen{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">EGRESS_GOOGLE_MODE</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_SERVICE_ACCOUNT_JSON</code> y{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">GSC_SITE_URL</code>, y corra el cron{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/cron/seo-gsc-sync</code>. No se
              muestran ceros en su lugar: un cero y un &laquo;no lo sé&raquo; no son lo mismo.
            </p>
          </SeoCard>
        )}

        {sinDatos && (
          <SeoCard title="Sin eventos todavía">
            <p className="text-sm text-muted-foreground">
              No hay eventos de contenido registrados en la ventana. Es lo esperado hasta que la migración{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">0051</code> esté aplicada y el sitio
              público haya recibido visitas con el tracker activo.
            </p>
          </SeoCard>
        )}

        <SeoCard title={`Resumen · últimos ${WINDOW_DAYS} días`}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(
              [
                ["Visitas", totals.current.views, totals.previous.views],
                [`Lectura ${READ_DEPTH}%`, totals.current.reads, totals.previous.reads],
                ["Clics en CTA", totals.current.ctaClicks, totals.previous.ctaClicks],
                ["Leads", totals.current.leads, totals.previous.leads],
                ["Calificados", totals.current.qualified, totals.previous.qualified],
              ] as const
            ).map(([label, current, previous]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {current}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    vs {previous}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </SeoCard>

        <SeoCard title="Por contenido">
          {/* La tabla es ancha: hace scroll dentro de su caja para que la página
              nunca haga scroll horizontal. */}
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 text-left font-medium">Contenido</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Tipo · Función</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Visitas</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Lectura {READ_DEPTH}%</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">CTA</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Leads</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Calificados</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ContentRowCells key={row.path} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay contenido publicado que medir todavía.
            </p>
          )}
        </SeoCard>
      </div>
    </div>
  );
}
