/**
 * CtaBanner — franja de conversión (cierre o intermedia). Fondo de marca a
 * todo el ancho, contenido centrado y un único CTA prominente. Usa `<h2>` (el
 * `<h1>` es del hero) y jamás inventa media. El `variant` cambia sólo el
 * tratamiento del fondo: `solid` (primary plano) o `gradient` (primary→accent).
 *
 * Sobre superficie de marca el texto usa `--pf-on-primary` y el botón invierte
 * (fondo claro `--pf-bg`, texto `--pf-primary`) para máximo contraste.
 */
export interface CtaBannerProps {
  titulo: string;
  subtitulo?: string;
  cta: { label: string; href: string };
  /** "solid" (default) | "gradient". */
  variant: string;
}

export function CtaBanner({ titulo, subtitulo, cta, variant }: CtaBannerProps) {
  const background =
    variant === "gradient"
      ? "linear-gradient(135deg, var(--pf-primary), var(--pf-accent))"
      : "var(--pf-primary)";

  return (
    <section
      className="pf-block pf-cta-banner w-full"
      style={{
        background,
        color: "var(--pf-on-primary)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-3xl flex-col items-center text-center"
        style={{ gap: "calc(var(--pf-space) * 1.5)" }}
      >
        <h2
          className="m-0"
          style={{
            fontFamily: "var(--pf-font-display)",
            fontSize: "clamp(1.9rem, 4vw, 3rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            fontWeight: 700,
          }}
        >
          {titulo}
        </h2>
        {subtitulo && (
          <p className="m-0" style={{ fontSize: "clamp(1rem, 1.5vw, 1.25rem)", lineHeight: 1.6, opacity: 0.92, maxWidth: "50ch" }}>
            {subtitulo}
          </p>
        )}
        <a
          href={cta.href}
          className="inline-flex items-center justify-center px-7 py-3 font-semibold no-underline transition-[transform,opacity] duration-200 hover:-translate-y-0.5 hover:opacity-90"
          style={{
            backgroundColor: "var(--pf-bg)",
            color: "var(--pf-primary)",
            borderRadius: "var(--pf-radius)",
            boxShadow: "var(--pf-shadow)",
          }}
        >
          {cta.label}
        </a>
      </div>
    </section>
  );
}
