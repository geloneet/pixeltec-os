import { cn } from "@/lib/utils";

interface ForgeSeamProps extends React.HTMLAttributes<HTMLHRElement> {
  /** Veta de mayor peso para divisiones estructurales dentro de una zona. */
  strong?: boolean;
}

/**
 * ForgeSeam — separación por veta horizontal (PF-X1 T2).
 *
 * Regla de 1px con el color de la veta (`--pfx-seam`) para separar bloques DENTRO
 * de una `ForgeZone` sin multiplicar contenedores (DNA: "separación por vetas
 * horizontales; borde completo solo en el perímetro de la zona"). Semántica
 * `<hr>` (role=separator implícito). Server-safe.
 */
export function ForgeSeam({ strong = false, className, ...rest }: ForgeSeamProps) {
  return (
    <hr
      className={cn("forge-seam", strong && "forge-seam--strong", className)}
      {...rest}
    />
  );
}
