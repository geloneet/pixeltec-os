"use client";

import { useState } from "react";
import { Search, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { MemoryEntry } from "@/types/pixelbot-config";
import { extractErrorMessage, formatUpdatedAt } from "./_shared";

const SOURCE_LABELS: Record<string, string> = { customer: "Dijo el cliente", inferred: "Inferido" };

/** Visor de solo lectura de conversation_memory por contacto — sin editor
 * (Fase A UI, alcance mínimo). */
export function MemoryTab() {
  const [phone, setPhone] = useState("");
  const [entries, setEntries] = useState<MemoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp-inbox/memory?phone=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { memory?: MemoryEntry[]; error?: string };
      if (!res.ok || !data.memory) throw new Error(extractErrorMessage(data, res.status));
      setEntries(data.memory);
    } catch (err) {
      toast.error(`No se pudo cargar la memoria: ${err instanceof Error ? err.message : String(err)}`);
      setEntries(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center gap-2 pb-3">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
          placeholder="+525510000000"
          className="h-8 max-w-xs border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={!phone.trim() || loading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Search className="h-3.5 w-3.5" />
          Buscar
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="md" className="text-zinc-500" />
        </div>
      ) : entries === null ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <BrainCircuit className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">Busca un teléfono para ver los hechos guardados.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-center text-sm text-zinc-500">
          Sin memoria guardada para este contacto.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-800/60">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800/60 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Clave</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Origen</th>
                <th className="px-3 py-2 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.key} className="border-b border-zinc-900 last:border-0">
                  <td className="px-3 py-2 font-mono text-zinc-400">{entry.key}</td>
                  <td className="px-3 py-2 text-zinc-200">{entry.value}</td>
                  <td className="px-3 py-2 text-zinc-500">{SOURCE_LABELS[entry.source] ?? entry.source}</td>
                  <td className="px-3 py-2 text-zinc-500">{formatUpdatedAt(entry.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
