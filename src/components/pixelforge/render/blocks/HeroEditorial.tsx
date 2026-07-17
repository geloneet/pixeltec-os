/**
 * HeroEditorial — hero de apertura para direcciones editoriales/minimalistas
 * donde el copy es el protagonista y no hay media hero. Un único `<h1>` con
 * display fluido y grande, un `kicker` como antetítulo (eyebrow) en acento, un
 * párrafo de apoyo y el CTA. TODO color/forma sale de `--pf-*`.
 *
 * El `variant` cambia la COMPOSICIÓN, no la semántica:
 *  - `centered`: una sola columna centrada (voz de marca directa, simétrica).
 *  - `offset`: retícula asimétrica — el título grande ocupa la columna ancha a
 *    la izquierda y el párrafo + CTA caen en una columna angosta alineada al
 *    pie a la derecha (aire editorial de revista).
 */
export interface HeroEditorialProps {
  titulo: string;
  kicker: string;
  parrafo: string;
  cta: { label: string; href: string };
  /** "centered" (default) | "offset". */
  variant: string;
}

export function HeroEditorial({ titulo, kicker, parrafo, cta, variant }: HeroEditorialProps) {
  const offset = variant === "offset";

  const kickerEl = (
    <p
      className="m-0 uppercase"
      style={{
        fontFamily: "var(--pf-font-body)",
        fontSize: "0.8rem",
        letterSpacing: "0.18em",
        fontWeight: 600,
        color: "var(--pf-accent)",
      }}
    >
      {kicker}
    </p>
  );

  const tituloEl = (
    <h1
      className="m-0"
      style={{
        fontFamily: "var(--pf-font-display)",
        fontSize: offset ? "clamp(2.75rem, 7vw, 5.5rem)" : "clamp(2.5rem, 6vw, 4.5rem)",
        lineHeight: 1.02,
        letterSpacing: "-0.03em",
        fontWeight: 700,
        maxWidth: offset ? "14ch" : "18ch",
      }}
    >
      {titulo}
    </h1>
  );

  const parrafoEl = (
    <p
      className="m-0"
      style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.35rem)", lineHeight: 1.65, color: "var(--pf-muted)", maxWidth: "46ch" }}
    >
      {parrafo}
    </p>
  );

  const ctaEl = (
    <a
      href={cta.href}
      className="inline-flex items-center justify-center px-7 py-3 font-semibold no-underline transition-[transform,opacity] duration-200 hover:-translate-y-0.5 hover:opacity-90"
      style={{
        backgroundColor: "var(--pf-primary)",
        color: "var(--pf-on-primary)",
        borderRadius: "var(--pf-radius)",
        boxShadow: "var(--pf-shadow)",
      }}
    >
      {cta.label}
    </a>
  );

  return (
    <section
      className="pf-block pf-hero-editorial w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 6)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      {offset ? (
        <div
          className="mx-auto grid w-full max-w-6xl grid-cols-1 items-end md:grid-cols-[1.4fr_0.6fr]"
          style={{ gap: "calc(var(--pf-space) * 2.5)" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--pf-space) * 1.25)" }}>
            {kickerEl}
            {tituloEl}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--pf-space) * 1.5)" }}>
            {parrafoEl}
            <div>{ctaEl}</div>
          </div>
        </div>
      ) : (
        <div
          className="mx-auto flex w-full max-w-3xl flex-col items-center text-center"
          style={{ gap: "calc(var(--pf-space) * 1.5)" }}
        >
          {kickerEl}
          {tituloEl}
          {parrafoEl}
          <div>{ctaEl}</div>
        </div>
      )}
    </section>
  );
}
