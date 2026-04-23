"use client";

import { validateEnv } from "@/lib/env-check";
validateEnv();

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  LoaderCircle,
  LogOut,
  Menu,
  Monitor,
  Search,
} from "lucide-react";
import { Toaster } from "sonner";
import { signOut } from "firebase/auth";
import { cn } from "@/lib/utils";
import { useUser, useAuth } from "@/firebase";
import { useUserProfile } from "@/firebase/auth/use-user-profile";
import {
  PresentationModeProvider,
  usePresentationMode,
} from "@/context/PresentationModeContext";
import { CmdKProvider, useCmdK } from "@/components/cmd-k/CmdKProvider";
import { CmdKDialog } from "@/components/cmd-k/CmdKDialog";
import { AdminSidebar, ADMIN_NAV_ITEMS } from "@/components/admin-sidebar";
import { CRMProvider } from "@/components/crm/CRMContext";
import { CRMShellProvider } from "@/components/crm/CRMShellProvider";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isNavActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Mobile drawer content ────────────────────────────────────────────────────

function MobileNav({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();

  const handleLogout = async () => {
    if (!auth) return;
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Branding */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5 flex-shrink-0">
        <Image
          src={process.env.NEXT_PUBLIC_LOGO_URL!}
          alt="PixelTEC"
          width={32}
          height={32}
          className="flex-shrink-0"
        />
        <span className="font-logo font-extrabold uppercase tracking-tighter text-xl text-gray-100">
          Pixel<span className="text-brand-blue">Tec</span>
        </span>
      </div>

      {/* Nav items */}
      <nav
        className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto"
        aria-label="Navegación principal"
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = isNavActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                active
                  ? "bg-cyan-950/40 text-cyan-400"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/5 flex-shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ─── Pill nav item (desktop only) ────────────────────────────────────────────

function PillNavItem({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "px-5 py-2 rounded-full text-sm font-medium transition-colors",
        active ? "bg-white text-black" : "text-white/60 hover:text-white"
      )}
    >
      {label}
    </Link>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { userProfile } = useUserProfile();
  const { isPresentationMode, setPresentationMode } = usePresentationMode();
  const { setOpen: setCmdKOpen } = useCmdK();
  const pathname = usePathname();

  const currentLabel =
    ADMIN_NAV_ITEMS.find((item) => isNavActive(item.href, pathname))?.label ??
    "PixelTEC OS";

  return (
    <header className="relative flex-shrink-0 w-full flex items-center justify-between py-3 px-4 md:py-4 md:px-8">
      {/* LEFT — hamburger (mobile) | logo+branding (desktop) */}
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Abrir menú"
          className="md:hidden flex items-center justify-center h-10 w-10 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-300"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo + branding — desktop only */}
        <div
          className={cn(
            "hidden md:flex items-center gap-3 transition-all duration-500",
            isPresentationMode ? "scale-110" : "scale-100"
          )}
        >
          <Image
            src={process.env.NEXT_PUBLIC_LOGO_URL!}
            alt="PixelTEC Logo"
            width={isPresentationMode ? 48 : 40}
            height={isPresentationMode ? 48 : 40}
            className="hover:scale-110 transition-transform"
          />
          <span
            className={cn(
              "font-logo font-extrabold uppercase tracking-tighter text-gray-100 transition-all duration-300",
              isPresentationMode ? "text-3xl" : "text-2xl"
            )}
          >
            Pixel<span className="text-brand-blue">Tec</span>
          </span>
        </div>
      </div>

      {/* CENTER — pill nav (desktop, absolute) | page title (mobile, absolute) */}

      {/* Desktop pill nav */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 hidden md:block transition-opacity duration-500",
          isPresentationMode ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <div className="bg-white/5 rounded-full p-2 border border-white/10 backdrop-blur-md flex items-center gap-1">
          {ADMIN_NAV_ITEMS.map((item) => (
            <PillNavItem
              key={item.href}
              label={item.label}
              href={item.href}
              active={isNavActive(item.href, pathname)}
            />
          ))}
        </div>
      </div>

      {/* Mobile page title */}
      <span className="md:hidden absolute left-1/2 -translate-x-1/2 font-logo font-bold uppercase tracking-tighter text-gray-100 text-lg pointer-events-none select-none whitespace-nowrap">
        {currentLabel}
      </span>

      {/* RIGHT — actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Search — desktop only */}
        <button
          type="button"
          onClick={() => setCmdKOpen(true)}
          className={cn(
            "hidden md:flex items-center gap-2 h-11 px-4 rounded-full border backdrop-blur-md bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-300",
            isPresentationMode && "opacity-0 pointer-events-none"
          )}
          aria-label="Buscar (Cmd+K)"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">Buscar</span>
          <kbd className="ml-2 inline-flex items-center rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
            ⌘K
          </kbd>
        </button>

        {/* Presentation mode — desktop only */}
        <button
          type="button"
          onClick={() => setPresentationMode((prev) => !prev)}
          aria-label="Modo presentación"
          className={cn(
            "hidden md:flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md cursor-pointer transition-all duration-300",
            isPresentationMode
              ? "bg-cyan-400/20 text-cyan-400 border-cyan-400/30"
              : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
          )}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Bell — all sizes, compact on mobile */}
        <button
          type="button"
          aria-label="Notificaciones"
          className={cn(
            "relative flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer text-zinc-400 hover:text-white hover:bg-white/10 transition-all",
            isPresentationMode && "opacity-0 pointer-events-none"
          )}
        >
          <Bell className="w-4 h-4 md:w-5 md:h-5" />
          <div className="absolute top-1.5 right-1.5 md:top-2.5 md:right-3 h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-lime-400 border-2 border-[#030303]" />
        </button>

        {/* Avatar + role badge — all sizes */}
        <div
          className={cn(
            "relative transition-opacity duration-500",
            isPresentationMode ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <Image
            src={process.env.NEXT_PUBLIC_PROFILE_PHOTO_URL!}
            alt="User Avatar"
            width={48}
            height={48}
            className="rounded-full object-cover border-2 border-white/10 w-9 h-9 md:w-12 md:h-12"
          />
          {userProfile?.role && (
            <span
              className={cn(
                "absolute -bottom-1 -right-2 text-[10px] font-bold rounded-full px-1.5 py-0.5 border capitalize",
                userProfile.role === "admin"
                  ? "bg-yellow-400/20 text-yellow-400 border-yellow-400/30"
                  : "bg-cyan-400/20 text-cyan-400 border-cyan-400/30"
              )}
            >
              {userProfile.role}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }) {
  const { isPresentationMode } = usePresentationMode();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div
      className={cn(
        "h-screen w-full flex bg-[#030303] text-zinc-100 font-sans overflow-hidden transition-all duration-700 ease-in-out",
        isPresentationMode && "bg-black"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.06),transparent_50%)]"
      />

      {/* Desktop sidebar — hidden on mobile, shown md+ */}
      <div
        className={cn(
          "relative z-10 hidden md:block transition-all duration-500 ease-in-out",
          isPresentationMode ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        {!isPresentationMode && <AdminSidebar />}
      </div>

      {/* Mobile drawer — Sheet portal, z-50 */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-72 max-w-[80vw] p-0 bg-[#030303] border-r border-white/5"
        >
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <MobileNav onClose={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col h-full min-w-0">
        <Header onMenuOpen={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>

      <Toaster
        richColors
        position="top-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast:
              "border border-zinc-800/60 bg-zinc-900/90 backdrop-blur-xl text-zinc-100",
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

  useEffect(() => {
    if (user === null) {
      const redirect = encodeURIComponent(pathname || "/dashboard");
      router.push(`/login?redirect=${redirect}`);
    }
  }, [user, router, pathname]);

  if (user === undefined) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#030303]">
        <LoaderCircle className="h-10 w-10 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <PresentationModeProvider>
      <CmdKProvider>
        <CRMProvider>
          <CRMShellProvider>
            <Shell>{children}</Shell>
            <CmdKDialog />
          </CRMShellProvider>
        </CRMProvider>
      </CmdKProvider>
    </PresentationModeProvider>
  );
}
