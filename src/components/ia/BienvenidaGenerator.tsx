"use client";

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";

interface FormState {
  clientName: string;
  serviceDescription: string;
  contactName: string;
  startDate: string;
}

export function BienvenidaGenerator() {
  const [form, setForm] = useState<FormState>({
    clientName: "",
    serviceDescription: "",
    contactName: "",
    startDate: "",
  });
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!form.clientName.trim() || !form.serviceDescription.trim()) return;
    setGenerating(true);
    setError("");
    setContent("");
    try {
      const res = await fetch("/api/documents/welcome-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.clientName.trim(),
          serviceDescription: form.serviceDescription.trim(),
          contactName: form.contactName.trim() || undefined,
          startDate: form.startDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setContent(data.content as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-card border border-border p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-foreground">Generar mensaje de bienvenida</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Nombre del cliente *</label>
          <input
            type="text"
            value={form.clientName}
            onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
            placeholder="Ej. Empresa ABC"
            className="w-full rounded-md bg-background border border-border text-sm text-foreground px-3 py-2 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Persona de contacto</label>
          <input
            type="text"
            value={form.contactName}
            onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))}
            placeholder="Ej. María García"
            className="w-full rounded-md bg-background border border-border text-sm text-foreground px-3 py-2 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs text-muted-foreground">Servicio contratado *</label>
          <input
            type="text"
            value={form.serviceDescription}
            onChange={e => setForm(p => ({ ...p, serviceDescription: e.target.value }))}
            placeholder="Ej. Diseño y desarrollo de sitio web corporativo + SEO"
            className="w-full rounded-md bg-background border border-border text-sm text-foreground px-3 py-2 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Fecha de inicio</label>
          <input
            type="date"
            value={form.startDate}
            onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
            className="w-full rounded-md bg-background border border-border text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !form.clientName.trim() || !form.serviceDescription.trim()}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-sm font-medium transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {generating ? "Generando..." : "Generar bienvenida"}
      </button>

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      {content && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Mensaje generado</p>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5 text-green-400" /> Copiado</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copiar</>
              )}
            </button>
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={8}
            className="w-full rounded-md bg-background border border-border text-sm text-foreground px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          />
        </div>
      )}
    </div>
  );
}
