import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Wand2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth/config";
import { listPixelforgeProjectsByOwner } from "@/lib/db/repos/pixelforge";
import { PixelforgeStatusBadge } from "@/components/pixelforge/PixelforgeStatusBadge";

export const metadata: Metadata = {
  title: "PixelForge — PixelTEC OS",
};

export default async function PixelforgeListPage() {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge");

  const projects = await listPixelforgeProjectsByOwner(ownerId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">PixelForge</h1>
          <p className="text-sm text-muted-foreground">
            Landings producidas por IA, estación por estación, de contexto a revisión final
          </p>
        </div>
        <Link
          href="/proyectos/pixelforge/nueva"
          className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400"
        >
          <Plus className="h-4 w-4" />
          Nuevo proyecto
        </Link>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <Wand2 className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Aún no hay proyectos PixelForge</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Empieza uno con el botón &ldquo;Nuevo proyecto&rdquo; de arriba.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
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
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-cyan-400/30 hover:bg-secondary/40"
            >
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 flex-shrink-0 text-cyan-300" strokeWidth={1.75} />
                <h2 className="truncate text-sm font-semibold text-foreground">{p.title}</h2>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {p.clientName ?? "Cliente"}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <PixelforgeStatusBadge status={p.status} currentStation={p.currentStation} />
              </div>
              <p className="mt-auto pt-1 text-[11px] text-muted-foreground/60">
                Actualizado{" "}
                {formatDistanceToNow(new Date(p.updatedAt), {
                  addSuffix: true,
                  locale: es,
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
