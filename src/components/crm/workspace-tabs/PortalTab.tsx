"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ExternalLink, RefreshCw, ShieldOff, KeyRound, AlertTriangle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContextCore";
import type { PortalRequest } from "@/types/portal";

// ── Type labels (portal por token) ──────────────────────────────────────────

const TYPE_LABELS = {
  solicitud: "Solicitud",
  incidencia: "Incidencia",
  mejora: "Mejora",
} as const;

const REQ_STATUS = {
  recibida:    { label: "Recibida",    classes: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
  en_progreso: { label: "En progreso", classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  resuelta:    { label: "Resuelta",    classes: "bg-green-500/15 text-green-300 border-green-500/20" },
} satisfies Record<PortalRequest["status"], { label: string; classes: string }>;

interface Props {
  clientId: string;
  clientName: string;
}

interface PasswordPortalStatus {
  email: string | null;
  source: "crm_blob" | "portal" | null;
  hasPassword: boolean;
  enabled: boolean;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Dos mecanismos de portal coexisten, cada uno atado a un `source` distinto
// de `clients` (ver src/lib/db/schema.ts y src/lib/portal/legacy-auth.ts):
//   - source='portal'   → portal legado por correo + contraseña (/login?modo=cliente)
//   - source='crm_blob' → portal legado por token (/portal/[token])
// El login por contraseña filtra estrictamente `source='portal'` — un
// cliente crm_blob NUNCA puede entrar ahí, así que esta pestaña muestra el
// control que corresponde a cada uno en vez de mezclar ambos.
export function PortalTab({ clientId, clientName: _clientName }: Props) {
  const crm = useCRM();
  const client = crm.clients.find((c) => c.id === clientId);

  const [status, setStatus] = useState<PasswordPortalStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/portal-legado/clients/${clientId}`);
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      // silencioso — la UI simplemente no muestra estado si falla la carga
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (loadingStatus) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
        <RefreshCw className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (status?.source === "portal") {
    return <PasswordPortalPanel clientId={clientId} status={status} onChange={loadStatus} />;
  }

  // Default: crm_blob (o source desconocido — mismo mecanismo que usaba
  // este tab antes de la migración a Postgres).
  return <TokenPortalPanel clientId={clientId} client={client} />;
}

// ════════════════════════════════════════════════════════════════════════
// Portal por CONTRASEÑA (source='portal')
// ════════════════════════════════════════════════════════════════════════

function PasswordPortalPanel({
  clientId,
  status,
  onChange,
}: {
  clientId: string;
  status: PasswordPortalStatus;
  onChange: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/login?modo=cliente` : null;

  async function handleSavePassword() {
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal-legado/clients/${clientId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      // Guardar/reiniciar la contraseña NUNCA reactiva el portal por sí
      // solo — si estaba desactivado (a propósito), sigue desactivado hasta
      // que un admin lo active explícitamente con el interruptor de abajo.
      setEditing(false);
      setNewPassword("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch(`/api/portal-legado/clients/${clientId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !status.enabled }),
      });
      if (!res.ok) throw new Error();
      onChange();
    } finally {
      setToggling(false);
    }
  }

  function handleCopy() {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const email = status.email;

  if (!email) {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-100">Portal de cliente</h2>
        <p className="text-sm text-zinc-400">
          Este cliente no tiene correo registrado. Agrega uno en su ficha para poder crear su portal — el acceso es
          por correo + contraseña.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-zinc-100">Portal de cliente</h2>
        {status.hasPassword && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            className="flex items-center gap-2 text-sm disabled:opacity-50"
            aria-label={status.enabled ? "Desactivar portal" : "Activar portal"}
          >
            <span
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                status.enabled ? "bg-cyan-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  status.enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </span>
            <span className={`text-xs font-medium ${status.enabled ? "text-cyan-300" : "text-zinc-500"}`}>
              {status.enabled ? "Activo" : "Inactivo"}
            </span>
          </button>
        )}
      </div>

      <p className="text-sm text-zinc-400">
        Este cliente entra en <code className="text-zinc-300">{portalUrl}</code> con su correo (
        <span className="text-zinc-300">{email}</span>) y la contraseña que fijes aquí.
      </p>

      {status.hasPassword && !status.enabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            El portal está desactivado. Reiniciar la contraseña NO lo reactiva — usa el interruptor de arriba si
            quieres darle acceso de nuevo.
          </p>
        </div>
      )}

      {/* Enlace de acceso */}
      <div className="rounded-lg border border-white/[0.08] bg-zinc-900/50 p-4 space-y-3">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Enlace de acceso</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 font-mono truncate border border-white/[0.06]">
            {portalUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700/50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" /> Copiado ✓
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contraseña */}
      <div className="rounded-lg border border-white/[0.08] bg-zinc-900/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Contraseña</p>
          <span className={`text-xs ${status.hasPassword ? "text-emerald-400" : "text-zinc-500"}`}>
            {status.hasPassword ? "Contraseña activa" : "Sin contraseña"}
          </span>
        </div>

        {editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña (mínimo 8 caracteres)"
                autoComplete="off"
                className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                type="button"
                onClick={() => setNewPassword(generatePassword())}
                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700/50 transition-colors"
              >
                Generar
              </button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSavePassword}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setNewPassword("");
                  setError(null);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-800/40 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-800/40 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/50 transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {status.hasPassword ? "Reiniciar contraseña" : "Fijar contraseña"}
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Portal por TOKEN (source='crm_blob') — restaurado tras el code review:
// era la única forma de rotar/revocar un link de portal ya emitido.
// ════════════════════════════════════════════════════════════════════════

function TokenPortalPanel({
  clientId,
  client,
}: {
  clientId: string;
  client: { portalToken?: string; portalEnabled?: boolean } | undefined;
}) {
  const crm = useCRM();

  const [rotating, setRotating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const portalUrl = typeof window !== "undefined" && client?.portalToken
    ? `${window.location.origin}/portal/${client.portalToken}`
    : null;

  useEffect(() => {
    if (!client?.portalToken) return;
    setLoadingRequests(true);
    fetch(`/api/portal/requests?token=${client.portalToken}`)
      .then((r) => r.json())
      .then((data) => setRequests((data.requests ?? []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoadingRequests(false));
  }, [client?.portalToken]);

  const handleToggle = () => {
    crm.updateClient(clientId, { portalEnabled: !client?.portalEnabled });
  };

  const handleGenerateToken = async () => {
    setRotating(true);
    try {
      const res = await fetch(`/api/portal/token?clientId=${clientId}`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      crm.updateClient(clientId, { portalToken: data.token, portalEnabled: true });
    } finally {
      setRotating(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch(`/api/portal/token?clientId=${clientId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      crm.updateClient(clientId, { portalToken: undefined, portalEnabled: false });
      setConfirmRevoke(false);
      setRequests([]);
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!client?.portalToken) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-100">Portal de cliente</h2>
        <p className="text-sm text-zinc-400">
          Genera un portal para que tu cliente vea el estado de su proyecto.
        </p>
        <button
          type="button"
          onClick={handleGenerateToken}
          disabled={rotating}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {rotating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Generando...
            </>
          ) : (
            "Generar portal"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-zinc-100">Portal de cliente</h2>
        <div className="flex items-center gap-3">
          {rotating && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Rotando...
            </span>
          )}
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-2 text-sm"
            aria-label={client.portalEnabled ? "Desactivar portal" : "Activar portal"}
          >
            <span
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                client.portalEnabled ? "bg-cyan-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  client.portalEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </span>
            <span className={`text-xs font-medium ${client.portalEnabled ? "text-cyan-300" : "text-zinc-500"}`}>
              {client.portalEnabled ? "Activo" : "Inactivo"}
            </span>
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-zinc-900/50 p-4 space-y-3">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Enlace del portal</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 font-mono truncate border border-white/[0.06]">
            {portalUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700/50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" />
                Copiado ✓
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </>
            )}
          </button>
          <a
            href={portalUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700/50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleGenerateToken}
            disabled={rotating}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-800/40 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${rotating ? "animate-spin" : ""}`} />
            Rotar token
          </button>
          <p className="text-xs text-zinc-600">El link anterior dejará de funcionar</p>
        </div>

        {!confirmRevoke && (
          <button
            type="button"
            onClick={() => setConfirmRevoke(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <ShieldOff className="h-4 w-4" />
            Revocar acceso
          </button>
        )}
      </div>

      {confirmRevoke && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
          <p className="text-sm text-red-400">¿Confirmar? El portal dejará de ser accesible.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRevoke}
              disabled={revoking}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {revoking ? "Revocando..." : "Sí, revocar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRevoke(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-800/40 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">Actividad reciente</h3>

        {loadingRequests ? (
          <div className="flex items-center gap-2 py-4 text-xs text-zinc-500">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Cargando...
          </div>
        ) : requests.length === 0 ? (
          <p className="py-4 text-xs text-zinc-600">Sin actividad reciente.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2.5"
              >
                <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">
                  {TYPE_LABELS[req.type]}
                </span>
                <span className="flex-1 truncate text-sm text-zinc-300">{req.title}</span>
                <span
                  className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${REQ_STATUS[req.status].classes}`}
                >
                  {REQ_STATUS[req.status].label}
                </span>
                <span className="flex-shrink-0 text-[10px] text-zinc-600">
                  {new Date(req.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
