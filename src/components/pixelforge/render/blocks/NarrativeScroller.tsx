/**
 * NarrativeScroller — narrativa por pasos. En F6A es ESTÁTICO: el scroll
 * cinematográfico (reveal por paso, progreso ligado al scroll) llega en F6B con
 * motion. Aquí se rinde como una secuencia numerada editorial: una lista
 * ORDENADA (`<ol>`) donde cada paso muestra un índice grande (01, 02…), un
 * `<h3>` y su texto, unidos por una guía vertical de acento que da sensación de
 * recorrido sin animación.
 *
 * No lleva `titulo` propio (el schema solo define `pasos`); el índice se deriva
 * de la posición, formateado a dos dígitos.
 */
export interface NarrativeScrollerProps {
  pasos: { titulo: string; texto: string }[];
  /** "default". */
  variant: string;
}

export function NarrativeScroller({ pasos }: NarrativeScrollerProps) {
  return (
    <section
      className="pf-block pf-narrative-scroller w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 6)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <ol className="mx-auto m-0 w-full max-w-3xl list-none p-0">
        {pasos.map((paso, index) => {
          const isLast = index === pasos.length - 1;
          return (
            <li key={paso.titulo} className="grid grid-cols-[auto_1fr]" style={{ gap: "calc(var(--pf-space) * 1.5)" }}>
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: "var(--pf-font-display)",
                    fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: "var(--pf-accent)",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {!isLast && <span aria-hidden="true" style={{ flex: 1, width: "2px", marginTop: "calc(var(--pf-space) * 0.75)", backgroundColor: "var(--pf-muted)", opacity: 0.5 }} />}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "calc(var(--pf-space) * 0.5)",
                  paddingBottom: isLast ? "0" : "calc(var(--pf-space) * 3)",
                }}
              >
                <h3 className="m-0" style={{ fontFamily: "var(--pf-font-display)", fontSize: "clamp(1.35rem, 2.5vw, 1.85rem)", fontWeight: 700, lineHeight: 1.2 }}>
                  {paso.titulo}
                </h3>
                <p className="m-0" style={{ fontSize: "clamp(1rem, 1.5vw, 1.15rem)", lineHeight: 1.65, color: "var(--pf-muted)", maxWidth: "52ch" }}>
                  {paso.texto}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
