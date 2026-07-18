import { cn } from "@/lib/utils";

export type ForgeState =
  | "draft"
  | "forging"
  | "sealed"
  | "locked"
  | "invalidated";

interface ForgeZoneProps extends React.HTMLAttributes<HTMLElement> {
  /** Superficie base de la plancha. `elevated` para bancos activos, modales, popovers. */
  variant?: "surface" | "elevated";
  /** Estado canónico del DNA — define la materialidad (veta, notch, punteado). */
  state?: ForgeState;
  /** Elemento contenedor. Zona semántica (`section`) o neutro (`div`). */
  as?: "section" | "div";
}

/**
 * ForgeZone — "la plancha anclada" (PF-X1 T2).
 *
 * Superficie de banco del DNA de PixelForge: radio 6px, borde de perímetro y una
 * VETA en el borde izquierdo cuya materialidad depende del estado. NO es la
 * tarjeta genérica `rounded-xl border bg-card` (patrón prohibido).
 *
 * Toda la materialidad (veta, animación de flujo en `forging`, notch 45° de
 * `sealed`, punteado de `locked`, veta discontinua de `invalidated`) vive en CSS
 * escopado (`pixelforge-theme.css`, `.forge-zone*`), NO en JS: la animación de la
 * veta se anima por `background-position` y queda estática bajo
 * `prefers-reduced-motion: reduce`. El componente solo aporta clases + `data-state`.
 *
 * Server-safe (sin estado ni hooks).
 */
export function ForgeZone({
  variant = "surface",
  state = "draft",
  as = "div",
  className,
  children,
  ...rest
}: ForgeZoneProps) {
  const Tag = as;
  return (
    <Tag
      data-state={state}
      className={cn(
        "forge-zone",
        `forge-zone--${state}`,
        variant === "elevated" ? "bg-pfx-surface-elevated" : "bg-pfx-surface",
        "text-pfx-text",
        className,
      )}
      {...rest}
    >
      {/* El contenido se atenúa al 55% SOLO en `locked` (DNA), sin tocar el
          perímetro ni la veta para que la zona siga leyéndose como plancha. */}
      <div className="forge-zone__content">{children}</div>
    </Tag>
  );
}
