"use client";

import { validateEnv } from "@/lib/env-check";
validateEnv();

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Bell, LoaderCircle, Monitor, Search } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useUser } from "@/firebase";
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
        active
          ? "bg-white text-black"
          : "text-white/60 hover:text-white"
      )}
    >
      {label}
    </Link>
  );
}

function Header() {
  const { userProfile } = useUserProfile();
  const { isPresentationMode, setPresentationMode } = usePresentationMode();
  const { setOpen: setCmdKOpen } = useCmdK();
  const pathname = usePathname();

  return (
    <header className="flex-shrink-0 w-full flex justify-between items-center py-4 px-8">
      <div
        className={cn(
          "flex items-center gap-3 transition-all duration-500",
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

      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 transition-opacity duration-500",
          isPresentationMode ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <div className="bg-white/5 rounded-full p-2 border border-white/10 backdrop-blur-md flex items-center gap-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <PillNavItem
                key={item.href}
                label={item.label}
                href={item.href}
                active={active}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
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

        <button
          type="button"
          onClick={() => setPresentationMode((prev) => !prev)}
          aria-label="Modo presentación"
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md cursor-pointer transition-all duration-300",
            isPresentationMode
              ? "bg-cyan-400/20 text-cyan-400 border-cyan-400/30"
              : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
          )}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <div
          className={cn(
            "flex items-center gap-4 transition-opacity duration-500",
            isPresentationMode ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <button className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <Bell className="w-5 h-5" />
            <div className="absolute top-2.5 right-3 h-2.5 w-2.5 rounded-full bg-lime-400 border-2 border-[#030303]" />
          </button>
          <div className="relative">
            <Image
              src={process.env.NEXT_PUBLIC_PROFILE_PHOTO_URL!}
              alt="User Avatar"
              width={48}
              height={48}
              className="rounded-full object-cover border-2 border-white/10"
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
      </div>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { isPresentationMode } = usePresentationMode();

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
      <div
        className={cn(
          "relative z-10 transition-all duration-500 ease-in-out",
          isPresentationMode ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        {!isPresentationMode && <AdminSidebar />}
      </div>
      <div className="relative z-10 flex-1 flex flex-col h-full min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
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
