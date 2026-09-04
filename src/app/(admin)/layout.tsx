"use client";

import { validateEnv } from "@/lib/env-check";
validateEnv();

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import {
  PresentationModeProvider,
} from "@/context/PresentationModeContext";
import { CmdKProvider } from "@/components/cmd-k/CmdKProvider";
import { CRMProvider } from "@/components/crm/CRMContextCore";
import { CRMShellProvider } from "@/components/crm/CRMShellProvider";
import { TopNavigation } from "@/components/nav/top-navigation";
import { SecondaryNavigation } from "@/components/nav/secondary-navigation";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { AdminTopbar } from "@/components/nav/admin-topbar";
import { CommandPalette } from "@/components/nav/command-palette";
import { RestrictedShellBoundary } from "@/components/nav/restricted-shell-boundary";
import { getActiveArea, NAV_AREA_LABELS } from "@/components/nav/nav-config";

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({
  children,
  isFullBleedRoute,
}: {
  children: ReactNode;
  /** Rutas tipo app (sesión, WhatsApp): sin padding y con scroll interno propio. */
  isFullBleedRoute: boolean;
}) {
  const pathname = usePathname();
  const activeArea = getActiveArea(pathname);
  const { resolvedTheme } = useTheme();

  // Título de la pestaña (Miguel, 2026-08-26): con varios proyectos abiertos,
  // el título por defecto del sitio público no dice cuál es esta ventana. Se
  // hace aquí y no con `metadata` porque este layout es un Client Component.
  useEffect(() => {
    document.title = activeArea ? `PIXELTEC CRM · ${NAV_AREA_LABELS[activeArea]}` : "PIXELTEC CRM";
  }, [activeArea]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground font-sans">
      {/* Ambient gradient: glow azul/violeta sutil, marca PixelTEC. La misma
          intensidad que se ve bien sobre el fondo casi negro del dark
          "lava" un fondo claro (dos overlays translúcidos apilados sobre
          blanco leen como una mancha gris) — se reduce a la mitad en claro. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0",
          resolvedTheme === "light"
            ? "bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.035),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.025),transparent_50%)]"
            : "bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.06),transparent_50%)]"
        )}
      />

      <div className="relative z-10 flex h-full min-h-0 flex-1">
        {/* Sidebar flotante — solo desktop (`lg:` y superior). El mobile
            conserva TopNavigation completo, sin cambios (ver más abajo). */}
        <AppSidebar activeArea={activeArea} className="hidden lg:flex" />

        <div className="flex h-full min-h-0 flex-1 flex-col">
          {/* Mobile: rail horizontal original, intacto. */}
          <div className="lg:hidden">
            <TopNavigation />
            <SecondaryNavigation area={activeArea} />
          </div>

          {/* Desktop: topbar delgado, compañero del sidebar. */}
          <AdminTopbar activeArea={activeArea} className="hidden lg:flex" />

          <main
            className={cn(
              "min-h-0 flex-1",
              isFullBleedRoute
                ? "overflow-hidden"
                : "overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
            )}
          >
            {isFullBleedRoute ? (
              // Vistas full-bleed (WhatsApp inbox, sesión de proyecto) manejan su
              // propio scroll/posicionamiento interno — no se envuelven en el
              // motion.div animado para no romper overlays con position:fixed.
              children
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>
      </div>

      <Toaster
        richColors
        position="top-right"
        theme={(resolvedTheme as "light" | "dark" | "system" | undefined) ?? "dark"}
        toastOptions={{
          classNames: {
            toast:
              "border border-border bg-card/95 backdrop-blur-xl text-card-foreground",
          },
        }}
      />
    </div>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // `useSession().update()` (llamado tras guardar perfil/avatar) hace pasar
  // brevemente `status` por "loading" -> `useUser()` devuelve `undefined`
  // aunque la sesión siga siendo válida. Si en ese instante desmontamos TODO
  // el shell (sidebar, CRMProvider, Toaster) para mostrar el loader, se
  // pierde cualquier toast en vuelo y se reinicia la carga del CRM desde
  // cero. Por eso el gate de carga/login solo aplica en el primer render:
  // una vez autenticados, seguimos mostrando el shell a través de
  // revalidaciones de sesión posteriores.
  const hasLoadedRef = useRef(false);
  if (user) hasLoadedRef.current = true;

  useEffect(() => {
    if (user === null) {
      const redirect = encodeURIComponent(pathname || "/hoy");
      router.push(`/login?redirect=${redirect}`);
    }
  }, [user, router, pathname]);

  if (!hasLoadedRef.current) {
    if (user === undefined) {
      return (
        <div className="flex h-dvh w-full items-center justify-center bg-background">
          <Spinner size="lg" className="text-cyan-400" />
        </div>
      );
    }
    if (!user) return null;
  }

  return (
    <PresentationModeProvider>
      {/* WO-2026-00055: para un rol restringido (reviewer) pausa todo SWR del
          shell (p. ej. el poller de /api/vps/status de ⌘K) — sin fetch, sin
          403 en consola. Admin/staff: sin efecto. */}
      <RestrictedShellBoundary>
      <CmdKProvider>
        <CRMProvider>
          <CRMShellProvider>
            {/* WO-2026-00220: aquí también se comparaba contra `/sesion`, una
                ruta que ya no existe en `src/app` (murió con el pipeline de
                definición de proyectos). Único full-bleed vivo: WhatsApp. */}
            <Shell isFullBleedRoute={!!pathname?.startsWith("/whatsapp")}>
              {children}
            </Shell>
            <CommandPalette />
          </CRMShellProvider>
        </CRMProvider>
      </CmdKProvider>
      </RestrictedShellBoundary>
    </PresentationModeProvider>
  );
}
