interface FieldProps {
  label: string;
  /** `null`/vacío se dibuja como «Sin datos», nunca como un hueco mudo. */
  value?: string | null;
  children?: React.ReactNode;
}

/**
 * Fila etiqueta/valor de las tarjetas de la pestaña Cuenta.
 *
 * Es una `<dl>` partida en pares: en móvil apila (390 px sin overflow) y a
 * partir de `sm` alinea la etiqueta en una columna fija. `children` permite
 * meter un badge o un enlace donde iría el texto.
 */
export function Field({ label, value, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/50 py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:w-44 sm:flex-shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">
        {children ?? (value ? value : <span className="text-muted-foreground/60">Sin datos</span>)}
      </dd>
    </div>
  );
}
