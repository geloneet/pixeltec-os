"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PALETTE_NAV_ITEMS } from "@/components/nav/command-palette-items";
import { isNavItemVisible } from "@/components/nav/nav-config";

/**
 * Accesos rápidos del 404 del admin: se derivan del catálogo de navegación y
 * del registro central de módulos (WO-2026-00088) — un destino oculto
 * desaparece de aquí sin editar este archivo.
 */
const QUICK_LINK_HREFS = ["/hoy", "/clientes", "/accesos"] as const;

export const QUICK_LINKS = QUICK_LINK_HREFS.map((href) =>
  PALETTE_NAV_ITEMS.find((item) => item.href === href)
)
  .filter((item): item is (typeof PALETTE_NAV_ITEMS)[number] => !!item && isNavItemVisible(item))
  .map(({ href, icon, label }) => ({ href, icon, label }));

export function AdminNotFoundClient() {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center px-4">
      {/* Eyebrow */}
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        404 · NOT FOUND
      </p>

      {/* Heading + URL block */}
      <div className="max-w-md space-y-3">
        <h1 className="text-3xl font-semibold text-slate-100">
          Esta ruta no existe
        </h1>
        <p className="text-sm text-slate-400">
          La URL que intentaste abrir no está disponible o fue movida.
        </p>
        <code className="mt-2 block rounded-md border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-300">
          {pathname}
        </code>
      </div>

      {/* Quick links */}
      <div className="w-full max-w-sm">
        <p className="mb-3 text-xs uppercase tracking-wider text-slate-500">
          Accesos rápidos
        </p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_LINKS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-slate-800 p-3 text-sm",
                "bg-slate-900/40 text-slate-300",
                "hover:bg-slate-800/60 hover:text-slate-100",
                "transition-all duration-150"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0 text-slate-500" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* kbd hint */}
      <p className="text-xs text-slate-500">
        Tip: usa{" "}
        <kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-xs">
          ⌘K
        </kbd>
        {" "}para buscar cualquier sección
      </p>
    </div>
  );
}
