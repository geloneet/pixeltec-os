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

export interface SessionActivity {
  id: string;
  description: string;
  startedAt: string;    // ISO
  completedAt?: string; // ISO — undefined means current open activity
}

export interface SessionNote {
  id: string;
  content: string;
  createdAt: string; // ISO
}

export interface SessionBlocker {
  id: string;
  type: BlockerType;
  description: string;
  createdAt: string; // ISO
  resolved: boolean;
}

export interface WorkSession {
  id: string;
  clientId: string;
  projectId: string;
  taskId: string;
  clientName: string;   // denormalized at creation
  projectName: string;  // denormalized at creation
  taskName: string;     // denormalized at creation
  startedAt: string;    // ISO
  endedAt?: string;     // ISO
  durationSeconds?: number;
  status: "active" | "completed";
  currentActivity?: string;      // text of the activity currently in progress
  activities: SessionActivity[];
  notes: SessionNote[];
  blockers: SessionBlocker[];
  deployStatus?: "yes" | "no" | "na";
  commitStatus?: boolean;
  createdBy: string; // user uid or email
}

export interface CoachResponse {
  question: string;
  answer: string;
  timestamp: string; // ISO
}
