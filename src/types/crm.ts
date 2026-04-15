export interface CRMKey {
  id: string;
  label: string;
  value: string;
}

export interface CRMTask {
  id: string;
  name: string;
  desc: string;
  status: "pendiente" | "proceso" | "completado" | "detenido";
  prio: "urgent_important" | "important" | "urgent" | "low";
  createdAt: string;
  pomoSessions: number;
}

export interface CRMProject {
  id: string;
  name: string;
  domain: string;
  budget: string;
  annual: string;
  tech: string;
  keys: CRMKey[];
  guides: string;
  accounts: string;
  readme: string;
  prompt: string;
  quickNotes: string;
  tasks: CRMTask[];
  createdAt: string;
}

export interface CRMClient {
  id: string;
  name: string;
  phone: string;
  location: string;
  notes: string;
  projects: CRMProject[];
  createdAt: string;
}

export interface KnowledgeTip {
  id: string;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Tool {
  id: string;
  name: string;
  icon: string;
  color: string;
  tips: KnowledgeTip[];
  createdAt: string;
}

export const PRIORITIES: Record<CRMTask["prio"], { label: string; color: string; order: number }> = {
  urgent_important: { label: "Urgente + Importante", color: "#ef4444", order: 1 },
  important: { label: "Importante", color: "#f59e0b", order: 2 },
  urgent: { label: "Urgente", color: "#3b82f6", order: 3 },
  low: { label: "Puede esperar", color: "#71717a", order: 4 },
};

export interface VPSProject {
  id: string;
  name: string;
  path: string;
  type: "docker-compose" | "docker" | "pm2" | "manual";
  domain?: string;
  deployCommand: string;
  statusCommand: string;
  description: string;
  createdAt: string;
}

export const STATUS_CONFIG: Record<CRMTask["status"], { label: string; bg: string; text: string }> = {
  pendiente: { label: "Pendiente", bg: "bg-purple-500/12", text: "text-purple-400" },
  proceso: { label: "En proceso", bg: "bg-amber-500/12", text: "text-amber-400" },
  completado: { label: "Completado", bg: "bg-green-500/12", text: "text-green-400" },
  detenido: { label: "Detenido", bg: "bg-red-500/12", text: "text-red-400" },
};
