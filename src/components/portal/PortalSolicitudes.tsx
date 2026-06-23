"use client";
import { useState } from "react";
import type { PortalRequest } from "@/types/portal";

interface Props {
  token: string;
  initialRequests: PortalRequest[];
}

const REQ_STATUS = {
  recibida:    { label: "Recibida",    classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  en_progreso: { label: "En progreso", classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  resuelta:    { label: "Resuelta",    classes: "bg-green-500/15 text-green-300 border-green-500/20" },
} satisfies Record<PortalRequest["status"], { label: string; classes: string }>;

const TYPE_OPTIONS: { value: PortalRequest["type"]; label: string }[] = [
  { value: "solicitud",  label: "Solicitud" },
  { value: "incidencia", label: "Incidencia" },
  { value: "mejora",     label: "Mejora" },
];

export default function PortalSolicitudes({ token, initialRequests }: Props) {
  const [requests, setRequests] = useState<PortalRequest[]>(initialRequests);
  const [type, setType] = useState<PortalRequest["type"]>("solicitud");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type, title, description }),
      });
      if (!res.ok) throw new Error("Error al enviar");
      const data = await res.json();
      setRequests(prev => [
        {
          id: data.requestId,
          uid: "",
          clientId: "",
          token,
          type,
          title: title.trim(),
          description: description.trim(),
          status: "recibida",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTitle("");
      setDescription("");
      setType("solicitud");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Nueva solicitud</h2>

      {/* Type selector */}
      <div className="flex gap-2">
        {TYPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setType(opt.value)}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
              type === opt.value
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Título</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Resumen breve de la solicitud"
          className="w-full rounded-md bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Descripción</label>
        <textarea
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe con detalle tu solicitud…"
          className="w-full rounded-md bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !title.trim()}
        className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {submitting ? "Enviando…" : "Enviar solicitud"}
      </button>

      {/* Success */}
      {submitted && (
        <p className="text-sm text-green-400">Solicitud enviada correctamente.</p>
      )}

      {/* Past requests */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Solicitudes anteriores</h2>
        {requests.length === 0 ? (
          <p className="text-zinc-400 text-sm">No has enviado ninguna solicitud todavía.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map(req => {
              const badge = REQ_STATUS[req.status];
              return (
                <li
                  key={req.id}
                  className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{req.title}</p>
                      {req.description && (
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{req.description}</p>
                      )}
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(req.createdAt).toLocaleDateString("es-MX", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
