"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { History, RotateCcw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ConfigVersionMeta, ConfigVersionStatus } from "@/types/pixelbot-config";
import { extractErrorMessage, formatUpdatedAt } from "./_shared";

const STATUS_LABEL: Record<ConfigVersionStatus, string> = {
  active: "Activa", draft: "Borrador", archived: "Archivada",
};
const STATUS_CLASS: Record<ConfigVersionStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  archived: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
};

interface Props {
  /** Se llama tras un rollback exitoso — BotConfigEditor debe refrescar la
   * config activa y el estado de borrador pendiente. */
  onRolledBack: () => void;
}

/** Historial de versiones (borrador/activa/archivada) con restaurar. Restaurar
 * activa de inmediato — no crea otro borrador. */
export function VersionsTab({ onRolledBack }: Props) {
  const [versions, setVersions] = useState<ConfigVersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp-inbox/config/versions", { cache: "no-store" });
      const data = (await res.json()) as { versions?: ConfigVersionMeta[]; error?: string };
      if (!res.ok || !data.versions) throw new Error(extractErrorMessage(data, res.status));
      setVersions(data.versions);
    } catch (err) {
      toast.error(`No se pudo cargar el historial: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleRollback(version: number) {
    setRestoring(version);
    try {
      const res = await fetch("/api/whatsapp-inbox/config/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data, res.status));
      toast.success(`Versión ${version} restaurada y activada`);
      await load();
      onRolledBack();
    } catch (err) {
      toast.error(`No se pudo restaurar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRestoring(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="md" className="text-zinc-500" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16 text-center">
        <History className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
        <p className="text-sm text-zinc-500">Sin historial todavía — guarda un borrador para empezar.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto rounded-xl border border-zinc-800/60">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-800/60 text-[11px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Versión</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Creado</th>
            <th className="px-3 py-2 font-medium">Publicado</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.version} className="border-b border-zinc-900 last:border-0">
              <td className="px-3 py-2 font-mono text-zinc-300">v{v.version}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[v.status]}`}>
                  {STATUS_LABEL[v.status]}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {formatUpdatedAt(v.created_at)}{v.created_by ? ` · ${v.created_by}` : ""}
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {v.published_at ? formatUpdatedAt(v.published_at) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {v.status !== "active" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        disabled={restoring === v.version}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restaurar
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-zinc-800 bg-zinc-950">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">
                          ¿Restaurar la versión {v.version}?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          Esto activa de inmediato el contenido de la versión {v.version} — el bot
                          responderá con esa configuración en el siguiente mensaje. Se crea como
                          una versión nueva (el historial nunca se reescribe).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800">
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void handleRollback(v.version)}
                          className="bg-cyan-600 text-white hover:bg-cyan-500"
                        >
                          Restaurar y activar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
