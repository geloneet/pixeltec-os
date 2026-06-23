// ── Propuesta Comercial ───────────────────────────────────────────────────────

export interface Proposal {
  id: string;
  uid: string;
  clientId: string;
  title: string;
  scope: string;          // what the client needs (user fills this)
  solution?: string;      // AI generated
  deliverables?: string;  // AI generated (markdown list)
  benefits?: string;      // AI generated
  budget?: string;        // optional user input
  timeline?: string;      // optional user input
  status: "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida";
  contractId?: string;    // set when converted to contract
  createdAt: string;
  updatedAt: string;
}

// ── Contrato ──────────────────────────────────────────────────────────────────

export interface ContractSigner {
  name: string;
  email: string;
  role: string;
  signedAt?: string;
}

export interface Contract {
  id: string;
  uid: string;
  clientId: string;
  proposalId?: string;
  templateId?: string;
  version: number;
  status: "borrador" | "en_revision" | "firmado" | "vencido" | "cancelado";
  title: string;
  content: string;
  variables: Record<string, string>;
  signers: ContractSigner[];
  pdfUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Factura ───────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface Invoice {
  id: string;
  uid: string;
  clientId: string;
  projectId?: string;
  number: string;   // "FAC-2026-001"
  status: "borrador" | "enviada" | "vista" | "pagada" | "vencida" | "cancelada";
  items: InvoiceItem[];
  subtotal: number;
  ivaRate: number;  // 0.16 por defecto
  ivaAmount: number;
  total: number;
  currency: "MXN";
  issueDate: string;
  dueDate: string;
  pdfUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Discovery ─────────────────────────────────────────────────────────────────

export const DISCOVERY_INDUSTRIES = [
  "Dentista",
  "Restaurante",
  "Hotel",
  "Spa",
  "Constructora",
  "Ecommerce",
  "Otro",
] as const;

export type DiscoveryIndustry = typeof DISCOVERY_INDUSTRIES[number];

export interface DiscoveryQuestion {
  id: string;
  text: string;
  category: string;
  required: boolean;
  type: "text" | "select" | "multiselect";
  options?: string[];
}

export interface DiscoverySession {
  id: string;
  uid: string;
  clientId: string;
  industry: DiscoveryIndustry | string;
  status: "generando" | "en_progreso" | "completado";
  questions: DiscoveryQuestion[];
  answers: Record<string, string>;
  generatedAt: string;
  completedAt?: string;
}

// ── Estrategia ────────────────────────────────────────────────────────────────

export interface StrategyObjective {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  status: "pendiente" | "en_progreso" | "completado";
}

export interface StrategyKPI {
  id: string;
  name: string;
  target: string;
  current: string;
  unit: string;
}

export interface RoadmapItem {
  id: string;
  title: string;
  sprint: string;
  status: "pendiente" | "en_progreso" | "completado";
  priority: "alta" | "media" | "baja";
}

export interface Strategy {
  id: string;
  uid: string;
  clientId: string;
  objectives: StrategyObjective[];
  kpis: StrategyKPI[];
  roadmap: RoadmapItem[];
  priorities: string[];
  channels: string[];
  automations: string[];
  lastUpdated: string;
}

// ── Centro IA — Plantillas maestras ──────────────────────────────────────────

export const IA_TEMPLATE_TYPES = [
  "contrato",
  "factura",
  "discovery",
  "estrategia",
  "bienvenida",
  "propuesta",
] as const;

export type IATemplateType = typeof IA_TEMPLATE_TYPES[number];

export const IA_TEMPLATE_TYPE_LABELS: Record<IATemplateType, string> = {
  contrato:    "Contrato",
  factura:     "Factura",
  discovery:   "Discovery",
  estrategia:  "Estrategia",
  bienvenida:  "Bienvenida",
  propuesta:   "Propuesta",
};

export interface IATemplate {
  id: string;
  uid: string;
  type: IATemplateType;
  name: string;
  description: string;
  content: string;       // texto con {{variable}} placeholders
  variables: string[];   // lista de variables que usa esta plantilla
  industry?: string;     // filtro de industria (para templates discovery)
  isDefault: boolean;
  aiSystemPrompt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
