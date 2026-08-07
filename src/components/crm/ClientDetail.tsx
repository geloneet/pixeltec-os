"use client";

/**
 * Resumen del cliente (ADR-0034, dictamen 2026-08-05): de contenedor de
 * funciones a asistente operativo. Header con estado comercial y próxima
 * acción; tarjetas dinámicas según estado (nunca cuatro ceros); tarjeta de
 * arranque para clientes vacíos; historial persistente (client_activity) con
 * fallback al feed sintético para clientes sin eventos.
 */
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FolderKanban,
  MoreHorizontal,
  ArrowLeft,
  CircleDot,
  FileText,
  FileSignature,
  Receipt,
  Globe,
  Phone,
  MessageCircle,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Circle,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import type { CRMClient } from "@/types/crm";
import type { Proposal, BillingItem } from "@/types/documents";
import {
  deriveClientStats,
  deriveProjectStats,
  deriveResumenCards,
  deriveOnboardingChecklist,
  clientStatusBadge,
  buildActivityFeed,
  formatPhone,
  type ResumenCard,
} from "@/lib/crm/client-stats";
import { ProjectCardShared } from "./ProjectCardShared";
import { useCRM } from "./CRMContextCore";
import { useUser } from "@/hooks/use-user";
import { getProposals } from "@/lib/documents/proposals";
import { getBillingItemsForClient } from "@/lib/documents/billing";
import { getClientActivityAction, type ClientActivityEntry } from "./crm-actions";
import { setPortalAccessEnabledAction } from "@/lib/client-portal/admin-actions";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#0EA5E9", "#3b82f6", "#ef4444", "#f59e0b",
  "#10b981", "#ec4899", "#8b5cf6", "#06b6d4",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function relativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { locale: es, addSuffix: true });
  } catch {
    return "—";
  }
}

function exactDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es });
  } catch {
    return dateStr;
  }
}

const OPEN_PROPOSAL_STATUSES = new Set(["borrador", "enviada", "vista"]);
const PENDING_BILLING_STATUSES = new Set(["pendiente", "vencido", "parcial"]);

function activityIcon(type: string) {
  if (type.startsWith("propuesta")) return <FileText className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />;
  if (type.startsWith("contrato")) return <FileSignature className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.75} />;
  if (type.startsWith("factura")) return <Receipt className="h-3.5 w-3.5 text-green-400" strokeWidth={1.75} />;
  if (type.startsWith("portal")) return <Globe className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.75} />;
  if (type === "seguimiento") return <CalendarClock className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />;
  return <CircleDot className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />;
}

