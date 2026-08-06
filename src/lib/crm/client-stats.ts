import type { CRMClient, CRMProject, ClientCrmStatus } from "@/types/crm";

export interface ClientStats {
  projectsCount: number;
  totalTasks: number;
  openTasks: number;
  stopped: number;
  completed: number;
  pct: number;
}

export interface ClientBadge {
  label: string;
  colorClass: string;
}

export function deriveClientStats(client: CRMClient): ClientStats {
  let totalTasks = 0;
  let openTasks = 0;
  let stopped = 0;
  let completed = 0;

  for (const project of client.projects) {
    for (const task of project.tasks) {
      totalTasks++;
      if (task.status === "pendiente" || task.status === "en_progreso" || task.status === "en_revision") openTasks++;
      if (task.status === "pausado" || task.status === "bloqueado") stopped++;
      if (task.status === "completado") completed++;
    }
  }

  return {
    projectsCount: client.projects.length,
    totalTasks,
    openTasks,
    stopped,
    completed,
    pct: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
  };
}

/**
 * Badge del cliente (ADR-0034): refleja el ESTADO comercial (`crmStatus`),
 * no la existencia de tareas — "Sin tareas" podía significar tanto "todo al
 * día" como "cliente abandonado". Única excepción: tareas detenidas siempre
 * ganan (señal operativa de bloqueo, en rojo). Unifica las dos taxonomías
 * divergentes previas (`clientBadge` de lista y `clientDetailBadge` local).
 */
