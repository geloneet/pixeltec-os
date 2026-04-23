"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, User, Settings } from "lucide-react";
import { signOut } from "firebase/auth";
import { useAuth, useUser, useUserProfile } from "@/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim()[0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "U";
}

export function UserMenu() {
  const router = useRouter();
  const auth = useAuth();
  const user = useUser();
  const { userProfile } = useUserProfile();

  const handleLogout = async () => {
    if (!auth) return;
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(auth);
    router.push("/login");
  };

  if (!user) return null;

  const initials = getInitials(user.displayName, user.email);
  const isAdmin = userProfile?.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menú de usuario"
          className="relative flex-shrink-0 rounded-full ring-offset-[#030303] transition-all hover:ring-2 hover:ring-sky-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
        >
          {/* Avatar */}
          <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user.displayName ?? "Avatar"}
                fill
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600">
                <span className="text-white text-xs font-semibold uppercase select-none">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Admin badge overlay */}
          {isAdmin && (
            <span className="absolute -bottom-0.5 -right-0.5 z-10 flex items-center justify-center rounded-full bg-amber-500 text-black text-[9px] font-bold px-1 py-0.5 leading-none border border-[#030303]">
              A
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 bg-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.6)] rounded-xl p-1"
      >
        {/* Header con foto grande */}
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
          <div className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user.displayName ?? "Avatar"}
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600">
                <span className="text-white text-sm font-semibold uppercase select-none">
                  {initials}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-zinc-100 font-semibold text-sm truncate">
              {user.displayName ?? "Usuario"}
            </span>
            <span className="text-zinc-500 text-xs truncate">{user.email}</span>
            {isAdmin && (
              <span className="mt-0.5 self-start text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none">
                admin
              </span>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/5" />

        <DropdownMenuItem
          className="flex items-center gap-2 text-zinc-300 hover:text-white focus:text-white focus:bg-white/5 rounded-lg cursor-pointer px-2 py-2 text-sm"
          onClick={() => router.push("/perfil")}
        >
          <User className="h-4 w-4 flex-shrink-0" />
          Mi perfil
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center gap-2 text-zinc-300 hover:text-white focus:text-white focus:bg-white/5 rounded-lg cursor-pointer px-2 py-2 text-sm"
          onClick={() => router.push("/settings")}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          Configuración
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/5" />

        <DropdownMenuItem
          className="flex items-center gap-2 text-rose-400 hover:text-rose-300 focus:text-rose-300 focus:bg-rose-500/10 rounded-lg cursor-pointer px-2 py-2 text-sm"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
