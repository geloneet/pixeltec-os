/**
 * FeatureGrid — 3 a 6 beneficios en tarjetas. Encabezado `<h2>` + una lista
 * real (`<ul>`/`<li>`) de tarjetas, cada una con `<h3>` y texto. El `variant`
 * cambia la densidad de columnas (`3-col` | `2-col`); en móvil siempre 1
 * columna. El `icono` es un string libre de la IA (emoji o etiqueta corta): se
 * pinta como monograma decorativo dentro de un chip de acento (`aria-hidden`),
 * nunca como HTML crudo.
 */
export interface FeatureGridProps {
  titulo: string;
  features: { titulo: string; texto: string; icono?: string }[];
  /** "3-col" (default) | "2-col". */
  variant: string;
}

export function FeatureGrid({ titulo, features, variant }: FeatureGridProps) {
  const cols = variant === "2-col" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      className="pf-block pf-feature-grid w-full"
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
          className="m-0"
          style={{
            fontFamily: "var(--pf-font-display)",
            fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            fontWeight: 700,
            maxWidth: "24ch",
          }}
        >
          {titulo}
        </h2>
        <ul
          className={`m-0 grid list-none grid-cols-1 p-0 ${cols}`}
          style={{ gap: "calc(var(--pf-space) * 1.5)", marginTop: "calc(var(--pf-space) * 2.5)" }}
        >
          {features.map((feature) => (
            <li
              key={feature.titulo}
              className="flex flex-col transition-transform duration-200 hover:-translate-y-1"
              style={{
                gap: "calc(var(--pf-space) * 0.75)",
                padding: "calc(var(--pf-space) * 1.5)",
                borderRadius: "var(--pf-radius)",
                boxShadow: "var(--pf-shadow)",
                border: "1px solid var(--pf-muted)",
                backgroundColor: "var(--pf-bg)",
              }}
            >
              {feature.icono && (
                <span
                  aria-hidden="true"
                  className="inline-flex h-11 w-11 items-center justify-center text-lg font-bold"
                  style={{
                    borderRadius: "var(--pf-radius)",
                    backgroundColor: "var(--pf-accent)",
                    color: "var(--pf-on-primary)",
                  }}
                >
                  {feature.icono.slice(0, 2)}
                </span>
              )}
              <h3 className="m-0" style={{ fontSize: "1.25rem", lineHeight: 1.25, fontWeight: 600 }}>
                {feature.titulo}
              </h3>
              <p className="m-0" style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--pf-muted)" }}>
                {feature.texto}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
