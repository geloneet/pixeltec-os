import { isModuleVisible, type ModuleId } from "./registry";

/**
 * Secciones del workspace de cliente (ADR-0035) y su visibilidad
 * (WO-2026-00088 §6). Misma filosofía que el registro de módulos: una única
 * fuente decide qué tabs, tarjetas, acciones y columnas de Clientes se
 * muestran; los datos de las secciones ocultas siguen existiendo y el
 * guardado de información general no los toca (test de regresión
 * `client-general-save.regression.test.tsx`).
 *
 * Reactivar una sección = `state: "active"` aquí.
 */
export type ClientWorkspaceSection = "resumen" | "cotizaciones" | "proyectos" | "comercial" | "documentos" | "finanzas" | "portal";

export interface ClientWorkspaceSectionDefinition {
  id: ClientWorkspaceSection;
  label: string;
  state: "active" | "hidden";
  /**
   * Módulo del registro del que depende (además de su propio estado): las
   * secciones que enlazan a un módulo oculto no se muestran aunque estén
   * activas aquí.
   */
  module?: ModuleId;
  note: string;
}

export const CLIENT_WORKSPACE_SECTIONS: readonly ClientWorkspaceSectionDefinition[] = [
  {
    id: "resumen",
    label: "Resumen",
    state: "active",
    note: "Información general, estado comercial, «requiere atención» (próxima acción), notas y actividad reciente (orden §6).",
  },
  {
    id: "cotizaciones",
    label: "Cotizaciones",
    state: "active",
    note: "Cotizaciones simples sin IA (WO-2026-00102, orden de Miguel 2026-08-26). Tabla propia `quotes`; NO reactiva «Comercial» ni la máquina de propuestas.",
  },
  {
    id: "proyectos",
    label: "Proyectos",
    state: "hidden",
    module: "proyectos",
    note: "Oculto (orden §6). Los proyectos y sus tareas siguen en el blob del cliente y en Postgres; no se envían campos vacíos.",
  },
  {
    id: "comercial",
    label: "Comercial",
    state: "hidden",
    note: "Oculto (orden §6: comercial, contratos, facturación). Propuestas, contratos y facturas viven en sus tablas; intactas.",
  },
  {
    id: "documentos",
    label: "Documentos",
    state: "hidden",
    // Sin `module`: el archivo documental de nivel superior (ruta /documentos)
    // se borró por completo en WO-2026-00132 (código y registro). Esta
    // pestaña del workspace de cliente es un concepto distinto —
    // `clients.documents` por cliente— y sigue oculta por su propio `state`.
    note: "Oculto (orden §6: documentos). `clients.documents` (jsonb) no forma parte del blob-sync: no puede sobrescribirse al guardar.",
  },
  {
    id: "finanzas",
    label: "Finanzas",
    state: "active",
    note: "7ma pestaña fija — extiende ADR-0035 (2026-08-27, orden de Miguel). Cobros y recurrentes de ESTE cliente, agrupados por frecuencia; sin la card global de «Próximos a vencer» (esa vive en /cobros).",
  },
  {
    id: "portal",
    label: "Portal",
    state: "hidden",
    note: "No nombrado por la orden ⇒ módulo no aprobado expresamente (§3.8). Decisión reversible del Worker; el acceso al portal ya activado sigue funcionando para el cliente final.",
  },
];

const BY_ID = new Map(CLIENT_WORKSPACE_SECTIONS.map((s) => [s.id, s]));

export function getClientSection(id: ClientWorkspaceSection): ClientWorkspaceSectionDefinition {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Sección de cliente no registrada: ${id}`);
  return s;
}

export function isClientSectionVisible(id: ClientWorkspaceSection): boolean {
  const s = getClientSection(id);
  if (s.state !== "active") return false;
  return s.module ? isModuleVisible(s.module) : true;
}

/** Tabs visibles del workspace, en orden. */
export function getVisibleClientSections(): ClientWorkspaceSectionDefinition[] {
  return CLIENT_WORKSPACE_SECTIONS.filter((s) => isClientSectionVisible(s.id));
}

/** Tarjetas del Resumen (deriveResumenCards) → sección a la que pertenecen. */
export const RESUMEN_CARD_SECTION: Record<string, ClientWorkspaceSection> = {
  proyectos: "proyectos",
  detenidas: "proyectos",
  cobro: "comercial",
  propuestas: "comercial",
  siguiente: "resumen",
  seguimiento: "resumen",
  contacto: "resumen",
};

export function isResumenCardVisible(cardKey: string): boolean {
  const section = RESUMEN_CARD_SECTION[cardKey] ?? "resumen";
  return isClientSectionVisible(section);
}

/** CTA de la guía de arranque (deriveOnboardingChecklist) → sección. */
export const ONBOARDING_CTA_SECTION: Record<"crear-propuesta" | "crear-proyecto" | "abrir-proyecto", ClientWorkspaceSection> = {
  "crear-propuesta": "comercial",
  "crear-proyecto": "proyectos",
  "abrir-proyecto": "proyectos",
};

/** Paso «Crear propuesta o proyecto» de la guía: visible si alguna de sus secciones lo está. */
export const ONBOARDING_WORK_STEP_LABEL = "Crear propuesta o proyecto";

export function isOnboardingWorkStepVisible(): boolean {
  return isClientSectionVisible("comercial") || isClientSectionVisible("proyectos");
}
