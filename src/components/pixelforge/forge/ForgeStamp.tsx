import { Stamp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForgeStampProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Fecha de sellado en ISO (ej. `2026-07-18` o timestamp completo). */
  sealedAt: string;
}

/**
 * Formatea la fecha de sellado a es-MX `dd mmm yyyy` → "18 jul 2026".
 *
 * Se construye por partes y en UTC para ser determinista (independiente de la
 * zona horaria del runtime) y para normalizar el mes abreviado: algunos ICU
 * devuelven "jul." con punto — se recorta para que la estampa siempre lea
 * "SELLADO · 18 jul 2026".
 */
function formatSealedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
  const month = new Intl.DateTimeFormat("es-MX", {
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/\.$/, "")
    .toLowerCase();
  const year = new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `${day} ${month} ${year}`;
}

/**
 * ForgeStamp — estampa de sello (PF-X1 T2).
 *
 * La marca de autor del taller: cuando un artefacto se sella, la veta se
 * solidifica y aparece esta estampa en mono (IBM Plex Mono, `font-forge-mono`),
 * tracking amplio, en acero frío (`--pfx-forge-sealed`) con el glifo semántico
 * `Stamp` (Lucide, stroke default). Server-safe.
 */
export function ForgeStamp({ sealedAt, className, ...rest }: ForgeStampProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-forge-mono text-[11px] uppercase tracking-[0.18em] text-pfx-forge-sealed",
        className,
      )}
      {...rest}
    >
      <Stamp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {`SELLADO · ${formatSealedDate(sealedAt)}`}
    </span>
  );
}
