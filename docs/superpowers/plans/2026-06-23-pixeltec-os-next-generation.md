# PixelTEC OS — Next Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar el CRM en un hub operativo centrado en el cliente, añadiendo Workspace de Trabajo con IA, módulos de Contratos/Propuestas/Discovery/Estrategia, Portal Cliente completo, Facturación con PDF, y un Centro IA de plantillas maestras.

**Architecture:** La capa operativa (`crm_data/{uid}`) se mantiene igual — clientes, proyectos, tareas, cobros. Los módulos documentales (contratos, facturas, propuestas, discovery, estrategia) viven en colecciones Firestore separadas indexadas por `uid` + `clientId`. El workspace del cliente (`/clientes/[id]`) se convierte en un shell con 8 tabs que agrega todas las capas. El Portal Cliente (`/portal/[token]`) es una superficie read-only para el cliente final.

**Tech Stack:** Next.js 14 App Router · TypeScript · Firebase/Firestore · Tailwind CSS (zinc/dark) · Lucide icons · `cn()` from `@/lib/utils` · `useUser` from `@/firebase` · `useCRM` from `@/components/crm/CRMContext`

## Global Constraints

- Firestore single-doc `crm_data/{uid}` NO recibe módulos documentales — solo refs ligeras (ids). Documentos pesados van a colecciones propias.
- `NavSection` type reemplaza `"nucleo" | "gestion"` por `"trabajo" | "finanzas" | "produccion"` — `"sistema"` permanece.
- Secciones del sidebar: **TRABAJO** · **FINANZAS** · **PRODUCCIÓN** · **SISTEMA** (colapsado por defecto).
- Centro IA: ruta interna `/ia-factory`, label en UI `"Centro IA"`.
- Badge pattern existente: `bg-*/15 text-* border border-*/20`.
- `tsc --noEmit` debe pasar limpio después de cada tarea.
- NO usar `git add .` — siempre agregar archivos específicos.
- NO tocar `.env.production`, `pixeltecpend.md` (untracked stray).
- Deploy: `docker compose build --no-cache` → `up -d --force-recreate app` → `nginx -s reload`. NEVER `restart`.
- Colores del tema: cyan para activo/primario, zinc para neutro, mismo patrón que el sidebar actual.
- Los tabs del Workspace Cliente usan el mismo patrón de tab existente en `ProjectView.tsx`.

---

> **Nota de ejecución:** Sprint 1 contiene código completo listo para SDD. Sprints 2–6 tienen definición de tareas con interfaces y rutas. Antes de iniciar cada sprint, detallar sus tareas con código completo (o ejecutarlos con un implementer que leerá los archivos producidos por sprints anteriores).

---

## Sprint 1 — Workspace Cliente + Nav Restructure

**Deliverable:** Navegación reorganizada en 4 secciones, rutas scaffold para /documentos e /ia-factory, tipos completos para todos los módulos futuros, y `/clientes/[id]` convertido en un workspace con 8 tabs (Resumen y Proyectos funcionales, el resto vacíos con empty state).

### Task 1: Nav restructure

**Files:**
- Modify: `src/components/nav/command-palette-items.ts` (full rewrite of sections/items)
- Modify: `src/components/nav/desktop-sidebar.tsx:15,67-77,209`

**Interfaces:**
- Produces: `NavSection = "trabajo" | "finanzas" | "produccion" | "sistema"` — consumido por desktop-sidebar, command-palette, y cualquier código que importe `NavSection`.

- [ ] **Step 1: Actualizar `command-palette-items.ts`**

Reemplaza el archivo completo con:

