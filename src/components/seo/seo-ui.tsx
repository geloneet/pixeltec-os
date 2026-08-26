/**
 * Piezas compartidas del módulo SEO (WO-2026-00095) — paridad con
 * `seo-ui.tsx` de Muebles Encino, con los tokens de PixelTEC OS.
 */
import type { ReactNode } from "react";

/** Ancho de lectura común a todas las pantallas del módulo. */
export const SEO_WIDTH = "mx-auto w-full max-w-3xl";

export function SeoPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="space-y-1.5">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

export function SeoCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {title ? (
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}

const DOT: Record<"ok" | "warn" | "off", string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  off: "bg-muted-foreground/40",
};

export function StatusDot({ status }: { status: "ok" | "warn" | "off" }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} />;
}