export function clientStatusBadge(status: ClientCrmStatus | undefined, stats: ClientStats): ClientBadge {
  if (stats.stopped > 0) {
    return { label: "Atención requerida", colorClass: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20" };
  }
  switch (status ?? "prospecto") {
    case "activo":
      return { label: "Cliente activo", colorClass: "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20" };
    case "pausado":
      return { label: "Pausado", colorClass: "bg-muted text-muted-foreground border border-border" };
    case "cerrado":
      return { label: "Cerrado", colorClass: "bg-muted text-muted-foreground border border-border" };
    case "prospecto":
    default:
      return { label: "Prospecto", colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20" };
  }
}

/** @deprecated ADR-0034 — usar `clientStatusBadge`. Se conserva mientras la
 *  lista de clientes migra (su filtro `sin-tareas` depende de estas labels). */
export function clientBadge(stats: ClientStats): ClientBadge {
  if (stats.stopped > 0) {
    return { label: "Atención", colorClass: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20" };
  }
  if (stats.totalTasks === 0) {
    return { label: "Sin tareas", colorClass: "bg-muted text-muted-foreground border border-border" };
  }
  if (stats.openTasks > 0) {
    return { label: "En progreso", colorClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20" };
  }
  return { label: "Al día", colorClass: "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20" };
}

// ── Teléfono accionable (ADR-0034) ───────────────────────────────────────────

export interface ActionablePhone {
  display: string;
  telHref: string;
  waHref: string;
}

/**
 * Normaliza el teléfono del cliente a formato accionable: `tel:` y WhatsApp.
 * Números de 10 dígitos se asumen mexicanos (+52). Devuelve null si no hay
 * suficientes dígitos para marcar.
 */
export function formatPhone(raw: string | undefined | null): ActionablePhone | null {
  if (!raw) return null;
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;

  const e164 = hasPlus ? `+${digits}` : digits.length === 10 ? `+52${digits}` : `+${digits}`;
  const grouped = e164.slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");

  return {
    display: `${e164.slice(0, e164.length - 10)} ${grouped}`.trim(),
    telHref: `tel:${e164}`,
    waHref: `https://wa.me/${e164.slice(1)}`,
  };
}

// ── Tarjetas del Resumen (ADR-0034) ──────────────────────────────────────────

export interface ResumenCard {
  key: string;
  label: string;
  value: string;
  /** Nota corta bajo el valor (p. ej. fecha del seguimiento). */
  hint?: string;
  tone: "default" | "accent" | "warning" | "danger";
}

export interface ResumenCardsInput {
  /** Propuestas del cliente en estado abierto (borrador|enviada|vista). */
  openProposalsCount: number;
  /** Cobros pendientes/vencidos del cliente (billing items). */
  pendingBillingCount: number;
  /** Fecha ISO del último evento del historial (o null si no hay). */
  lastActivityAt: string | null;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/**
 * Tarjetas dinámicas del Resumen: sustituyen los 4 contadores estáticos
 * (Proyectos/Abiertas/Completadas/Detenidas, casi siempre en cero) por
 * señales accionables según el estado del cliente. "Detenidas" solo aparece
 * por excepción, en rojo.
 */
export function deriveResumenCards(client: CRMClient, stats: ClientStats, input: ResumenCardsInput): ResumenCard[] {
  const cards: ResumenCard[] = [];
  const status = client.crmStatus ?? "prospecto";
  const next = client.nextAction ?? null;
  const nextOverdue = Boolean(next?.dueAt && next.dueAt < new Date().toISOString());

  if (status === "activo") {
    cards.push({ key: "proyectos", label: "Proyectos activos", value: String(stats.projectsCount), tone: "accent" });
    cards.push({
      key: "siguiente",
      label: "Siguiente acción",
      value: next ? next.label : "Sin próxima acción",
      hint: next?.dueAt ? formatShortDate(next.dueAt) : undefined,
      tone: next ? (nextOverdue ? "danger" : "default") : "warning",
    });
    cards.push({
      key: "cobro",
      label: "Cobro o propuesta pendiente",
      value:
        input.pendingBillingCount > 0
          ? `${input.pendingBillingCount} cobro${input.pendingBillingCount === 1 ? "" : "s"}`
          : input.openProposalsCount > 0
            ? `${input.openProposalsCount} propuesta${input.openProposalsCount === 1 ? "" : "s"}`
            : "Al corriente",
      tone: input.pendingBillingCount > 0 ? "warning" : "default",
    });
  } else {
    cards.push({ key: "propuestas", label: "Propuestas abiertas", value: String(input.openProposalsCount), tone: "accent" });
    cards.push({
      key: "seguimiento",
      label: "Próximo seguimiento",
      value: next ? next.label : "Sin próxima acción",
      hint: next?.dueAt ? formatShortDate(next.dueAt) : undefined,
      tone: next ? (nextOverdue ? "danger" : "default") : "warning",
    });
    cards.push({
      key: "contacto",
      label: "Último contacto",
      value: formatShortDate(input.lastActivityAt ?? client.createdAt),
      tone: "default",
    });
  }

  // Por excepción: bloqueos siempre visibles, jamás un cero decorativo.
  if (stats.stopped > 0) {
    cards.push({ key: "detenidas", label: "Tareas detenidas", value: String(stats.stopped), tone: "danger" });
  }

  return cards;
}

// ── Checklist de arranque (ADR-0034) ─────────────────────────────────────────

export interface OnboardingStep {
  label: string;
  done: boolean;
}

export interface OnboardingCta {
  label: string;
  /** href para Links; si es null, la UI decide la acción (abrir modal). */
  href: string | null;
  action: "crear-propuesta" | "crear-proyecto" | "abrir-proyecto";
}

export interface OnboardingChecklist {
  steps: OnboardingStep[];
  cta: OnboardingCta;
  /** Proyecto destino cuando la CTA es abrir-proyecto. */
  projectId?: string;
}

/**
 * Tarjeta "Completa la cuenta" para clientes recién creados: convierte la
 * pantalla de cuatro ceros en una guía de qué sigue. La CTA principal cambia
 * según el estado (dictamen 2026-08-05).
 */
export function deriveOnboardingChecklist(
  client: CRMClient,
  openProposalsCount: number
): OnboardingChecklist {
  const status = client.crmStatus ?? "prospecto";
  const hasContact = Boolean(client.email || client.phone);
  const hasNextAction = Boolean(client.nextAction);
  const hasWork = client.projects.length > 0 || openProposalsCount > 0;
  // "Estado definido": salió del default O ya registró seguimiento (señal de
  // que el prospecto es deliberado, no solo el valor de fábrica).
  const statusDefined = status !== "prospecto" || hasNextAction;

  const steps: OnboardingStep[] = [
    { label: "Verificar datos de contacto", done: hasContact },
    { label: "Definir si es prospecto o cliente activo", done: statusDefined },
    { label: "Registrar la siguiente acción", done: hasNextAction },
    { label: "Crear propuesta o proyecto", done: hasWork },
  ];

  const firstProject = client.projects[0];
  const cta: OnboardingCta =
    status === "activo" && firstProject
      ? { label: "Abrir proyecto activo", href: `/proyectos/${firstProject.id}`, action: "abrir-proyecto" }
      : status === "activo"
        ? { label: "Crear proyecto", href: null, action: "crear-proyecto" }
        : { label: "Crear propuesta", href: null, action: "crear-propuesta" };

  return { steps, cta, projectId: firstProject?.id };
}

// ── Project-level derivations ─────────────────────────────────────────────────

export interface ProjectStats {
  totalTasks: number;
  openTasks: number;
  stopped: number;
  completed: number;
  pct: number;
  lastTaskAt: string;
}

export function deriveProjectStats(project: CRMProject): ProjectStats {
  let totalTasks = 0;
  let openTasks = 0;
  let stopped = 0;
  let completed = 0;
  let lastTaskAt = project.createdAt;

  for (const task of project.tasks) {
    totalTasks++;
    if (task.status === "pendiente" || task.status === "en_progreso" || task.status === "en_revision") openTasks++;
    if (task.status === "pausado" || task.status === "bloqueado") stopped++;
    if (task.status === "completado") completed++;
    if (task.createdAt > lastTaskAt) lastTaskAt = task.createdAt;
  }

  return {
    totalTasks,
    openTasks,
    stopped,
    completed,
    pct: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
    lastTaskAt,
  };
}

export function projectStatus(stats: ProjectStats): ClientBadge {
  if (stats.stopped > 0) {
    return { label: "Detenido", colorClass: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20" };
  }
  if (stats.totalTasks > 0 && stats.completed === stats.totalTasks) {
    return { label: "Completado", colorClass: "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20" };
  }
  return { label: "Activo", colorClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20" };
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export interface ActivityEvent {
  type: "client" | "project" | "task";
  label: string;
  context?: string;
  at: string;
}

export function buildActivityFeed(client: CRMClient, limit = 8): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  events.push({ type: "client", label: client.name, at: client.createdAt });

  for (const project of client.projects) {
    events.push({ type: "project", label: project.name, at: project.createdAt });
    for (const task of project.tasks) {
      events.push({ type: "task", label: task.name, context: project.name, at: task.createdAt });
    }
  }

  return events
    .sort((a, b) => (a.at > b.at ? -1 : 1))
    .slice(0, limit);
}

export function buildProjectActivityFeed(project: CRMProject, limit = 6): ActivityEvent[] {
  const events: ActivityEvent[] = [
    { type: "project", label: project.name, at: project.createdAt },
  ];
  for (const task of project.tasks) {
    events.push({ type: "task", label: task.name, at: task.createdAt });
  }
  return events.sort((a, b) => (a.at > b.at ? -1 : 1)).slice(0, limit);
}