```typescript
import {
  Sun,
  ListTodo,
  FolderKanban,
  Users,
  Receipt,
  KeyRound,
  Server,
  FileText,
  Settings2,
  Bitcoin,
  FolderOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "trabajo" | "finanzas" | "produccion" | "sistema";

export interface PaletteNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  section: NavSection;
  /** Items with hidden:true are excluded from sidebar and ⌘K palette. */
  hidden?: boolean;
}

export const PALETTE_NAV_ITEMS: PaletteNavItem[] = [
  // ── Trabajo (operación diaria) ────────────────────────────────────────────
  {
    href: "/hoy",
    label: "Hoy",
    description: "Tareas del día, proyectos activos y actividad reciente de clientes",
    icon: Sun,
    section: "trabajo",
  },
  {
    href: "/tareas",
    label: "Tareas",
    description: "Lista maestra de tareas y vista semanal con planificador IA",
    icon: ListTodo,
    section: "trabajo",
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Workspace completo por cliente: proyectos, contratos, facturación y portal",
    icon: Users,
    section: "trabajo",
  },
  {
    href: "/proyectos",
    label: "Proyectos",
    description: "Vista maestra de todos los proyectos activos",
    icon: FolderKanban,
    section: "trabajo",
  },
  // ── Finanzas ──────────────────────────────────────────────────────────────
  {
    href: "/cobros",
    label: "Cobros",
    description: "Cobros recurrentes, alertas de vencimiento y seguimiento por cliente",
    icon: Receipt,
    section: "finanzas",
  },
  {
    href: "/documentos",
    label: "Documentos",
    description: "Contratos, facturas, propuestas, notas de pago y bienvenidas",
    icon: FolderOpen,
    section: "finanzas",
  },
  // ── Producción ────────────────────────────────────────────────────────────
  {
    href: "/ia-factory",
    label: "Centro IA",
    description: "Plantillas maestras para contratos, facturas, discovery y documentos",
    icon: Sparkles,
    section: "produccion",
    hidden: true, // activo en Sprint 3
  },
  {
    href: "/accesos",
    label: "Conocimiento",
    description: "Base de conocimiento, tips y documentación técnica",
    icon: KeyRound,
    section: "produccion",
  },
  {
    href: "/crypto-intel",
    label: "Crypto Intel",
    description: "Precios y alertas de mercado en tiempo real",
    icon: Bitcoin,
    section: "produccion",
    hidden: true,
  },
  // ── Sistema (colapsado por defecto) ──────────────────────────────────────
  {
    href: "/vps",
    label: "Infraestructura",
    description: "VPS status, deploys y monitoreo",
    icon: Server,
    section: "sistema",
  },
  {
    href: "/blog-admin",
    label: "Blog",
    description: "Gestión de posts, borradores y pipeline de contenido",
    icon: FileText,
    section: "sistema",
  },
  {
    href: "/perfil",
    label: "Configuración",
    description: "Perfil, notificaciones y preferencias del sistema",
    icon: Settings2,
    section: "sistema",
  },
];

export const NAV_SECTION_ORDER: NavSection[] = ["trabajo", "finanzas", "produccion", "sistema"];

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  trabajo: "Trabajo",
  finanzas: "Finanzas",
  produccion: "Producción",
  sistema: "Sistema",
};

export const MAX_RECENT_ROUTES = 5;
export const RECENT_ROUTES_KEY = "pixeltec_recent_routes";

export function getNavLabel(href: string): string {
  return PALETTE_NAV_ITEMS.find((item) => item.href === href)?.label ?? href;
}
```

- [ ] **Step 2: Actualizar `desktop-sidebar.tsx` — tipo `NavSection` y `groupBySection`**

En `desktop-sidebar.tsx`, el tipo `NavSection` se importa desde `command-palette-items.ts` — el cambio allí propaga automáticamente. Solo actualizar `groupBySection` (línea 67) y `collapsedSections` initial state (línea 209):

```typescript
// Reemplazar groupBySection (líneas 67-75):
function groupBySection(items: PaletteNavItem[]): Record<NavSection, PaletteNavItem[]> {
  const acc: Record<NavSection, PaletteNavItem[]> = {
    trabajo: [],
    finanzas: [],
    produccion: [],
    sistema: [],
  };
  for (const item of items) acc[item.section].push(item);
  return acc;
}
```

```typescript
// Reemplazar collapsedSections initial state (línea 209):
const [collapsedSections, setCollapsedSections] = useState<Set<NavSection>>(
  () => new Set<NavSection>(["sistema"]),
);
```

- [ ] **Step 3: Verificar tsc limpio**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: `TypeScript compilation completed` (sin errores).

- [ ] **Step 4: Commit**

```bash
git add src/components/nav/command-palette-items.ts src/components/nav/desktop-sidebar.tsx
git commit -m "feat(nav): restructure into Trabajo/Finanzas/Producción/Sistema sections"
```

---

### Task 2: New type definitions

**Files:**
- Modify: `src/types/crm.ts` (append new interfaces; no cambios a los tipos existentes)
- Create: `src/types/documents.ts` (types para colecciones Firestore separadas)

**Interfaces:**
- Produces: `Contract`, `Proposal`, `Invoice`, `InvoiceItem`, `DiscoverySession`, `DiscoveryQuestion`, `Strategy`, `StrategyObjective`, `StrategyKPI`, `RoadmapItem`, `IATemplate`, `IATemplateType`, `IA_TEMPLATE_TYPES` — consumidos por Sprints 2–6.
- Produces: `CRMClient` extendido con `portalToken?`, `portalEnabled?`, `strategyId?`.

- [ ] **Step 1: Agregar campos a `CRMClient` en `src/types/crm.ts`**

Después de `projects: CRMProject[];` (línea 65), agregar:

```typescript
  portalToken?: string;        // token único para /portal/[token]
  portalEnabled?: boolean;     // si el portal está activo para este cliente
  strategyId?: string;         // referencia al doc en strategies/ collection
```

- [ ] **Step 2: Crear `src/types/documents.ts`**

```typescript
// ── Propuesta Comercial ───────────────────────────────────────────────────────

export interface Proposal {
  id: string;
  uid: string;
  clientId: string;
  templateId?: string;
  status: "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida";
  title: string;
  scope: string;
  solution: string;
  deliverables: string[];
  timeline: string;
  price: number;
  currency: "MXN";
  benefits: string[];
  validUntil?: string;
  pdfUrl?: string;
  convertedToContractId?: string;
  notes?: string;
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
```