const CARD_TONE_CLASSES: Record<ResumenCard["tone"], string> = {
  default: "border-border bg-card",
  accent: "border-cyan-500/20 bg-cyan-500/[0.04]",
  warning: "border-amber-500/20 bg-amber-500/[0.04]",
  danger: "border-red-500/20 bg-red-500/[0.04]",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ClientDetailProps {
  client: CRMClient;
  setView: (v: "clients" | "client" | "project" | "search") => void;
  navigateToProject: (cid: string, pid: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
  deleteClient: (id: string) => void;
  /** Gate del tab Portal (lo controla ClientWorkspace). */
  portalEnabled?: boolean;
  onPortalEnabledChange?: (enabled: boolean) => void;
  /** Abre el tab Comercial (CTA "Crear propuesta" del onboarding). */
  onOpenComercial?: () => void;
}

// ── ClientDetail ──────────────────────────────────────────────────────────────

export function ClientDetail({
  client,
  setView,
  navigateToProject,
  setModal,
  deleteClient,
  portalEnabled,
  onPortalEnabledChange,
  onOpenComercial,
}: ClientDetailProps) {
  const crm = useCRM();
  const user = useUser();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Registro de seguimiento (chip "Sin próxima acción")
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpLabel, setFollowUpLabel] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpSaving, setFollowUpSaving] = useState(false);

  // Datos dinámicos del Resumen (propuestas/cobros/historial) — patrón I/O de
  // los otros tabs: una carga al montar, con degradación a datos locales.
  const [dyn, setDyn] = useState<{
    proposals: Proposal[];
    billing: BillingItem[];
    activity: ClientActivityEntry[];
  } | null>(null);
  // "No se pudo cargar" ≠ "no hay datos": sin esta bandera, un fallo de DB
  // mostraba contadores en cero y feed vacío como si el cliente no tuviera
  // propuestas/cobros reales — riesgo de seguimiento perdido o doble cobro.
  const [dynError, setDynError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setDynError(false);
    const failing = <T,>(label: string) => (err: unknown): T[] => {
      console.error(`[ClientDetail] carga de ${label} falló:`, err instanceof Error ? err.name : typeof err);
      if (!cancelled) setDynError(true);
      return [];
    };
    Promise.all([
      getProposals(user.uid, client.id).catch(failing<Proposal>("propuestas")),
      getBillingItemsForClient(client.id).catch(failing<BillingItem>("cobros")),
      getClientActivityAction(client.id, 8).catch(failing<ClientActivityEntry>("actividad")),
    ]).then(([proposals, billing, activity]) => {
      if (!cancelled) setDyn({ proposals, billing, activity });
    });
    return () => {
      cancelled = true;
    };
  }, [client.id, user]);

  const handleDeleteConfirmed = () => {
    deleteClient(client.id);
    setView("clients");
  };

  const handleSaveFollowUp = async () => {
    if (!followUpLabel.trim()) return;
    setFollowUpSaving(true);
    const ok = await crm.setClientNextAction(client.id, {
      label: followUpLabel.trim(),
      dueAt: followUpDate ? new Date(`${followUpDate}T12:00:00`).toISOString() : null,
    });
    setFollowUpSaving(false);
    if (ok) {
      setFollowUpOpen(false);
      setFollowUpLabel("");
      setFollowUpDate("");
    }
  };

  const handleEnablePortal = async () => {
    const result = await setPortalAccessEnabledAction(client.id, true);
    if (result.success) {
      onPortalEnabledChange?.(true);
      toast.success("Portal activado");
    } else {
      toast.error("No se pudo activar el portal", { description: result.error });
    }
  };

  const color = avatarColor(client.name);
  const clientStats = useMemo(() => deriveClientStats(client), [client]);
  const projectsWithStats = useMemo(
    () => client.projects.map(p => ({ project: p, stats: deriveProjectStats(p) })),
    [client.projects]
  );
  const headerBadge = clientStatusBadge(client.crmStatus, clientStats);
  const phone = formatPhone(client.phone);
  const nextAction = client.nextAction ?? null;
  const status = client.crmStatus ?? "prospecto";

  const openProposalsCount = dyn?.proposals.filter(p => OPEN_PROPOSAL_STATUSES.has(p.status)).length ?? 0;
  const pendingBillingCount = dyn?.billing.filter(b => PENDING_BILLING_STATUSES.has(b.status)).length ?? 0;

  const isEmptyClient = client.projects.length === 0 && openProposalsCount === 0;
  const onboarding = useMemo(
    () => deriveOnboardingChecklist(client, openProposalsCount),
    [client, openProposalsCount]
  );
  const cards = useMemo(
    () =>
      deriveResumenCards(client, clientStats, {
        openProposalsCount,
        pendingBillingCount,
        lastActivityAt: dyn?.activity[0]?.createdAt ?? null,
      }),
    [client, clientStats, openProposalsCount, pendingBillingCount, dyn]
  );

  const editClientModalData = {
    id: client.id,
    name: client.name,
    contactName: client.contactName ?? "",
    email: client.email,
    phone: client.phone,
    location: client.location,
    notes: client.notes,
    crmStatus: status,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">

      {/* Breadcrumb */}
      <button
        onClick={() => setView("clients")}
        className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Clientes
      </button>

      {/* ── SECCIÓN 1: HEADER ────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-card p-5">
        <span
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials(client.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">{client.name}</h2>
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", headerBadge.colorClass)}>
              {headerBadge.label}
            </span>
            <button
              onClick={() => setFollowUpOpen(true)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                nextAction
                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              )}
            >
              <CalendarClock className="h-3 w-3" aria-hidden />
              {nextAction ? nextAction.label : "Sin próxima acción"}
            </button>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            {client.location && <span>{client.location}</span>}
            {phone && (
              <span className="inline-flex items-center gap-1.5">
                <a href={phone.telHref} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                  <Phone className="h-3 w-3" aria-hidden />
                  {phone.display}
                </a>
                <a
                  href={phone.waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir WhatsApp"
                  className="text-green-500 transition-colors hover:text-green-400"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                </a>
              </span>
            )}
          </div>
          {(client.contactName || client.email) && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {client.contactName && (
                <>Contacto: <span className="text-foreground">{client.contactName}</span></>
              )}
              {client.contactName && client.email && " · "}
              {client.email && (
                <a href={`mailto:${client.email}`} className="transition-colors hover:text-foreground">{client.email}</a>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Acción principal única: crear proyecto (dos variantes) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 focus-visible:outline-none">
                <Sparkles className="h-3 w-3" aria-hidden />
                Crear proyecto
                <ChevronDown className="h-3 w-3" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-border bg-popover/95 backdrop-blur-xl">
              <DropdownMenuItem asChild className="cursor-pointer text-sm">
                <Link href={`/proyectos/definicion/nueva?client=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}`}>
                  Crear desde cero
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-sm"
                onSelect={() => setModal({ type: "addProject", data: { clientId: client.id } })}
              >
                Registrar proyecto existente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-border bg-popover/95 backdrop-blur-xl">
              <DropdownMenuItem
                className="cursor-pointer text-sm"
                onSelect={() => setModal({ type: "editClient", data: editClientModalData })}
              >
                Editar cliente
              </DropdownMenuItem>
              {status !== "activo" && (
                <DropdownMenuItem
                  className="cursor-pointer text-sm"
                  onSelect={() => void crm.setClientStatus(client.id, "activo")}
                >
                  Marcar como cliente activo
                </DropdownMenuItem>
              )}
              {status !== "pausado" && (
                <DropdownMenuItem
                  className="cursor-pointer text-sm"
                  onSelect={() => void crm.setClientStatus(client.id, "pausado")}
                >
                  Pausar cliente
                </DropdownMenuItem>
              )}
              {status !== "cerrado" && (
                <DropdownMenuItem
                  className="cursor-pointer text-sm"
                  onSelect={() => void crm.setClientStatus(client.id, "cerrado")}
                >
                  Marcar como cerrado
                </DropdownMenuItem>
              )}
              {!portalEnabled && (
                <DropdownMenuItem
                  className="cursor-pointer text-sm"
                  onSelect={() => void handleEnablePortal()}
                >
                  Activar portal del cliente
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="cursor-pointer text-sm text-red-400 focus:bg-red-500/10 focus:text-red-300"
                onSelect={() => setDeleteOpen(true)}
              >
                Eliminar cliente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── SECCIÓN 2: SNAPSHOT ──────────────────────────────────────────── */}
      {isEmptyClient ? (
        /* Cliente recién creado: guía de arranque en lugar de cuatro ceros. */
        <div className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] p-5">
          <h3 className="text-sm font-semibold text-foreground">Completa la cuenta</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Esta cuenta está recién creada. Sigue estos pasos para dejarla operativa:
          </p>
          <ol className="mt-3 space-y-2">
            {onboarding.steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2 text-sm">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" aria-hidden />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : "text-foreground"}>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            {onboarding.cta.action === "crear-propuesta" && (
              <button
                onClick={onOpenComercial}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-cyan-400"
              >
                {onboarding.cta.label}
              </button>
            )}
            {onboarding.cta.action === "crear-proyecto" && (
              <Link
                href={`/proyectos/definicion/nueva?client=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}`}
                className="inline-block rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-cyan-400"
              >
                {onboarding.cta.label}
              </Link>
            )}
            {onboarding.cta.action === "abrir-proyecto" && onboarding.projectId && (
              <button
                onClick={() => navigateToProject(client.id, onboarding.projectId!)}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-cyan-400"
              >
                {onboarding.cta.label}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={cn("mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3", cards.length === 4 && "sm:grid-cols-4")}>
          {cards.map((card) => (
            <div key={card.key} className={cn("rounded-xl border p-4", CARD_TONE_CLASSES[card.tone])}>
              <p className="text-[11px] text-muted-foreground">{card.label}</p>
              <p className={cn(
                "mt-1 truncate text-lg font-bold",
                card.tone === "danger" ? "text-red-300" : "text-foreground"
              )}>
                {card.value}
              </p>
              {card.hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{card.hint}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── SECCIÓN 3: PROYECTOS ACTIVOS ─────────────────────────────────── */}
      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Proyectos activos</h3>
          <span className="text-xs text-muted-foreground">{client.projects.length} proyecto{client.projects.length !== 1 ? "s" : ""}</span>
        </div>

        {client.projects.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-10 text-center">
            <FolderKanban className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">Este cliente todavía no tiene proyectos.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Usa <span className="font-medium text-cyan-400">Crear proyecto</span> arriba — desde cero,
              o registrando uno que ya esté en ejecución.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projectsWithStats.map(({ project, stats }) => (
              <ProjectCardShared
                key={project.id}
                project={project}
                stats={stats}
                clientId={client.id}
                navigateToProject={navigateToProject}
                setModal={setModal}
                openLabel="Ver"
              />
            ))}
          </div>
        )}
      </div>

      {dynError && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            No se pudieron cargar propuestas, cobros o actividad de este cliente.
            Los contadores pueden estar incompletos — recarga la página para reintentar.
          </p>
        </div>
      )}

      {/* ── SECCIÓN 4: ACTIVIDAD RECIENTE ────────────────────────────────── */}
      {dyn && dyn.activity.length > 0 ? (
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Actividad reciente</h3>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {dyn.activity.map((event) => (
              <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 flex-shrink-0">{activityIcon(event.type)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-medium text-foreground">{event.message}</span>
                    {event.actorName && (
                      <span className="ml-1 text-muted-foreground">· {event.actorName}</span>
                    )}
                  </p>
                </div>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex-shrink-0 cursor-default text-[10px] text-muted-foreground tabular-nums">
                        {relativeTime(event.createdAt)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="border-border bg-card text-foreground text-xs">
                      {exactDate(event.createdAt)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Fallback: clientes previos al historial persistente conservan el
           feed sintético (creaciones de cliente/proyecto/tarea). */
        (() => {
          const feed = buildActivityFeed(client, 8);
          if (feed.length === 0) return null;
          return (
            <div className="mb-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Actividad reciente</h3>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {feed.map((event, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {event.type === "client" && <CircleDot className="h-3.5 w-3.5 text-cyan-400" strokeWidth={2} />}
                      {event.type === "project" && <FolderKanban className="h-3.5 w-3.5 text-violet-400" strokeWidth={1.75} />}
                      {event.type === "task" && <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {event.type === "client" && "Cliente creado · "}
                        {event.type === "project" && "Proyecto creado · "}
                        {event.type === "task" && "Tarea creada · "}
                        <span className="font-medium text-foreground">{event.label}</span>
                        {event.context && <span className="ml-1 text-muted-foreground">· {event.context}</span>}
                      </p>
                    </div>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-shrink-0 cursor-default text-[10px] text-muted-foreground tabular-nums">
                            {relativeTime(event.at)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="border-border bg-card text-foreground text-xs">
                          {exactDate(event.at)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))}
              </div>
            </div>
          );
        })()
      )}

      {/* ── SECCIÓN 5: NOTAS ─────────────────────────────────────────────── */}
      {client.notes && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notas</p>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{client.notes}</p>
        </div>
      )}

      {/* Registrar seguimiento */}
      <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Registrar seguimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">¿Qué sigue con este cliente? *</label>
              <input
                value={followUpLabel}
                onChange={(e) => setFollowUpLabel(e.target.value)}
                placeholder="Llamar para revisar la propuesta"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground transition-colors focus:border-[#0EA5E9] focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Fecha (opcional)</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground transition-colors focus:border-[#0EA5E9] focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            {nextAction && (
              <button
                onClick={async () => {
                  await crm.setClientNextAction(client.id, null);
                  setFollowUpOpen(false);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Quitar seguimiento
              </button>
            )}
            <button
              onClick={() => void handleSaveFollowUp()}
              disabled={followUpSaving || !followUpLabel.trim()}
              className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
            >
              {followUpSaving ? "Guardando…" : "Guardar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{client.name}</span> y todos
              sus proyectos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-red-700 text-white hover:bg-red-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
