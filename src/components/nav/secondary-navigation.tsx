"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  const items = area ? getSecondaryItems(area) : [];
  const activeHref = resolveActiveHref(PALETTE_NAV_ITEMS, pathname);

  return (
    <AnimatePresence initial={false}>
      {items.length > 1 && (
        <motion.div
          key={area}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden border-b border-border bg-background/60 backdrop-blur-md"
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
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-secondary-nav-active-pill"
                      className="absolute inset-0 rounded-full bg-secondary/60"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {item.secondaryLabel}
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