- [ ] **Step 3: Verificar tsc limpio**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: `TypeScript compilation completed`.

- [ ] **Step 4: Commit**

```bash
git add src/types/crm.ts src/types/documents.ts
git commit -m "feat(types): add document module types — Proposal, Contract, Invoice, Discovery, Strategy, IATemplate"
```

---

### Task 3: Route scaffolding

**Files:**
- Create: `src/app/(admin)/documentos/page.tsx`
- Create: `src/app/(admin)/ia-factory/page.tsx`

**Interfaces:**
- Produces: routes `/documentos` y `/ia-factory` resolvibles — Sprint 3 y 6 los llenarán.

- [ ] **Step 1: Crear `/documentos/page.tsx`**

```typescript
// src/app/(admin)/documentos/page.tsx
export default function DocumentosPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-zinc-300 mb-1">Documentos</p>
      <p className="text-xs text-zinc-600">
        Contratos, facturas, propuestas y bienvenidas — disponible en Sprint 6.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Crear `/ia-factory/page.tsx`**

```typescript
// src/app/(admin)/ia-factory/page.tsx
export default function IAFactoryPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-zinc-300 mb-1">Centro IA</p>
      <p className="text-xs text-zinc-600">
        Plantillas maestras para contratos, facturas y discovery — disponible en Sprint 3.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tsc y que las rutas resuelven**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/documentos/page.tsx src/app/\(admin\)/ia-factory/page.tsx
git commit -m "feat(routes): scaffold /documentos and /ia-factory pages"
```

---

### Task 4: Client Workspace shell

**Files:**
- Create: `src/components/crm/ClientWorkspace.tsx`
- Modify: `src/app/(admin)/clientes/[id]/page.tsx` (render `ClientWorkspace` en lugar de `ClientDetail`)

**Interfaces:**
- Consumes: `ClientDetail` desde `@/components/crm/ClientDetail` · `CRMClient` desde `@/types/crm` · `useCRM` desde `@/components/crm/CRMContext` · `useCRMShell` desde `@/components/crm/CRMShellProvider`
- Produces: `ClientWorkspace({ client, onBack, navigateToProject, setModal, deleteClient })` — componente que consume Sprints 2-6 cuando sus tabs se implementen.

- [ ] **Step 1: Crear `src/components/crm/ClientWorkspace.tsx`**

```typescript
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CRMClient } from "@/types/crm";
import { ClientDetail } from "./ClientDetail";
import type { ModalState } from "./CRMShellProvider";

export type WorkspaceTab =
  | "resumen"
  | "proyectos"
  | "propuesta"
  | "contratos"
  | "documentos"
  | "discovery"
  | "estrategia"
  | "portal";

const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "resumen",    label: "Resumen" },
  { id: "proyectos",  label: "Proyectos" },
  { id: "propuesta",  label: "Propuesta" },
  { id: "contratos",  label: "Contratos" },
  { id: "documentos", label: "Documentos" },
  { id: "discovery",  label: "Discovery" },
  { id: "estrategia", label: "Estrategia" },
  { id: "portal",     label: "Portal" },
];

interface Props {
  client: CRMClient;
  onBack: () => void;
  navigateToProject: (clientId: string, projectId: string) => void;
  setModal: (state: ModalState) => void;
  deleteClient: (id: string) => void;
}

function WorkspaceEmptyTab({ label, sprint }: { label: string; sprint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-zinc-400 mb-1">{label}</p>
      <p className="text-xs text-zinc-600">Disponible en {sprint}.</p>
    </div>
  );
}

export function ClientWorkspace({ client, onBack, navigateToProject, setModal, deleteClient }: Props) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("resumen");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-zinc-950/40">
        <div className="flex items-center gap-0.5 px-4 overflow-x-auto scrollbar-none">
          {WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                activeTab === tab.id
                  ? "text-cyan-300"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "resumen" && (
          <ClientDetail
            client={client}
            setView={(v) => { if (v === "clients") onBack(); }}
            navigateToProject={navigateToProject}
            setModal={setModal}
            deleteClient={deleteClient}
          />
        )}
        {activeTab === "proyectos" && (
          <ClientDetail
            client={client}
            setView={(v) => { if (v === "clients") onBack(); }}
            navigateToProject={navigateToProject}
            setModal={setModal}
            deleteClient={deleteClient}
          />
        )}
        {activeTab === "propuesta"  && <WorkspaceEmptyTab label="Propuesta Comercial" sprint="Sprint 3" />}
        {activeTab === "contratos"  && <WorkspaceEmptyTab label="Contratos" sprint="Sprint 3" />}
        {activeTab === "documentos" && <WorkspaceEmptyTab label="Documentos" sprint="Sprint 6" />}
        {activeTab === "discovery"  && <WorkspaceEmptyTab label="Discovery" sprint="Sprint 4" />}
        {activeTab === "estrategia" && <WorkspaceEmptyTab label="Estrategia" sprint="Sprint 4" />}
        {activeTab === "portal"     && <WorkspaceEmptyTab label="Portal Cliente" sprint="Sprint 5" />}
      </div>
    </div>
  );
}
```

> **Nota:** Resumen y Proyectos muestran `ClientDetail` completo de momento — Sprint 3–4 los diferenciarán. Este es el approach correcto para Sprint 1: nada se rompe, el workspace es navegable.

- [ ] **Step 2: Verificar que `ModalState` se exporta de `CRMShellProvider`**

```bash
grep -n "export.*ModalState\|export type ModalState" src/components/crm/CRMShellProvider.tsx
```

Si `ModalState` no está exportado, buscar el tipo y exportarlo, o usar `Parameters<typeof shell.setModal>[0]` como fallback en la Props interface.

- [ ] **Step 3: Actualizar `src/app/(admin)/clientes/[id]/page.tsx`**

Reemplazar el archivo completo:

```typescript
"use client";

