import type { ReactNode } from "react";

export default function PortalTokenLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center gap-3">
        <div className="text-cyan-400 font-bold text-lg tracking-tight">PixelTEC</div>
        <span className="text-zinc-600">|</span>
        <span className="text-zinc-400 text-sm">Portal de Cliente</span>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
