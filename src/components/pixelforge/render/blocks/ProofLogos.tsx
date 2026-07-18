/**
 * ProofLogos — franja de prueba social. F6A no aporta imágenes de logo: cada
 * marca se pinta como un wordmark tipográfico (mayúsculas, tracking amplio,
 * familia display) dentro de una lista real (`<ul>`/`<li>`) — accesible y sin
 * `<img>` vacíos. El `titulo` es opcional y se rinde como un `<h2>` pequeño y
 * discreto (el protagonista son los logos, no el encabezado).
 *
 * El `variant` recompone el layout:
 *  - `row`: una fila que hace wrap, wordmarks separados por aire (barra clásica).
 *  - `grid`: celdas con borde en retícula (2→4 columnas), para 6-8 marcas.
 */
export interface ProofLogosProps {
  titulo?: string;
  logos: { nombre: string }[];
  /** "row" (default) | "grid". */
  variant: string;
}

export function ProofLogos({ titulo, logos, variant }: ProofLogosProps) {
  const grid = variant === "grid";

  const wordmarkStyle = {
    fontFamily: "var(--pf-font-display)",
    fontSize: "clamp(1.05rem, 2vw, 1.4rem)",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: "var(--pf-fg)",
    opacity: 0.75,
  } as const;

  return (
    <section
      className="pf-block pf-proof-logos w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 4)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-6xl flex-col items-center"
        style={{ gap: "calc(var(--pf-space) * 2)" }}
      >
        {titulo && (
          <h2
            className="m-0 text-center uppercase"
            style={{ fontSize: "0.8rem", letterSpacing: "0.16em", fontWeight: 600, color: "var(--pf-muted)" }}
          >
            {titulo}
          </h2>
        )}
        {grid ? (
          <ul
            className="m-0 grid w-full list-none grid-cols-2 p-0 sm:grid-cols-3 lg:grid-cols-4"
            style={{ gap: "calc(var(--pf-space) * 1)" }}
          >
            {logos.map((logo) => (
              <li
                key={logo.nombre}
                data-pf-motion-item=""
                className="flex items-center justify-center"
                style={{
                  padding: "calc(var(--pf-space) * 1.5)",
                  borderRadius: "var(--pf-radius)",
                  border: "1px solid var(--pf-muted)",
                }}
              >
                <span style={wordmarkStyle}>{logo.nombre}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul
            className="m-0 flex list-none flex-wrap items-center justify-center p-0"
            style={{ gap: "calc(var(--pf-space) * 2.5)" }}
          >
            {logos.map((logo) => (
              <li key={logo.nombre} data-pf-motion-item="">
                <span style={wordmarkStyle}>{logo.nombre}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