import { useParams, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ClientWorkspace } from "@/components/crm/ClientWorkspace";

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const crm = useCRM();
  const shell = useCRMShell();

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const client = crm.clients.find((c) => c.id === params.id);

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-zinc-500 text-sm mb-4">Cliente no encontrado</p>
        <button
          onClick={() => router.push("/clientes")}
          className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
        >
          ← Ver clientes
        </button>
      </div>
    );
  }

  return (
    <ClientWorkspace
      client={client}
      onBack={() => router.push("/clientes")}
      navigateToProject={(_cid, pid) => router.push(`/proyectos/${pid}`)}
      setModal={shell.setModal}
      deleteClient={crm.deleteClient}
    />
  );
}
```

- [ ] **Step 4: Verificar tsc limpio**

```bash
npx tsc --noEmit 2>&1 | tail -5
```
Expected: `TypeScript compilation completed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/crm/ClientWorkspace.tsx src/app/\(admin\)/clientes/\[id\]/page.tsx
git commit -m "feat(workspace): add ClientWorkspace shell with 8-tab layout for /clientes/[id]"
```

---

## Sprint 2 — Workspace de Trabajo: Capa IA

**Deliverable:** El Workspace de Trabajo (`/proyectos/[id]/sesion`) gana un coach IA que hace preguntas durante la sesión, genera un resumen post-sesión automático, y escribe automáticamente una entrada en la Bitácora del proyecto al cerrar la sesión.

**Prerequisite:** Sprint 1 completado. Leer `src/types/session.ts`, `src/components/workspace/WorkspaceLayout.tsx`, `src/components/workspace/SmartSidebar.tsx`, y `src/components/workspace/EndSessionDialog.tsx` antes de implementar.

### Task 1: SessionAICoach — preguntas durante sesión

**Files:**
- Create: `src/components/workspace/SessionAICoach.tsx`
- Modify: `src/components/workspace/WorkspaceLayout.tsx` (integrar `SessionAICoach`)

**Behavior:**
- Muestra preguntas contextuales cada ~20 min o cuando el usuario completa una actividad
- Preguntas ejemplo: "¿Qué avance realizaste?", "¿Hubo algún problema?", "¿Necesitas documentar algo?", "¿Ya hiciste commit?", "¿Validaste en mobile?"
- Respuestas se acumulan en un array local `coachResponses: { question: string; answer: string; timestamp: string }[]`
- Al finalizar sesión, `coachResponses` se pasa a `EndSessionDialog` para incluirlo en el resumen

**Key interfaces:**
```typescript
// Produce: SessionAICoach({ session, onResponseAdded })
interface CoachResponse {
  question: string;
  answer: string;
  timestamp: string;
}

