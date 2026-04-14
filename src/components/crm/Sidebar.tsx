"use client";

import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCRM } from "./CRMContext";
import type { CRMClient } from "@/types/crm";

const AVATAR_COLORS = ["#6d5acd", "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#06b6d4"];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

interface SidebarProps {
  view: string;
  setView: (v: "today" | "clients" | "tools" | "search") => void;
  clients: CRMClient[];
  navigateToClient: (id: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
  streak: number;
  pomoRunning: boolean;
  pomoSeconds: number;
  pomoMode: "work" | "break";
}

export function Sidebar({ view, setView, clients, navigateToClient, setModal, streak, pomoRunning, pomoSeconds, pomoMode }: SidebarProps) {
  const auth = useAuth();
  const router = useRouter();
  const { userEmail } = useCRM();

  const handleLogout = async () => {
    if (auth) {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth);
      router.push("/login");
    }
  };

  const toolsIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );

  const navItems: { key: string; label: string; icon: React.ReactNode; hint?: string }[] = [
    { key: "today", label: "Hoy", icon: "◆" },
    { key: "clients", label: "Clientes", icon: "◈" },
    { key: "tools", label: "Herramientas", icon: toolsIcon },
    { key: "search", label: "Buscar", icon: "⌕", hint: "/" },
  ];

  return (
    <aside className="flex h-screen w-[240px] flex-col border-r border-[#2a2a2f] bg-[#151518]">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-lg font-bold text-zinc-200">
          Pixel<span className="text-[#6d5acd]">TEC</span>
        </h1>
        <p className="text-[11px] text-zinc-500">Command center</p>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-0.5">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setView(item.key as "today" | "clients" | "tools" | "search")}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
              view === item.key ? "bg-[#6d5acd]/15 text-[#8b7ae8]" : "text-zinc-400 hover:bg-[#1c1c20] hover:text-zinc-200"
            }`}
          >
            <span className="text-xs">{item.icon}</span>
            <span>{item.label}</span>
            {item.hint && (
              <span className="ml-auto rounded bg-[#1c1c20] px-1.5 py-0.5 text-[10px] text-zinc-600">{item.hint}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Clients list */}
      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">Clientes</span>
          <button
            onClick={() => setModal({ type: "addClient" })}
            className="text-[11px] text-[#6d5acd] hover:text-[#8b7ae8]"
          >+ Nuevo</button>
        </div>
        <div className="space-y-0.5">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => navigateToClient(c.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-zinc-400 hover:bg-[#1c1c20] hover:text-zinc-200"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: avatarColor(c.name) }}
              >
                {initials(c.name)}
              </span>
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pomo / Streak */}
      <div className="border-t border-[#2a2a2f] px-4 py-3">
        {pomoRunning ? (
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-zinc-200">{formatTime(pomoSeconds)}</div>
            <div className={`text-[11px] ${pomoMode === "work" ? "text-[#6d5acd]" : "text-green-400"}`}>
              {pomoMode === "work" ? "Enfocado" : "Descanso"}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <span className="text-sm text-zinc-400">Racha: <span className="font-bold text-zinc-200">{streak}</span></span>
          </div>
        )}
      </div>

      {/* User / Logout */}
      <div className="border-t border-[#2a2a2f] px-4 py-3">
        <p className="truncate text-[11px] text-zinc-500 mb-2">{userEmail}</p>
        <button
          onClick={handleLogout}
          className="w-full rounded-lg bg-[#1c1c20] px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
