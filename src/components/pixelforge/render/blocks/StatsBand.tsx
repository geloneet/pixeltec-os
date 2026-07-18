/**
 * StatsBand — franja de 2-4 métricas destacadas. Semántica de lista de
 * descripción (`<dl>`): cada métrica es un grupo `<dt>` (etiqueta) + `<dd>`
 * (valor). El valor es el protagonista visual (cifra grande en acento) y se
 * coloca ARRIBA de la etiqueta con `order` de CSS, sin romper el orden
 * DOM/lectura (dt → dd) que exige `<dl>`.
 *
 * Variant único `default`: una fila de columnas separadas por una guía
 * discreta, con ritmo generoso de `--pf-space`.
 */
export interface StatsBandProps {
  stats: { valor: string; etiqueta: string }[];
  /** "default". */
  variant: string;
}

export function StatsBand({ stats }: StatsBandProps) {
  return (
    <section
      className="pf-block pf-stats-band w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
        borderBlock: "1px solid var(--pf-muted)",
      }}
    >
      <dl
        className="mx-auto m-0 grid w-full max-w-5xl grid-cols-2 text-center md:grid-cols-4"
        style={{ gap: "calc(var(--pf-space) * 2)" }}
      >
        {stats.map((stat) => (
          <div
            key={stat.etiqueta}
            className="flex flex-col items-center"
            style={{ gap: "calc(var(--pf-space) * 0.35)" }}
          >
            <dt style={{ order: 2, fontSize: "0.95rem", lineHeight: 1.4, color: "var(--pf-muted)", maxWidth: "18ch" }}>
              {stat.etiqueta}
            </dt>
            <dd
              className="m-0"
              style={{
                order: 1,
                fontFamily: "var(--pf-font-display)",
                fontSize: "clamp(2.5rem, 6vw, 4rem)",
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: "var(--pf-primary)",
              }}
            >
              <span data-pf-motion-count={stat.valor}>{stat.valor}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
