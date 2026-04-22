"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Wrench,
  Server,
  Bitcoin,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { useAuth } from "@/firebase";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hoy", label: "Hoy", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/herramientas", label: "Herramientas", icon: Wrench },
  { href: "/vps", label: "DevOps", icon: Server },
  { href: "/crypto-intel", label: "Crypto", icon: Bitcoin },
];

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
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
    <aside className="h-full flex-shrink-0 flex items-center p-4 transition-opacity duration-300">
      <div className="h-full w-20 bg-black/20 backdrop-blur-xl border border-white/5 rounded-[2rem] flex flex-col items-center justify-between py-6">
        <Link href="/" aria-label="Inicio">
          <Image
            src={process.env.NEXT_PUBLIC_LOGO_URL!}
            alt="PixelTEC"
            width={40}
            height={40}
            className="hover:scale-110 transition-transform"
          />
        </Link>

        <nav className="flex flex-col items-center gap-4">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} aria-label={item.label}>
                <div
                  className={cn(
                    "relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group",
                    active
                      ? "bg-cyan-950/40 text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                      : "bg-transparent text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                  <span className="absolute left-full ml-4 px-3 py-1.5 text-xs font-semibold bg-zinc-800 border border-zinc-700 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none translate-x-[-10px] group-hover:translate-x-0">
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.75} />
          <span className="absolute left-full ml-4 px-3 py-1.5 text-xs font-semibold bg-zinc-800 border border-zinc-700 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none translate-x-[-10px] group-hover:translate-x-0">
            Cerrar sesión
          </span>
        </button>
      </div>
    </aside>
  );
}
