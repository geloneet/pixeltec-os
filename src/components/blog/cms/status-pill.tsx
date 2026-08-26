import { cn } from "@/lib/utils";

/** Estados del flujo Encino + los legacy (needs-review/approved) degradados a «Borrador». */
const LABEL: Record<string, string> = {
  published: "Publicada",
  scheduled: "Programada",
  draft: "Borrador",
  "needs-review": "Borrador · en revisión",
  approved: "Borrador · aprobado",
  archived: "Archivada",
};
const DOT: Record<string, string> = {
  published: "bg-green-500",
  scheduled: "bg-purple-500",
  draft: "bg-zinc-400",
  "needs-review": "bg-yellow-500",
  approved: "bg-blue-500",
  archived: "bg-zinc-600",
};

export function statusLabel(status: string): string {
  return LABEL[status] ?? status;
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground", className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[status] ?? "bg-zinc-400")} />
      {statusLabel(status)}
    </span>
  );
}
