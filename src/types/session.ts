export type BlockerType =
  | "error_api"
  | "acceso_faltante"
  | "pendiente_cliente"
  | "dependencia_externa";

export const BLOCKER_LABELS: Record<BlockerType, string> = {
  error_api: "Error de API",
  acceso_faltante: "Acceso faltante",
  pendiente_cliente: "Pendiente de cliente",
  dependencia_externa: "Dependencia externa",
};

export type BlockerStatus = "active" | "waiting" | "resolved";
export type BlockerImpact = "low" | "medium" | "high";
export type BlockerSource =
  | "technical"
  | "client"
  | "infrastructure"
  | "third_party"
  | "internal";

export const BLOCKER_STATUS_LABELS: Record<BlockerStatus, string> = {
  active: "Activo",
  waiting: "Esperando",
  resolved: "Resuelto",
};

export const BLOCKER_IMPACT_LABELS: Record<BlockerImpact, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

export const BLOCKER_SOURCE_LABELS: Record<BlockerSource, string> = {
  technical: "Técnico",
  client: "Cliente",
  infrastructure: "Infraestructura",
  third_party: "Tercero",
  internal: "Interno",
};

export type ObservationType = "observacion" | "riesgo" | "bug" | "decision";

export const OBSERVATION_META: Record<
  ObservationType,
  { label: string; border: string; tint: string; iconColor: string }
> = {
  observacion: { label: "Observación", border: "border-zinc-600",   tint: "bg-blue-500/[0.04]",   iconColor: "text-blue-400/70"  },
  riesgo:      { label: "Riesgo",      border: "border-amber-500",  tint: "bg-amber-500/[0.05]",  iconColor: "text-amber-400/80" },
  bug:         { label: "Bug",         border: "border-red-500",    tint: "bg-red-500/[0.05]",    iconColor: "text-red-400/80"   },
  decision:    { label: "Decisión",    border: "border-green-500",  tint: "bg-green-500/[0.05]",  iconColor: "text-green-400/80" },
};

export interface SessionGoal {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface SessionActivity {
  id: string;
  description: string;
  startedAt: string;
  completedAt?: string;
  estimatedMinutes?: number;
}

export interface SessionNote {
  id: string;
  type: ObservationType;
  content: string;
  createdAt: string;
  markedForSummary?: boolean;
}

export interface SessionBlocker {
  id: string;
  type: BlockerType;
  description: string;
  status: BlockerStatus;
  impact: BlockerImpact;
  source: BlockerSource;
  createdAt: string;
  resolvedAt?: string;
}

export interface WorkSession {
  id: string;
  clientId: string;
  projectId: string;
  taskId: string;
  clientName: string;
  projectName: string;
  taskName: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  status: "active" | "completed";
  currentActivity?: string;
  activities: SessionActivity[];
  notes: SessionNote[];
  blockers: SessionBlocker[];
  sessionGoals?: SessionGoal[];
  deployStatus?: "yes" | "no" | "na";
  commitStatus?: boolean;
  createdBy: string;
}

export interface CoachResponse {
  question: string;
  answer: string;
  timestamp: string;
}
