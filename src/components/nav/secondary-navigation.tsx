"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCRM } from "@/components/crm/CRMContextCore";
import { cn } from "@/lib/utils";
import { PALETTE_NAV_ITEMS } from "./command-palette-items";
import { resolveActiveHref, getSecondaryItems, type NavArea } from "./nav-config";

/**
 * Segundo nivel de la Top Navigation: submenú horizontal del área activa.
 * Se colapsa por completo (altura 0) cuando el área no tiene submódulos
 * (p. ej. "Hoy"), en vez de mostrar una barra vacía o de un solo item.
 */
export function SecondaryNavigation({ area }: { area: NavArea | null }) {
  const pathname = usePathname();
  const { clients } = useCRM();
  const items = area ? getSecondaryItems(area) : [];
  const activeHref = resolveActiveHref(PALETTE_NAV_ITEMS, pathname);

  const openTasksCount = clients
    .flatMap((c) => c.projects)
    .flatMap((p) => p.tasks)
    .filter(
      (t) =>
        t.status === "pendiente" ||
        t.status === "en_progreso" ||
        t.status === "en_revision"
    ).length;

  return (
    <AnimatePresence initial={false}>
      {items.length > 1 && (
        <motion.div
          key={area}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden border-b border-white/10 bg-[#030303]/60 backdrop-blur-md"
        >
          <nav
            aria-label={`Submenú de ${area}`}
            className="scrollbar-none mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8"
          >
            {items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
                    active ? "text-white" : "text-zinc-400 hover:text-white"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-secondary-nav-active-pill"
                      className="absolute inset-0 rounded-full bg-white/10"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {item.secondaryLabel}
                    {item.href === "/tareas" && openTasksCount > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500/20 px-1 text-[10px] font-semibold text-cyan-300">
                        {openTasksCount}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
