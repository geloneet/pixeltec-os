/**
 * TestimonialQuote — 1-3 testimonios reales. Semántica de cita correcta:
 * `<figure>` → `<blockquote>` (el texto) + `<figcaption>` con el autor y su
 * cargo en `<cite>`. Se listan en un `<ul>`/`<li>` real.
 *
 * El `variant` cambia la composición (NO hay JS de carrusel — eso es F6B):
 *  - `single`: citas apiladas a una columna, la tipografía de la cita grande y
 *    protagonista (ideal para 1 testimonio fuerte).
 *  - `carousel-static`: las citas en una fila (grid de tarjetas), tamaño de
 *    cita más contenido — una "tira" estática de social proof.
 */
export interface TestimonialQuoteProps {
  quotes: { texto: string; autor: string; cargo?: string }[];
  /** "single" (default) | "carousel-static". */
  variant: string;
}

export function TestimonialQuote({ quotes, variant }: TestimonialQuoteProps) {
  const row = variant === "carousel-static";
  const cols = quotes.length >= 3 ? "md:grid-cols-3" : "sm:grid-cols-2";
  const quoteSize = row ? "clamp(1.05rem, 1.6vw, 1.25rem)" : "clamp(1.4rem, 3vw, 2rem)";

  return (
    <section
      className="pf-block pf-testimonial-quote w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <ul
        className={
          row
            ? `mx-auto m-0 grid w-full max-w-6xl list-none grid-cols-1 items-stretch p-0 ${cols}`
            : "mx-auto m-0 flex w-full max-w-3xl list-none flex-col p-0"
        }
        style={{ gap: "calc(var(--pf-space) * 2)" }}
      >
        {quotes.map((quote) => (
          <li key={quote.autor}>
            <figure
              className="m-0 flex h-full flex-col"
              style={{
                gap: "calc(var(--pf-space) * 1.25)",
                padding: row ? "calc(var(--pf-space) * 2)" : "0",
                borderRadius: "var(--pf-radius)",
                border: row ? "1px solid var(--pf-muted)" : "none",
                boxShadow: row ? "var(--pf-shadow)" : "none",
                backgroundColor: "var(--pf-bg)",
                textAlign: row ? "left" : "center",
                alignItems: row ? "flex-start" : "center",
              }}
            >
              <span aria-hidden="true" style={{ fontFamily: "var(--pf-font-display)", fontSize: "3rem", lineHeight: 0.6, color: "var(--pf-accent)" }}>
                “
              </span>
              <blockquote
                className="m-0"
                style={{ fontFamily: "var(--pf-font-display)", fontSize: quoteSize, lineHeight: 1.35, fontWeight: 600, maxWidth: row ? "none" : "40ch" }}
              >
                {quote.texto}
              </blockquote>
              <figcaption style={{ marginTop: "auto" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: "1rem", color: "var(--pf-fg)" }}>{quote.autor}</span>
                {quote.cargo && (
                  <cite className="not-italic" style={{ display: "block", fontSize: "0.9rem", color: "var(--pf-muted)" }}>
                    {quote.cargo}
                  </cite>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
