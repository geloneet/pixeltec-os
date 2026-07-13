// ── Propuesta Comercial ───────────────────────────────────────────────────────

export interface ProposalViewEvent {
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

export interface ProposalVersion {
  version: number;
  savedAt: string;
  title: string;
  scope: string;
  solution?: string;
  deliverables?: string;
  benefits?: string;
  budget?: string;
  timeline?: string;
}

export interface Proposal {
  id: string;
  uid: string;
  clientId: string;
  clientName: string;
  reference?: string;         // PT-YYYY-XXXXXX — generated on create
  title: string;
  scope: string;              // what the client needs (user fills this)
  solution?: string;          // AI generated
  deliverables?: string;      // AI generated (markdown list)
  benefits?: string;          // AI generated
  budget?: string;            // optional user input
  timeline?: string;          // optional user input
  // Conceptos de cobro opcionales, cargados desde la casilla "Agregar
  // precios" del form. Viajan al ContractWizard al convertir esta propuesta.
  billingItemDrafts?: BillingItemDraft[];
  status: "borrador" | "enviada" | "vista" | "aceptada" | "rechazada" | "vencida";
  contractId?: string;        // set when converted to contract
  publicToken?: string;       // random token for public URL /p/[token]
  viewCount?: number;
  viewEvents?: ProposalViewEvent[];  // capped at last 20
  currentVersion?: number;
  versions?: ProposalVersion[];      // version history (capped at 10)
  sentAt?: string;            // first time published
  viewedAt?: string;          // first client view
  acceptedAt?: string;
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

/** Cláusula generada a partir de la plantilla base fija (ver src/lib/contracts/base-template.ts). */
export interface ContractSection {
  key: string;
  title: string;
  body: string;
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
  templateVersion?: number;
  sections?: ContractSection[];
  // Conceptos de cobro en espera de la firma — los billingItems reales se
  // crean recién al firmar (ver signContract en documents/contracts.ts).
  billingItemDrafts?: BillingItemDraft[];
  // Proyecto CRM creado automáticamente al firmar. Ausente hasta la firma.
  projectId?: string;
  startDate?: string;
  endDate?: string;
  approvedAt?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Cobros (Contrato → Cobro → Pago → Próximo cobro) ─────────────────────────

export type BillingFrequency = "unico" | "mensual" | "trimestral" | "semestral" | "anual";
export type BillingStatus = "pendiente" | "pagado" | "vencido" | "parcial" | "cancelado";
export type PaymentMethod = "efectivo" | "transferencia" | "tarjeta";

export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  unico: "Pago único",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  vencido: "Vencido",
  parcial: "Parcial",
  cancelado: "Cancelado",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

export interface PaymentRecord {
  id: string;
  billingItemId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  periodKey: string;
  reference?: string;
  note?: string;
  createdBy?: string;
  createdAt: string;
}

export interface BillingItem {
  id: string;
  clientId: string;
  clientName?: string;
  contractId?: string;
  contractTitle?: string;
  proposalId?: string;
  projectId?: string;
  concept: string;
  amount: number;
  currency: string;
  frequency: BillingFrequency;
  status: BillingStatus;
  dueDate: string;
  nextDueDate?: string;
  notes?: string;
  paymentHistory: PaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

/** Línea de cobro capturada en el wizard de contrato, antes de persistirse. */
export interface BillingItemDraft {
  concept: string;
  amount: number;
  frequency: BillingFrequency;
  dueDate: string;
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
