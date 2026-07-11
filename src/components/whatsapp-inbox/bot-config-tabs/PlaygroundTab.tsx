"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import type { ConfigVersionMeta, SimulateResult } from "@/types/pixelbot-config";
import { extractErrorMessage } from "./_shared";

const MODES = ["BOT", "HUMAN", "PAUSED"] as const;

/** Playground de simulación — corre el pipeline completo (prompt, ejemplos,
 * memoria, escalamiento) sin enviar nada a WhatsApp ni persistir. Puede
 * previsualizar la versión ACTIVA o cualquier borrador/archivada antes de
 * publicar. */
export function PlaygroundTab() {
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]>("BOT");
  const [version, setVersion] = useState<string>("active");
  const [versions, setVersions] = useState<ConfigVersionMeta[]>([]);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/whatsapp-inbox/config/versions", { cache: "no-store" });
        const data = (await res.json()) as { versions?: ConfigVersionMeta[] };
        if (res.ok && data.versions) setVersions(data.versions);
      } catch {
        // silencioso — el selector de versión es opcional, no bloquea el playground
      }
    })();
  }, []);

  async function handleSimulate() {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/whatsapp-inbox/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          phone: phone.trim() || undefined,
          mode,
          version: version === "active" ? undefined : Number(version),
        }),
      });
      const data = (await res.json()) as SimulateResult & { error?: string };
      if (!res.ok) throw new Error(extractErrorMessage(data, res.status));
      setResult(data);
    } catch (err) {
      toast.error(`No se pudo simular: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-2">
      {/* Entrada */}
      <div className="space-y-3 rounded-xl border border-zinc-800/60 p-3">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Simular mensaje</p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Mensaje del cliente</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[90px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
            placeholder="¿Cuánto cuesta una página web?"
          />
        </div>
        <div className="flex gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Teléfono simulado (opcional)</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+525510000000"
              className="h-8 w-44 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Modo</label>
            <Select value={mode} onValueChange={(v) => setMode(v as (typeof MODES)[number])}>
              <SelectTrigger className="h-8 w-28 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
                {MODES.map((m) => (
                  <SelectItem key={m} value={m} className="text-sm text-zinc-300">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Versión a probar</label>
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger className="h-8 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
              <SelectItem value="active" className="text-sm text-zinc-300">Activa (publicada)</SelectItem>
              {versions.filter((v) => v.status !== "active").map((v) => (
                <SelectItem key={v.version} value={String(v.version)} className="text-sm text-zinc-300">
                  v{v.version} ({v.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => void handleSimulate()}
          disabled={!message.trim() || loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-2 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Spinner size="sm" /> : <Play className="h-3.5 w-3.5" />}
          Probar
        </button>
      </div>

      {/* Resultado */}
      <div className="space-y-3 rounded-xl border border-zinc-800/60 p-3">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Resultado</p>
        {!result ? (
          <p className="py-8 text-center text-xs text-zinc-600">Corre una simulación para ver el resultado aquí.</p>
        ) : (
          <div className="space-y-3 text-xs">
            {result.fuera_de_horario && (
              <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-300">
                Fuera de horario configurado.
              </p>
            )}
            {result.escalaria && (
              <p className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-300">
                Escalaría a humano — motivo: {result.razon_escalamiento ?? "desconocido"}
              </p>
            )}
            <div>
              <p className="mb-1 font-medium text-zinc-400">Respuesta</p>
              <p className="rounded-md bg-zinc-900/60 p-2 text-zinc-200">{result.respuesta ?? "—"}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-zinc-500">
              <span>Intención: <span className="text-zinc-300">{result.intent_detectado ?? "—"}</span></span>
              <span>Confianza: <span className="text-zinc-300">{result.confianza ?? "—"}</span></span>
            </div>
            {result.ejemplos_seleccionados.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-zinc-400">Ejemplos usados</p>
                <ul className="space-y-1">
                  {result.ejemplos_seleccionados.map((ej, i) => (
                    <li key={i} className="rounded-md bg-zinc-900/60 p-2 text-zinc-400">
                      <span className="text-zinc-300">{ej.customer_msg}</span> — score {ej.score}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Object.keys(result.memoria_usada).length > 0 && (
              <div>
                <p className="mb-1 font-medium text-zinc-400">Memoria usada</p>
                <ul className="space-y-0.5 text-zinc-400">
                  {Object.entries(result.memoria_usada).map(([k, v]) => (
                    <li key={k}><span className="font-mono text-zinc-500">{k}:</span> {v}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.reglas_aplicadas.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-zinc-400">Reglas aplicadas</p>
                <ul className="list-inside list-disc text-zinc-500">
                  {result.reglas_aplicadas.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            {result.prompt_preview && (
              <details className="rounded-md border border-zinc-800/60">
                <summary className="cursor-pointer px-2 py-1.5 text-zinc-400">Ver prompt completo</summary>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap px-2 pb-2 font-mono text-[10px] text-zinc-500">
                  {result.prompt_preview}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
