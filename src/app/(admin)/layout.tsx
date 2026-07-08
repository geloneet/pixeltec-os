"use client";

import { validateEnv } from "@/lib/env-check";
validateEnv();

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { LoaderCircle } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import {
  PresentationModeProvider,
} from "@/context/PresentationModeContext";
import { CmdKProvider } from "@/components/cmd-k/CmdKProvider";
import { CRMProvider } from "@/components/crm/CRMContextCore";
import { CRMShellProvider } from "@/components/crm/CRMShellProvider";
import { GlobalHeader } from "@/components/nav/global-header";
import { DesktopSidebar } from "@/components/nav/desktop-sidebar";
import { CommandPalette } from "@/components/nav/command-palette";

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({
  children,
  isFullBleedRoute,
}: {
  children: ReactNode;
  /** Rutas tipo app (sesión, WhatsApp): sin padding y con scroll interno propio. */
  isFullBleedRoute: boolean;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="h-dvh w-full flex bg-background text-foreground font-sans overflow-hidden">
      {/* Ambient gradient: glow azul/violeta solo en dark; en light, tinte azul muy sutil */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(33,150,243,0.03),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.06),transparent_50%)]"
      />

      {/* Desktop sidebar — visible only ≥1280px */}
      <div className={cn("relative z-10 hidden xl:block flex-shrink-0")}>
        <DesktopSidebar />
      </div>

      {/* Main column */}
      <div className="relative z-10 flex-1 flex flex-col h-full min-w-0">
        <GlobalHeader />
        <main
          className={cn(
            "flex-1",
            isFullBleedRoute
              ? "overflow-hidden"
              : "overflow-y-auto p-4 sm:p-6 lg:p-8"
          )}
        >
          {children}
        </main>
      </div>

      <Toaster
        richColors
        position="top-right"
        theme={resolvedTheme === "light" ? "light" : "dark"}
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
          <LoaderCircle className="h-10 w-10 animate-spin text-cyan-400" />
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
