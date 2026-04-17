"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Server,
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
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/vps", label: "DevOps", icon: Server },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();

  const handleLogout = async () => {
    if (auth) {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth);
      router.push("/login");
    }
  };

  return (
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center justify-between border-r border-zinc-800/60 bg-zinc-950/80 py-6 backdrop-blur-xl">
      <Link
        href="/"
        className="transition-transform hover:scale-110"
        aria-label="Inicio"
      >
        <Image
          src={process.env.NEXT_PUBLIC_LOGO_URL!}
          alt="PixelTEC"
          width={36}
          height={36}
        />
      </Link>

      <nav className="flex flex-col items-center gap-2">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative"
              aria-label={item.label}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300",
                  active
                    ? "bg-gradient-to-br from-zinc-800 to-zinc-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-zinc-700/80"
                    : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <span
                className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-100 opacity-0 ring-1 ring-zinc-800 transition-opacity duration-200 group-hover:opacity-100"
                role="tooltip"
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-3">
        <div className="h-px w-10 bg-zinc-800" />
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
