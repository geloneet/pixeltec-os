import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth/config";
import { listPixelforgeProjectsByOwner } from "@/lib/db/repos/pixelforge";
import { ForgeZone, type ForgeState } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeStationBadge } from "@/components/pixelforge/forge/ForgeStationBadge";
import { getStationMeta } from "@/lib/pixelforge/station-meta";

export const metadata: Metadata = {
  title: "PixelForge — PixelTEC OS",
};

/**
 * Estado de la plancha (materialidad DNA) según el status del proyecto:
 * lo aprobado/completado está SELLADO (frío, sólido, con notch); lo demás
 * (borrador / en progreso) es una plancha con veta tenue en reposo.
 */
function forgeStateForStatus(
  status: "draft" | "in_progress" | "completed" | "approved",
): ForgeState {
  return status === "approved" || status === "completed" ? "sealed" : "draft";
}

export default async function PixelforgeListPage() {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge");

  const projects = await listPixelforgeProjectsByOwner(ownerId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-pfx-text">
            PixelForge
          </h1>
          <p className="mt-1 text-sm text-pfx-text-muted">
            Landings producidas por IA, estación por estación, de contexto a revisión final
          </p>
        </div>
        <Link
          href="/proyectos/pixelforge/nueva"
          className="inline-flex shrink-0 items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-semibold text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pfx-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pfx-canvas"
        >
          <Plus className="h-4 w-4" />
          Nuevo proyecto
        </Link>
      </header>

      {projects.length === 0 ? (
        <ForgeZone variant="elevated" className="px-6 py-16 text-center">
          {/* Icono neutro (plancha/landing) con acento cobre — nada de cyan. */}
          <LayoutTemplate
            className="mx-auto mb-3 h-7 w-7 text-pfx-accent"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-pfx-text">
            El taller está vacío
          </p>
          <p className="mt-1 text-xs text-pfx-text-muted">
            Forja tu primera landing con el botón &ldquo;Nuevo proyecto&rdquo; de arriba.
          </p>
        </ForgeZone>
      ) : (
        // Filas-plancha ancladas y apiladas (gap mínimo), NO grid de tarjetas.
        <div className="flex flex-col gap-2">
          {projects.map((p) => {
            const station = getStationMeta(p.currentStation);
            return (
              <Link
                key={p.id}
                // Enlaza directo a la estación actual (no al `[id]` pelado):
                // ese `[id]/page.tsx` hace un `redirect()` server-side que, en
                // navegación cliente, encadena dos cambios de pathname seguidos
                // sobre el `motion.div key={pathname}` del shell — eso es lo
                // que dispara el "Rendered more hooks than during the previous
                // render" al entrar desde este listado. La ruta `[id]` pelada
                // se mantiene como fallback válido para acceso directo por URL.
                href={`/proyectos/pixelforge/${p.id}/${p.currentStation}`}
                className="group block rounded-[var(--pfx-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pfx-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pfx-canvas"
              >
                <ForgeZone
                  state={forgeStateForStatus(p.status)}
                  className="p-4 transition-colors group-hover:border-pfx-accent group-hover:bg-pfx-surface-elevated"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    {/* Nombre + badge (juntos arriba en móvil). */}
                    <div className="flex min-w-0 items-center gap-2.5 sm:flex-1">
                      <h2 className="truncate font-semibold text-pfx-text">
                        {p.title}
                      </h2>
                      <span className="shrink-0">
                        <ForgeStationBadge status={p.status} currentStation={p.currentStation} />
                      </span>
                    </div>
                    {/* Metadata (abajo en móvil, a la derecha en desktop). */}
                    <div className="flex min-w-0 items-center gap-3 sm:justify-end">
                      <span className="truncate text-xs text-pfx-text-muted">
                        {p.clientName ?? "Cliente"}
                      </span>
                      <span className="shrink-0 font-forge-mono text-[11px] uppercase tracking-wider text-pfx-text-muted">
                        {station.stepLabel}
                      </span>
                      <span className="shrink-0 font-forge-mono text-[11px] text-pfx-text-muted">
                        {formatDistanceToNow(new Date(p.updatedAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </div>
                  </div>
                </ForgeZone>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