interface Props {
  session: WorkSession;
  onResponseAdded: (response: CoachResponse) => void;
}
```

### Task 2: Post-session AI summary generation

**Files:**
- Create: `src/app/api/workspace/session-summary/route.ts`
- Modify: `src/components/workspace/EndSessionDialog.tsx` (mostrar resumen generado)

**Behavior:**
- Endpoint `POST /api/workspace/session-summary` recibe: `{ session: WorkSession, coachResponses: CoachResponse[] }`
- Llama a Claude API con las actividades, notas, blockers, y respuestas del coach
- Devuelve: `{ summary: string, bitacoraEntry: string, nextStep: string }`
- `EndSessionDialog` muestra el resumen antes de confirmar cierre

**Key interfaces:**
```typescript
// POST /api/workspace/session-summary
// Body: { session: WorkSession, coachResponses: CoachResponse[] }
// Response: { summary: string; bitacoraEntry: string; nextStep: string }
```

### Task 3: Auto-write to Bitácora on session end

**Files:**
- Modify: `src/app/(admin)/proyectos/[id]/sesion/page.tsx` (llamar `addProjectLogEntry` al cerrar)
- Modify: `src/components/crm/CRMContext.tsx` — verificar que `addProjectLogEntry` ya existe (sí, de Sprint Bitácora)

**Behavior:**
- Al confirmar fin de sesión, si `bitacoraEntry` no está vacío → llama `crm.addProjectLogEntry(clientId, projectId, { category: "Desarrollo", content: bitacoraEntry, authorName })`
- El entry aparece automáticamente en la Bitácora del proyecto

### Task 4: Session history + hours dashboard

**Files:**
- Create: `src/components/workspace/SessionHistory.tsx`
- Modify: `src/components/crm/ProjectView.tsx` (agregar sección "Historial de sesiones" en tab Recursos o Resumen)

**Behavior:**
- Lista las últimas 10 sesiones del proyecto con: fecha, duración, tarea, actividades count
- Total de horas trabajadas en el proyecto (suma de `durationSeconds`)
- Usa `crm.getSessionsForProject(projectId)` que ya existe en CRMContext

---

## Sprint 3 — Contratos + Centro IA

**Deliverable:** Centro IA (`/ia-factory`) con CRUD de plantillas, módulo Contratos completo en el workspace cliente (lista, crear, editar, versionar, PDF), y módulo Propuesta con "convertir a contrato" con un click.

**Prerequisite:** Sprint 1 completado. Tipos `Contract`, `Proposal`, `IATemplate` ya definidos en `src/types/documents.ts`.

**Firestore collections needed (crear security rules y composite indexes antes de Task 2):**
```
contracts/{contractId}  → (uid ASC, clientId ASC), (uid ASC, status ASC)
proposals/{proposalId}  → (uid ASC, clientId ASC)
ia_templates/{templateId} → (uid ASC, type ASC)
```

**Security rule pattern (todas las colecciones nuevas):**
```
match /{collection}/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
}
```

### Task 1: Centro IA — CRUD de plantillas

**Files:**
- Create: `src/lib/documents/ia-templates.ts` (Firestore CRUD para `ia_templates/`)
- Create: `src/app/(admin)/ia-factory/page.tsx` (reemplaza scaffold de Sprint 1)
- Create: `src/components/ia/IATemplateCard.tsx`
- Create: `src/components/ia/IATemplateEditor.tsx`

**Nav change:** En `command-palette-items.ts`, cambiar `hidden: true` a `hidden: false` para el item de Centro IA.

**Key functions:**
```typescript
// src/lib/documents/ia-templates.ts
async function getTemplates(uid: string, type?: IATemplateType): Promise<IATemplate[]>
async function createTemplate(uid: string, data: Omit<IATemplate, "id" | "uid" | "createdAt" | "updatedAt">): Promise<string>
async function updateTemplate(id: string, data: Partial<IATemplate>): Promise<void>
async function deleteTemplate(id: string): Promise<void>
```

**Variable syntax en plantillas:** `{{nombre_empresa}}`, `{{contacto}}`, `{{monto}}`, `{{alcance}}`, `{{duracion}}`, `{{fecha_inicio}}`, `{{rfc}}`, `{{firmante_1}}`

### Task 2: Contracts Firestore service

**Files:**
- Create: `src/lib/documents/contracts.ts` (Firestore CRUD)

**Key functions:**
```typescript
async function getContracts(uid: string, clientId?: string): Promise<Contract[]>
async function getContract(id: string): Promise<Contract | null>
async function createContract(uid: string, clientId: string, data: Omit<Contract, "id" | "uid" | "clientId" | "version" | "createdAt" | "updatedAt">): Promise<string>
async function updateContract(id: string, data: Partial<Contract>): Promise<void>
async function createContractVersion(contractId: string): Promise<Contract> // crea nueva version con version+1
```

### Task 3: Contratos tab en Client Workspace

**Files:**
- Create: `src/components/crm/workspace-tabs/ContratosTab.tsx`
- Modify: `src/components/crm/ClientWorkspace.tsx` (reemplazar empty state del tab "contratos")

**UI:**
- Lista de contratos del cliente con: título, estado badge, versión, fecha
- Botón "Nuevo contrato" → modal con: selector de plantilla IA, campos de variables, preview
- Click en contrato → detalle con botones: Editar, Nueva versión, Descargar PDF, Cambiar estado

### Task 4: Contract PDF generation

**Files:**
- Create: `src/app/api/documents/contract-pdf/route.ts`

**Behavior:**
- `POST /api/documents/contract-pdf` recibe `{ contractId: string }`
- Lee el contrato de Firestore
- Hidrata variables en el `content`
- Genera PDF vía `@react-pdf/renderer` o puppeteer
- Sube a Firebase Storage: `documents/{uid}/contracts/{contractId}/v{version}.pdf`
- Actualiza `contract.pdfUrl` en Firestore
- Devuelve `{ pdfUrl: string }`

### Task 5: Propuesta Comercial + "Convertir a contrato"

**Files:**
- Create: `src/lib/documents/proposals.ts` (Firestore CRUD)
- Create: `src/components/crm/workspace-tabs/PropuestaTab.tsx`
- Modify: `src/components/crm/ClientWorkspace.tsx` (reemplazar empty state del tab "propuesta")

**Key behavior:**
- Formulario asistido por IA: usuario llena `scope`, IA sugiere `solution`, `deliverables`, `benefits`
- Botón "Generar con IA" llama a `POST /api/documents/proposal-generate`
- Botón "Convertir a contrato" → crea un `Contract` con `proposalId` = esta propuesta, pre-llenando variables desde los campos de la propuesta

---

## Sprint 4 — Discovery + Estrategia

**Deliverable:** Tab Discovery con generación de cuestionario por industria vía IA y UI de respuestas. Tab Estrategia con objetivos, KPIs, roadmap, prioridades y canales.

**Prerequisite:** Sprint 1 completado. Tipos `DiscoverySession`, `Strategy` en `src/types/documents.ts`.

**Firestore collections needed:**
```
discovery_sessions/{sessionId} → (uid ASC, clientId ASC)
strategies/{strategyId}        → (uid ASC, clientId ASC) — unique lógico por cliente
```

### Task 1: Discovery — generación IA por industria

**Files:**
- Create: `src/lib/documents/discovery.ts` (Firestore CRUD)
- Create: `src/app/api/documents/discovery-generate/route.ts`

**AI prompt pattern:**
```
POST /api/documents/discovery-generate
Body: { clientId: string; industry: string }
Response: { questions: DiscoveryQuestion[] }

