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
import { CommandPalette } from "@/components/nav/command-palette";
import { getActiveArea } from "@/components/nav/nav-config";

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

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground font-sans">
      {/* Ambient gradient: glow azul/violeta, igual que el resto del dark del sitio */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.06),transparent_50%)]"
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <TopNavigation />
        <SecondaryNavigation area={activeArea} />

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
      <CmdKProvider>
        <CRMProvider>
          <CRMShellProvider>
            <Shell
              isFullBleedRoute={
                !!pathname?.includes("/sesion") || !!pathname?.startsWith("/whatsapp")
              }
            >
              {children}
            </Shell>
            <CommandPalette />
          </CRMShellProvider>
        </CRMProvider>
      </CmdKProvider>
    </PresentationModeProvider>
  );
}
