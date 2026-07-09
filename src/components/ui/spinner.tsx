import { cn } from "@/lib/utils"

// Spinner compartido — anillo con gradiente en el stroke (no un ícono girando
// parejo como los LoaderCircle/Loader2 de lucide) para un look más "premium"
// consistente con el resto del rediseño (Linear/Vercel). Hereda color de texto
// vía `currentColor` salvo que se pase un color explícito en `className`.

const SIZE_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 16,
  md: 24,
  lg: 56,
}

interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg"
  /** Texto accesible para lectores de pantalla (el spinner en sí es aria-hidden). */
  label?: string
}

function Spinner({ size = "md", className, label = "Cargando", ...props }: SpinnerProps) {
  const px = SIZE_PX[size]
  // id único por instancia para que el <linearGradient> no colisione si hay
  // varios spinners montados a la vez en la misma página.
  const gradientId = `spinner-gradient-${size}-${px}`

  return (
    <span role="status" className="inline-flex">
      <svg
        aria-hidden="true"
        className={cn("animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite]", className)}
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        {...props}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeDasharray="52 20"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export { Spinner }
