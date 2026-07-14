import {
  Activity,
  CheckCircle2,
  Database,
  Gauge,
  Globe,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VpsSnapshot } from "@/lib/vps-types";

type Tone = "red" | "amber" | "emerald" | "zinc";

const TONE_TEXT: Record<Tone, string> = {
  red: "text-red-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  zinc: "text-muted-foreground",
};

const TONE_PILL: Record<Tone, string> = {
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  zinc: "border-border bg-secondary/40 text-muted-foreground",
};

const TONE_BAR: Record<"red" | "amber" | "emerald", string> = {
  red: "from-red-500 to-rose-400",
  amber: "from-amber-500 to-orange-400",
  emerald: "from-emerald-500 to-teal-400",
};

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-roboto text-xs font-medium",
        TONE_PILL[tone]
      )}
    >
      {children}
    </span>
  );
}

function PanelShell({
  icon: Icon,
  title,
  right,
  children,
}: {
  icon: typeof Database;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border before:to-transparent"
      )}
    >
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <h3 className="font-poppins text-lg font-semibold text-foreground">
            {title}
          </h3>
        </div>
        {right}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  label,
}: {
  icon: typeof Database;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
      <p className="font-roboto text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ── 1. Bases de datos ──────────────────────────────────────────────────────

function backupAgeTone(hrs: number | null): "red" | "amber" | "emerald" {
  if (hrs === null) return "red";
  if (hrs > 26) return "amber";
  return "emerald";
}

function backupAgeLabel(hrs: number | null): string {
  if (hrs === null) return "nunca respaldada";
  return `hace ${hrs}h`;
}

function DatabasesPanel({ databases }: { databases: VpsSnapshot["databases"] }) {
  return (
    <PanelShell icon={Database} title="Bases de datos">
      {databases.length === 0 ? (
        <EmptyState icon={Database} label="sin bases de datos" />
      ) : (
        <ul className="divide-y divide-border/60">
          {databases.map((db) => {
            const tone = backupAgeTone(db.lastBackupAgeHrs);
            return (
              <li
                key={db.name}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-roboto text-sm font-medium text-foreground">
                    {db.name}
                  </p>
                  <p className="font-roboto text-xs text-muted-foreground">{db.size}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-roboto text-xs font-medium",
                    TONE_TEXT[tone]
                  )}
                >
                  {backupAgeLabel(db.lastBackupAgeHrs)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

// ── 2. Certificados TLS ─────────────────────────────────────────────────────

function certTone(daysLeft: number): "red" | "amber" | "emerald" {
  if (daysLeft < 10) return "red";
  if (daysLeft < 21) return "amber";
  return "emerald";
}

function CertsPanel({ certs }: { certs: VpsSnapshot["certs"] }) {
  return (
    <PanelShell icon={ShieldCheck} title="Certificados TLS">
      {certs.length === 0 ? (
        <EmptyState icon={ShieldCheck} label="sin certificados" />
      ) : (
        <ul className="divide-y divide-border/60">
          {certs.map((cert) => {
            const tone = certTone(cert.daysLeft);
            return (
              <li
                key={cert.domain}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <p className="truncate font-roboto text-sm font-medium text-foreground">
                  {cert.domain}
                </p>
                <span
                  className={cn(
                    "shrink-0 font-roboto text-xs font-medium",
                    TONE_TEXT[tone]
                  )}
                >
                  {cert.daysLeft}d restantes
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

// ── 3. Backups ───────────────────────────────────────────────────────────────

function BackupsPanel({ backups }: { backups: VpsSnapshot["backups"] }) {
  return (
    <PanelShell
      icon={backups.ok ? ShieldCheck : ShieldAlert}
      title="Backups"
      right={<Chip tone={backups.ok ? "emerald" : "red"}>{backups.ok ? "ok" : "con problemas"}</Chip>}
    >
      <div className="space-y-3">
        <p className="font-roboto text-sm text-foreground">
          Último backup{" "}
          {backups.lastRunAgeHrs === null ? (
            <span className="font-medium text-red-400">nunca corrió</span>
          ) : (
            <span className="font-medium text-foreground">
              hace {backups.lastRunAgeHrs}h
            </span>
          )}
        </p>

        <div>
          <p className="mb-1.5 font-roboto text-xs uppercase tracking-wide text-muted-foreground">
            Cobertura
          </p>
          {backups.coverageMissing.length === 0 ? (
            <Chip tone="emerald">completa</Chip>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {backups.coverageMissing.map((name) => (
                <Chip key={name} tone="red">
                  {name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <Chip tone={backups.offsite ? "emerald" : "red"}>
          {backups.offsite ? "offsite ok" : "sin offsite"}
        </Chip>
      </div>
    </PanelShell>
  );
}

// ── 4. Seguridad ─────────────────────────────────────────────────────────────

function SecurityPanel({ security }: { security: VpsSnapshot["security"] }) {
  return (
    <PanelShell icon={Lock} title="Seguridad">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={security.securityUpdates > 0 ? "amber" : "emerald"}>
          {security.securityUpdates} actualizaciones de seguridad
        </Chip>
        <Chip tone={security.sshPassword ? "amber" : "emerald"}>
          {security.sshPassword ? "SSH: password activo" : "SSH: solo keys"}
        </Chip>
        {security.publicPortsOutOfPolicy.map((port) => (
          <Chip key={port} tone="red">
            puerto {port} fuera de política
          </Chip>
        ))}
        {security.secretsInLogs.map((name) => (
          <Chip key={name} tone="red">
            token en logs: {name}
          </Chip>
        ))}
      </div>
    </PanelShell>
  );
}

// ── 5. Almacenamiento ────────────────────────────────────────────────────────

function usageBarTone(pct: number): "red" | "amber" | "emerald" {
  if (pct > 85) return "red";
  if (pct > 75) return "amber";
  return "emerald";
}

function UsageBar({ pct }: { pct: number }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r transition-all duration-500",
          TONE_BAR[usageBarTone(pct)]
        )}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function ResourcesPanel({ host }: { host: VpsSnapshot["host"] }) {
  return (
    <PanelShell icon={Gauge} title="Recursos (RAM · carga)">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between font-roboto text-xs text-muted-foreground">
            <span>RAM</span>
            <span>{host.ramUsedPct}%</span>
          </div>
          <UsageBar pct={host.ramUsedPct} />
        </div>
        <div className="flex items-center justify-between font-roboto text-xs uppercase tracking-wide text-muted-foreground">
          <span>Load average</span>
          <span className="normal-case text-foreground">
            {host.load1} / {host.nproc} cores
          </span>
        </div>
      </div>
    </PanelShell>
  );
}

// ── 5b. Servicios (salud HTTP) ───────────────────────────────────────────────

function httpTone(httpOk: boolean | null): "red" | "emerald" | "zinc" {
  if (httpOk === true) return "emerald";
  if (httpOk === false) return "red";
  return "zinc";
}

function httpLabel(httpOk: boolean | null, httpCode: number | null): string {
  if (httpOk === true) return httpCode !== null ? `HTTP ${httpCode}` : "ok";
  if (httpOk === false) return httpCode !== null ? `HTTP ${httpCode}` : "error";
  return "sin check";
}

function ServicesHealthPanel({ services }: { services: VpsSnapshot["services"] }) {
  const withDomain = services.filter((svc) => svc.domain !== null);

  return (
    <PanelShell icon={Globe} title="Servicios (salud HTTP)">
      {withDomain.length === 0 ? (
        <EmptyState icon={Globe} label="sin servicios con dominio" />
      ) : (
        <ul className="divide-y divide-border/60">
          {withDomain.map((svc) => (
            <li
              key={svc.id}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <p className="truncate font-roboto text-sm font-medium text-foreground">
                {svc.domain}
              </p>
              <Chip tone={httpTone(svc.httpOk)}>
                {httpLabel(svc.httpOk, svc.httpCode)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

// ── 6. Salud del host ────────────────────────────────────────────────────────

function crashTone(restarts: number): "red" | "amber" | "emerald" {
  if (restarts > 500) return "red";
  if (restarts > 50) return "amber";
  return "emerald";
}

function HostHealthPanel({
  crashLoops,
}: {
  crashLoops: VpsSnapshot["host"]["crashLoops"];
}) {
  return (
    <PanelShell icon={Activity} title="Salud del host">
      {crashLoops.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
          <p className="font-roboto text-sm text-emerald-400">sin crash-loops</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {crashLoops.map((loop) => {
            const tone = crashTone(loop.restarts);
            return (
              <li
                key={loop.name}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <p className="truncate font-roboto text-sm font-medium text-foreground">
                  {loop.name}
                </p>
                <span
                  className={cn(
                    "shrink-0 font-roboto text-xs font-medium",
                    TONE_TEXT[tone]
                  )}
                >
                  {loop.restarts} reinicios
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

// ── Grid principal ───────────────────────────────────────────────────────────

export function HealthPanels({ snapshot }: { snapshot: VpsSnapshot }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <DatabasesPanel databases={snapshot.databases} />
      <CertsPanel certs={snapshot.certs} />
      <BackupsPanel backups={snapshot.backups} />
      <SecurityPanel security={snapshot.security} />
      <ResourcesPanel host={snapshot.host} />
      <HostHealthPanel crashLoops={snapshot.host.crashLoops} />
      <ServicesHealthPanel services={snapshot.services} />
    </div>
  );
}