System prompt:
"Eres un consultor digital. Genera un cuestionario de descubrimiento para un cliente de tipo {industry}.
Incluye 15-20 preguntas en categorías: Negocio, Presencia digital, Objetivos, Audiencia, Pain points, Presupuesto, Timeline.
Responde SOLO JSON: { questions: [{ id, text, category, type, options?, required }] }"
```

### Task 2: Discovery — UI de respuestas

**Files:**
- Create: `src/components/crm/workspace-tabs/DiscoveryTab.tsx`
- Modify: `src/components/crm/ClientWorkspace.tsx` (reemplazar empty state del tab "discovery")

**UI flow:**
- Si no hay sesión para este cliente: selector de industria + botón "Generar cuestionario"
- Loading state mientras IA genera
- Lista de preguntas con inputs por tipo (`text` → textarea, `select` → radio, `multiselect` → checkboxes)
- Botón "Guardar respuestas"
- Si ya hay sesión completada: modo lectura con respuestas, botón "Nueva sesión"

### Task 3: Estrategia — Objetivos + KPIs

**Files:**
- Create: `src/lib/documents/strategies.ts` (Firestore CRUD)
- Create: `src/components/crm/workspace-tabs/EstrategiaTab.tsx` (estructura base)
- Modify: `src/components/crm/ClientWorkspace.tsx` (reemplazar empty state del tab "estrategia")

**UI — sección Objetivos:**
- Lista de `StrategyObjective` con: título, estado badge, fecha límite opcional
- Inline add/edit (sin modal), botón "+" al final de la lista
- Botón "Mejorar con IA" → llama a `POST /api/documents/strategy-suggest-objectives` con datos del cliente

**UI — sección KPIs:**
- Tabla de `StrategyKPI`: nombre, valor objetivo, valor actual, unidad
- Inline editing

### Task 4: Estrategia — Roadmap + Prioridades + Canales

**Files:**
- Modify: `src/components/crm/workspace-tabs/EstrategiaTab.tsx` (añadir secciones)

**UI — Roadmap:**
- Lista de `RoadmapItem` agrupada por `sprint`
- Badges de prioridad: alta (red), media (amber), baja (zinc)
- Inline add/edit

**UI — Prioridades y Canales:**
- `priorities`: lista ordenable (drag-to-reorder en Sprint 5+, en Sprint 4 solo add/remove/reorder con botones ↑↓)
- `channels`: checkboxes para: Web, Social Media, Email, WhatsApp, Google Ads, SEO + campo custom
- `automations`: textarea multilínea (libre)

---

## Sprint 5 — Portal Cliente Full Workspace

**Deliverable:** `/portal/[token]` como workspace completo para el cliente final con Dashboard, Proyecto (tareas y roadmap), Documentos (contratos firmados y facturas), y Solicitudes (cliente crea solicitudes que llegan como tareas al sistema). Tab "Portal" en el workspace operativo para gestionar tokens y visibilidad.

**Prerequisite:** Sprints 1–4 completados. Tipos `CRMClient.portalToken`, `CRMClient.portalEnabled` ya en los tipos.

### Task 1: Portal token management

**Files:**
- Create: `src/lib/portal/token.ts`
- Create: `src/app/api/portal/token/route.ts` (GET genera/rota, DELETE revoca)

**Key functions:**
```typescript
// src/lib/portal/token.ts
async function generatePortalToken(uid: string, clientId: string): Promise<string>
// genera 32-char hex token, guarda en crm_data/{uid} → clients[].portalToken
async function revokePortalToken(uid: string, clientId: string): Promise<void>
async function resolveToken(token: string): Promise<{ uid: string; clientId: string } | null>
// escanea crm_data/{uid} buscando el token — necesita un índice o almacenamiento auxiliar
```

> **Nota de implementación:** Para evitar scanear todos los docs buscando un token, crear una colección auxiliar `portal_tokens/{token} = { uid, clientId, createdAt }`. Al generar token, escribir ahí. Al revocar, borrar.

### Task 2: Portal — Dashboard + Proyecto

**Files:**
- Modify: `src/app/portal/page.tsx` → mover a `src/app/portal/[token]/page.tsx`
- Create: `src/components/portal/PortalDashboard.tsx`
- Create: `src/components/portal/PortalProyecto.tsx`

**Portal Dashboard:**
- Estado general del proyecto activo (% completado)
- Próximo hito (primer RoadmapItem pendiente de Estrategia)
- Próximo cobro (RecurringCharge más próximo activo)

**Portal Proyecto:**
- Lista de tareas con estado (read-only)
- Roadmap del sprint actual
- Bitácora pública: solo `ProjectLogEntry` donde `public === true` (o todos si no hay campo `public` — retrocompatible)

### Task 3: Portal — Documentos + Solicitudes

**Files:**
- Create: `src/components/portal/PortalDocumentos.tsx`
- Create: `src/components/portal/PortalSolicitudes.tsx`
- Create: `src/lib/portal/requests.ts` (Firestore CRUD para solicitudes)
- Create: `src/types/portal.ts`

**Portal Documentos:**
- Lista de contratos firmados del cliente (de `contracts/` con `status === "firmado"`)
- Lista de facturas del cliente (de `invoices/`)
- Download buttons → URLs de Firebase Storage

**Portal Solicitudes:**
- Formulario: tipo (Nueva solicitud / Incidencia / Mejora), título, descripción
- Al enviar: crea una `CRMTask` en el proyecto principal del cliente con nombre prefijado `[PORTAL]`
- También guarda en `portal_requests/{requestId}` para tracking
- Lista de solicitudes previas del cliente con estado

**Types:**
```typescript
// src/types/portal.ts
export interface PortalRequest {
  id: string;
  uid: string;         // owner uid
  clientId: string;
  token: string;
  type: "solicitud" | "incidencia" | "mejora";
  title: string;
  description: string;
  status: "recibida" | "en_progreso" | "resuelta";
  linkedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Task 4: Tab Portal en Client Workspace

**Files:**
- Create: `src/components/crm/workspace-tabs/PortalTab.tsx`
- Modify: `src/components/crm/ClientWorkspace.tsx` (reemplazar empty state del tab "portal")

**UI:**
- Estado actual: activo/inactivo con toggle
- Link del portal (copiable): `https://[domain]/portal/[token]`
- Botón "Rotar token" (confirmar antes) + Botón "Revocar acceso"
- Preview de qué ve el cliente (secciones activadas)
- Actividad reciente: últimas 5 solicitudes del portal para este cliente

---

## Sprint 6 — Facturación + Documentos Hub

**Deliverable:** Tab Facturación en workspace cliente, PDF de facturas con branding PixelTEC, hub `/documentos` como vista maestra de todos los documentos, y generador de Documento de Bienvenida IA.

**Prerequisite:** Sprints 1–5 completados. Tipo `Invoice` ya en `src/types/documents.ts`. Centro IA (`/ia-factory`) ya tiene plantillas tipo `factura` y `bienvenida`.

### Task 1: Invoice Firestore service

**Files:**
- Create: `src/lib/documents/invoices.ts`

**Key functions:**
```typescript
async function getInvoices(uid: string, clientId?: string): Promise<Invoice[]>
async function createInvoice(uid: string, clientId: string, data: Omit<Invoice, "id"|"uid"|"clientId"|"number"|"createdAt"|"updatedAt">): Promise<string>
async function getNextInvoiceNumber(uid: string): Promise<string>
// lógica: query invoices por uid, contar, generar "FAC-2026-NNN"
async function updateInvoice(id: string, data: Partial<Invoice>): Promise<void>
```

**Firestore collection:**
```
invoices/{invoiceId} → indexes: (uid ASC, clientId ASC), (uid ASC, status ASC, dueDate ASC)
```

### Task 2: Facturación tab en Client Workspace

**Files:**
- Create: `src/components/crm/workspace-tabs/FacturacionTab.tsx`
- Modify: `src/components/crm/ClientWorkspace.tsx` (reemplazar empty state del tab "documentos" con FacturacionTab; ajustar tab labels: "documentos" → dividir en "facturación" si se prefiere o mantener en tab Documentos)

> **Decisión de diseño:** En Sprint 6, el tab "Documentos" en el workspace cliente muestra tanto facturas como contratos. El tab "Contratos" de Sprint 3 se mantiene especializado. El tab "Documentos" en Sprint 6 se convierte en un hub de todos los docs del cliente.

**UI:**
- Lista de facturas con: número, estado badge, total, fecha de vencimiento
- Estado badges: borrador (zinc), enviada (blue), vista (cyan), pagada (green), vencida (red), cancelada (zinc)
- Botón "Nueva factura" → modal/form con: items desglosados (add/remove rows), IVA auto-calculado, fecha límite
- Cada factura tiene acciones: Descargar PDF, Cambiar estado, Enviar por email

### Task 3: Invoice PDF con branding PixelTEC

**Files:**
- Create: `src/app/api/documents/invoice-pdf/route.ts`
- Create: `src/components/pdf/InvoicePDF.tsx` (React PDF component)

**Branding PixelTEC en PDF:**
- Header: logo PixelTEC (SVG o PNG en `/public/`), nombre empresa, RFC, dirección fiscal
- Colores: zinc oscuro para fondo de header, cyan para acentos
- Footer: "PixelTEC · pixeltec.mx" + número de factura
- Tabla de items: description, qty, unitPrice, subtotal
- Totales: subtotal, IVA (16%), total en MXN resaltado
- Nota de pago opcional

### Task 4: /documentos hub

**Files:**
- Modify: `src/app/(admin)/documentos/page.tsx` (reemplaza scaffold de Sprint 1)

**UI:**
- Tabs: Todos · Contratos · Facturas · Propuestas · Bienvenidas
- Cada tab lista los documentos del tipo con filtros de cliente y estado
- Acciones globales desde cada row: Descargar PDF, Ver cliente, Cambiar estado
- Summary cards: total contratos activos, total facturas pendientes de pago, total propuestas enviadas

### Task 5: Documento de Bienvenida IA

**Files:**
- Create: `src/app/api/documents/welcome-generate/route.ts`
- Create: `src/components/crm/workspace-tabs/BienvenidaGenerator.tsx`
- Modificar tab "Documentos" en workspace cliente para incluir el generador

**Flow:**
```
1. Botón "Generar bienvenida" en tab Documentos del workspace cliente
2. Modal de configuración: lista de servicios contratados (de projects), responsables, canales
3. POST /api/documents/welcome-generate: AI genera texto personalizado
4. Preview editable antes de generar PDF
5. POST /api/documents/invoice-pdf (o ruta similar): genera PDF
6. Guarda en Firebase Storage: documents/{uid}/welcome/{clientId}/bienvenida.pdf
7. Aparece en tab Documentos y en Portal Cliente sección Documentos
```

**AI prompt:**
```
System: "Eres un consultor de negocios digitales de PixelTEC. Escribe un documento de bienvenida profesional y cálido."
User: "Cliente: {nombre_empresa} ({contacto}). Servicios contratados: {servicios}. Objetivos principales: {objetivos}.
Responsable del proyecto: {responsable}. Canales de comunicación: {canales}.
Genera un documento con secciones: Bienvenida, Alcance, Próximos pasos, Responsables, Canales, Acceso al portal."
```

---

## Apéndice: Firestore Collections Summary

| Colección | Scope | Indices compuestos | Sprint |
|-----------|-------|-------------------|--------|
| `contracts/{id}` | `uid + clientId` | `(uid, clientId)`, `(uid, status)` | 3 |
| `proposals/{id}` | `uid + clientId` | `(uid, clientId)` | 3 |
| `ia_templates/{id}` | `uid` | `(uid, type)` | 3 |
| `discovery_sessions/{id}` | `uid + clientId` | `(uid, clientId)` | 4 |
| `strategies/{id}` | `uid + clientId` | `(uid, clientId)` | 4 |
| `portal_tokens/{token}` | `uid + clientId` | — (lookup by token) | 5 |
| `portal_requests/{id}` | `uid + clientId` | `(uid, clientId)` | 5 |
| `invoices/{id}` | `uid + clientId` | `(uid, clientId)`, `(uid, status, dueDate)` | 6 |

**Security rule template (aplicar a todas):**
```
match /{collection}/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
}
```

## Apéndice: Variables de contrato disponibles

```
{{nombre_empresa}}     → CRMClient.name
{{contacto}}           → CRMClient.contactName
{{email}}              → CRMClient.email
{{telefono}}           → CRMClient.phone
{{ubicacion}}          → CRMClient.location
{{rfc}}                → variable manual (no está en CRMClient — agregar en Sprint 3 si se necesita)
{{proyecto}}           → CRMProject.name
{{dominio}}            → CRMProject.domain
{{presupuesto}}        → CRMProject.budget formateado
{{tech}}               → CRMProject.tech
{{fecha_inicio}}       → contrato.createdAt formateado
{{duracion}}           → variable manual en modal
{{monto}}              → Proposal.price o variable manual
{{alcance}}            → Proposal.scope o variable manual
{{firmante_1}}         → Contract.signers[0].name
{{firmante_2}}         → Contract.signers[1]?.name
```
