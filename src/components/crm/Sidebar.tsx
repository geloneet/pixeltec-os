"use client";

import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCRM } from "./CRMContext";
import type { CRMClient } from "@/types/crm";

const AVATAR_COLORS = ["#0EA5E9", "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#06b6d4"];

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
  setView: (v: "today" | "clients" | "tools" | "server" | "search") => void;
  clients: CRMClient[];
  navigateToClient: (id: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
  streak: number;
  pomoRunning: boolean;
  pomoSeconds: number;
  pomoMode: "work" | "break";
}

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case "today":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "clients":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "tools":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      );
    case "server":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
      );
    case "search":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    default:
      return null;
  }
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

  const navItems: { key: string; label: string; hint?: string }[] = [
    { key: "today", label: "Hoy" },
    { key: "clients", label: "Clientes" },
    { key: "tools", label: "Herramientas" },
    { key: "server", label: "Servidor" },
    { key: "search", label: "Buscar", hint: "/" },
  ];

  return (
    <aside className="flex h-screen w-[240px] flex-col border-r border-zinc-800 bg-[#0F0F12]">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-[16px] font-bold tracking-tight text-white">
          PIXEL<span className="text-[#0EA5E9]">TEC</span>
        </h1>
        <p className="text-[10px] uppercase tracking-[2px] text-zinc-600">Command center</p>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-0.5">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setView(item.key as "today" | "clients" | "tools" | "server" | "search")}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150 ${
              view === item.key
                ? "border-l-2 border-[#0EA5E9] rounded-l-none bg-[#0EA5E9]/10 text-[#0EA5E9]"
                : "border-l-2 border-transparent text-zinc-400 hover:bg-[#18181B] hover:text-zinc-200"
            }`}
          >
            <NavIcon name={item.key} />
            <span>{item.label}</span>
            {item.hint && (
              <span className="ml-auto rounded bg-[#18181B] px-1.5 py-0.5 text-[10px] text-zinc-600">{item.hint}</span>
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
            className="text-[11px] text-[#0EA5E9] hover:text-[#38BDF8] transition-colors duration-150"
          >+ Nuevo</button>
        </div>
        <div className="space-y-0.5">
          {clients.map(c => {
            const totalTasks = c.projects.reduce((s, p) => s + p.tasks.length, 0);
            const completedTasks = c.projects.reduce((s, p) => s + p.tasks.filter(t => t.status === "completado").length, 0);
            const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <button
                key={c.id}
                onClick={() => navigateToClient(c.id)}
                className="flex w-full flex-col rounded-lg px-2 py-1.5 text-[13px] text-zinc-400 hover:bg-[#18181B] hover:text-zinc-200 transition-colors duration-150"
              >
                <div className="flex items-center gap-2 w-full">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: avatarColor(c.name) }}
                  >
                    {initials(c.name)}
                  </span>
                  <span className="truncate">{c.name}</span>
                </div>
                {totalTasks > 0 && (
                  <div className="ml-8 mt-1 w-[calc(100%-2rem)]">
                    <div className="h-[2px] w-full rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-[#0EA5E9]/60 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pomo / Streak */}
      <div className="border-t border-zinc-800 px-4 py-3">
        {pomoRunning ? (
          <div className={`text-center rounded-lg p-2 ${pomoMode === "work" ? "border border-[#0EA5E9]/30 animate-pulse" : ""}`}>
            <div className="font-mono text-2xl font-bold text-zinc-200">{formatTime(pomoSeconds)}</div>
            <div className={`text-[11px] ${pomoMode === "work" ? "text-[#0EA5E9]" : "text-green-400"}`}>
              {pomoMode === "work" ? "Enfocado" : "Descanso"}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-orange-500">
              <path d="M12 23c-3.866 0-7-3.134-7-7 0-3.037 1.968-5.778 4-7.5 0 2.5 2 4 3.5 4.5C12 11 13 8 12.5 5c3.5 2 6.5 5.5 6.5 11 0 3.866-3.134 7-7 7z" fill="currentColor" opacity="0.9"/>
              <path d="M12 23c-2.21 0-4-1.79-4-4 0-1.52.94-2.93 2-3.75 0 1.25 1 2 1.75 2.25C11.5 16.5 12 15 11.75 13.5 13.5 14.5 15 16.25 15 19c0 2.21-1.79 4-3 4z" fill="#FDE68A" opacity="0.7"/>
            </svg>
            <span className="text-sm text-zinc-400">Racha: <span className="font-bold text-zinc-200">{streak}</span></span>
          </div>
        )}
      </div>

      {/* User / Logout */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="truncate text-[11px] text-zinc-600 mb-2">{userEmail}</p>
        <button
          onClick={handleLogout}
          className="text-[12px] text-zinc-600 hover:text-red-400 transition-colors duration-150"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
