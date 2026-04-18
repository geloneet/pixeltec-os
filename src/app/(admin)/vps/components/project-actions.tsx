"use client";

import { useState, useTransition } from "react";
import {
  Rocket,
  RotateCw,
  Pause,
  Play,
  ScrollText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "./action-confirm-dialog";
import type {
  VpsAction,
  VpsActionResponse,
  VpsProject,
  ProjectStatus,
} from "@/lib/vps-types";

interface ActionConfig {
  endpoint: string;
  loadingLabel: (name: string) => string;
  successLabel: string;
  errorLabel: string;
  needsConfirm: boolean;
  confirmVariant: "default" | "danger" | "warning";
  confirmTitle: (name: string) => string;
  confirmDescription: (name: string) => string;
  confirmCta: string;
}

const ACTION_CONFIG: Record<VpsAction, ActionConfig> = {
  deploy: {
    endpoint: "/api/vps/deploy",
    loadingLabel: (n) => `Desplegando ${n}...`,
    successLabel: "Deploy completado",
    errorLabel: "Deploy falló",
    needsConfirm: true,
    confirmVariant: "default",
    confirmTitle: (n) => `Desplegar ${n}`,
    confirmDescription: (n) =>
      `Se ejecutará git pull + rebuild del contenedor de ${n}. Puede tardar 30–60 s y habrá ~5 s de downtime mientras Nginx recarga.`,
    confirmCta: "Deploy",
  },
  restart: {
    endpoint: "/api/vps/restart",
    loadingLabel: (n) => `Reiniciando ${n}...`,
    successLabel: "Reinicio completado",
    errorLabel: "Reinicio falló",
    needsConfirm: true,
    confirmVariant: "warning",
    confirmTitle: (n) => `Reiniciar ${n}`,
    confirmDescription: (n) =>
      `Se reinicia el proceso/contenedor de ${n} sin reconstruir. Downtime estimado: ~2–5 s.`,
    confirmCta: "Reiniciar",
  },
  pause: {
    endpoint: "/api/vps/pause",
    loadingLabel: (n) => `Pausando ${n}...`,
    successLabel: "Proyecto pausado",
    errorLabel: "Pausa falló",
    needsConfirm: true,
    confirmVariant: "danger",
    confirmTitle: (n) => `Pausar ${n}`,
    confirmDescription: (n) =>
      `${n} dejará de estar disponible hasta que lo reanudes. Confirmas que esto es intencional.`,
    confirmCta: "Pausar",
  },
  resume: {
    endpoint: "/api/vps/resume",
    loadingLabel: (n) => `Reanudando ${n}...`,
    successLabel: "Proyecto reanudado",
    errorLabel: "Reanudar falló",
    needsConfirm: false,
    confirmVariant: "default",
    confirmTitle: (n) => `Reanudar ${n}`,
    confirmDescription: () => "",
    confirmCta: "Reanudar",
  },
};

async function callAction(
  endpoint: string,
  projectId: string
): Promise<VpsActionResponse> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const data = (await res
    .json()
    .catch(() => ({ error: res.statusText }))) as VpsActionResponse;
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  pending,
  disabled,
  variant = "ghost",
}: {
  icon: typeof Rocket;
  label: string;
  onClick: () => void;
  pending: boolean;
  disabled?: boolean;
  variant?: "ghost" | "outline";
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      onClick={onClick}
      disabled={disabled || pending}
      className="h-8 gap-1.5 border-zinc-800/70 bg-zinc-900/40 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}

export function ProjectActions({
  project,
  status,
  onMutated,
  onOpenLogs,
}: {
  project: VpsProject;
  status: ProjectStatus;
  onMutated: () => void;
  onOpenLogs: () => void;
}) {
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<VpsAction | null>(null);
  const [confirmFor, setConfirmFor] = useState<VpsAction | null>(null);

  const run = (action: VpsAction) => {
    const config = ACTION_CONFIG[action];
    setPending(action);
    toast.promise(callAction(config.endpoint, project.id), {
      loading: config.loadingLabel(project.name),
      success: (data) => ({
        message: config.successLabel,
        description: data.message || data.output?.slice(0, 140) || undefined,
      }),
      error: (err: unknown) => ({
        message: config.errorLabel,
        description:
          err instanceof Error ? err.message : "Error desconocido en la API",
      }),
      finally: () => {
        setPending(null);
        startTransition(() => onMutated());
      },
    });
  };

  const handleClick = (action: VpsAction) => {
    const config = ACTION_CONFIG[action];
    if (config.needsConfirm) {
      setConfirmFor(action);
    } else {
      run(action);
    }
  };

  const confirmConfig = confirmFor ? ACTION_CONFIG[confirmFor] : null;
  const isPaused = status === "paused";
  const anyPending = pending !== null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <ActionButton
          icon={Rocket}
          label="Deploy"
          onClick={() => handleClick("deploy")}
          pending={pending === "deploy"}
          disabled={anyPending || isPaused}
        />
        <ActionButton
          icon={RotateCw}
          label="Restart"
          onClick={() => handleClick("restart")}
          pending={pending === "restart"}
          disabled={anyPending || isPaused}
        />
        {isPaused ? (
          <ActionButton
            icon={Play}
            label="Resume"
            onClick={() => handleClick("resume")}
            pending={pending === "resume"}
            disabled={anyPending}
          />
        ) : (
          <ActionButton
            icon={Pause}
            label="Pause"
            onClick={() => handleClick("pause")}
            pending={pending === "pause"}
            disabled={anyPending}
          />
        )}
        <ActionButton
          icon={ScrollText}
          label="Logs"
          onClick={onOpenLogs}
          pending={false}
          disabled={false}
        />
      </div>

      {confirmConfig && confirmFor && (
        <ActionConfirmDialog
          open={confirmFor !== null}
          onOpenChange={(o) => !o && setConfirmFor(null)}
          title={confirmConfig.confirmTitle(project.name)}
          description={confirmConfig.confirmDescription(project.name)}
          confirmLabel={confirmConfig.confirmCta}
          variant={confirmConfig.confirmVariant}
          onConfirm={() => {
            const action = confirmFor;
            setConfirmFor(null);
            run(action);
          }}
        />
      )}
    </>
  );
}
