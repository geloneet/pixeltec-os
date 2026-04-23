"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { useAuth } from "@/firebase";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PALETTE_NAV_ITEMS } from "./command-palette-items";

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopSidebar() {
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
    <TooltipProvider delayDuration={100}>
      <aside className="h-full w-16 flex-shrink-0 flex flex-col bg-zinc-950/80 backdrop-blur-xl border-r border-white/5">
        {/* Nav items */}
        <nav className="flex-1 flex flex-col items-center gap-1 py-4 overflow-y-auto">
          {PALETTE_NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150",
                      active
                        ? "bg-sky-500/10 text-sky-400"
                        : "text-zinc-500 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-sky-400" />
                    )}
                    <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="bg-zinc-900 border border-white/10 text-zinc-100 text-sm px-3 py-1.5 rounded-lg shadow-xl"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Separator + Logout */}
        <div className="flex flex-col items-center pb-4 border-t border-white/5 pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={12}
              className="bg-zinc-900 border border-white/10 text-zinc-100 text-sm px-3 py-1.5 rounded-lg shadow-xl"
            >
              Cerrar sesión
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
