/**
 * ProcessSteps — 3-5 pasos numerados y ESTÁTICOS del proceso del cliente (para
 * una narrativa ligada al scroll existe narrative-scroller). Semántica de lista
 * ORDENADA (`<ol>`) con `<h3>` por paso. El `numero` viene del schema y se pinta
 * en un disco de marca.
 *
 * El `variant` cambia la composición:
 *  - `horizontal`: pasos en fila (grid de N columnas), disco arriba + texto
 *    debajo — lectura de izquierda a derecha.
 *  - `vertical`: línea de tiempo hacia abajo, disco a la izquierda unido por una
 *    guía vertical + contenido a la derecha.
 */
export interface ProcessStepsProps {
  titulo: string;
  pasos: { numero: number; titulo: string; texto: string }[];
  /** "horizontal" (default) | "vertical". */
  variant: string;
}

export function ProcessSteps({ titulo, pasos, variant }: ProcessStepsProps) {
  const vertical = variant === "vertical";
  // Una columna por paso (3-5) para que no haga wrap desparejo (p.ej. 4+1 con 5).
  const HORIZONTAL_COLS: Record<number, string> = {
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
  };
  const cols = HORIZONTAL_COLS[pasos.length] ?? "md:grid-cols-3";

  const disc = (numero: number) => (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center font-bold"
      style={{
        width: "3rem",
        height: "3rem",
        borderRadius: "999px",
        backgroundColor: "var(--pf-primary)",
        color: "var(--pf-on-primary)",
        fontFamily: "var(--pf-font-display)",
        fontSize: "1.25rem",
      }}
    >
      {numero}
    </span>
  );

  return (
    <section
      className="pf-block pf-process-steps w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div className="mx-auto w-full max-w-6xl">
        <h2
          className={`m-0 ${vertical ? "" : "text-center"}`}
          style={{
            fontFamily: "var(--pf-font-display)",
            fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            fontWeight: 700,
            maxWidth: vertical ? "24ch" : "none",
          }}
        >
          {titulo}
        </h2>

        {vertical ? (
          <ol className="m-0 list-none p-0" style={{ marginTop: "calc(var(--pf-space) * 2.5)" }}>
            {pasos.map((paso, index) => {
              const isLast = index === pasos.length - 1;
              return (
                <li key={paso.numero} className="grid grid-cols-[auto_1fr]" style={{ gap: "calc(var(--pf-space) * 1.5)" }}>
                  <div className="flex flex-col items-center">
                    {disc(paso.numero)}
                    {!isLast && <span aria-hidden="true" style={{ flex: 1, width: "2px", marginTop: "calc(var(--pf-space) * 0.5)", backgroundColor: "var(--pf-muted)", opacity: 0.5 }} />}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "calc(var(--pf-space) * 0.4)",
                      paddingBottom: isLast ? "0" : "calc(var(--pf-space) * 2.5)",
                      paddingTop: "calc(var(--pf-space) * 0.5)",
                    }}
                  >
                    <h3 className="m-0" style={{ fontSize: "1.3rem", fontWeight: 600, lineHeight: 1.25 }}>
                      {paso.titulo}
                    </h3>
                    <p className="m-0" style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--pf-muted)", maxWidth: "52ch" }}>
                      {paso.texto}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <ol
            className={`m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 ${cols}`}
            style={{ gap: "calc(var(--pf-space) * 2)", marginTop: "calc(var(--pf-space) * 3)" }}
          >
            {pasos.map((paso) => (
              <li key={paso.numero} className="flex flex-col" style={{ gap: "calc(var(--pf-space) * 0.75)" }}>
                {disc(paso.numero)}
                <h3 className="m-0" style={{ fontSize: "1.2rem", fontWeight: 600, lineHeight: 1.25, marginTop: "calc(var(--pf-space) * 0.5)" }}>
                  {paso.titulo}
                </h3>
                <p className="m-0" style={{ fontSize: "0.98rem", lineHeight: 1.6, color: "var(--pf-muted)" }}>
                  {paso.texto}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
