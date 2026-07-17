/**
 * HeroSplit — hero de apertura, texto a un lado y una superficie de media al
 * otro. Es (junto con los otros 3 núcleo) la primera impresión de toda landing
 * PixelForge: la composición es asimétrica (columna de texto más ancha), la
 * jerarquía tipográfica es real (display fluido en el h1, body en el resto) y
 * TODO color/forma sale de vars `--pf-*` — cero paleta admin.
 *
 * Convención de autoría de blocks (a imitar en T6): layout/responsive con
 * clases Tailwind; propiedades gobernadas por tokens (color, radio, sombra,
 * ritmo de espaciado, familia tipográfica) con `style` + `var(--pf-*)`, para
 * que la lectura de tokens viva en un solo lugar por elemento.
 *
 * F6A no aporta URL de imagen: la media es una superficie de marca con
 * `role="img"` + `aria-label={mediaAlt}` (accesible, sin `<img>` vacío). El
 * `variant` sólo recompone qué lado ocupa la media, nunca cambia la semántica
 * (un único `<h1>`).
 */
export interface HeroSplitProps {
  titulo: string;
  subtitulo: string;
  cta: { label: string; href: string };
  mediaAlt: string;
  badges?: string[];
  /** "media-right" (default) | "media-left". */
  variant: string;
}

export function HeroSplit({ titulo, subtitulo, cta, mediaAlt, badges, variant }: HeroSplitProps) {
  const mediaLeft = variant === "media-left";
  const cols = mediaLeft ? "md:grid-cols-[0.9fr_1.1fr]" : "md:grid-cols-[1.1fr_0.9fr]";

  return (
    <section
      className="pf-block pf-hero-split w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div className={`mx-auto grid w-full max-w-6xl grid-cols-1 items-center ${cols}`} style={{ gap: "calc(var(--pf-space) * 3)" }}>
        <div
          className={mediaLeft ? "order-1 md:order-2" : "order-1"}
          style={{ display: "flex", flexDirection: "column", gap: "calc(var(--pf-space) * 1.25)" }}
        >
          {badges && badges.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap p-0" style={{ gap: "calc(var(--pf-space) * 0.75)" }}>
              {badges.slice(0, 3).map((badge) => (
                <li
                  key={badge}
                  className="inline-flex items-center px-3 py-1 text-sm font-medium"
                  style={{ borderRadius: "999px", border: "1px solid var(--pf-muted)", color: "var(--pf-fg)" }}
                >
                  {badge}
                </li>
              ))}
            </ul>
          )}
          <h1
            className="m-0"
            style={{
              fontFamily: "var(--pf-font-display)",
              fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 700,
            }}
          >
            {titulo}
          </h1>
          <p className="m-0" style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.3rem)", lineHeight: 1.6, color: "var(--pf-muted)", maxWidth: "44ch" }}>
            {subtitulo}
          </p>
          <div>
            <a
              href={cta.href}
              className="inline-flex items-center justify-center px-6 py-3 font-semibold no-underline transition-[transform,opacity] duration-200 hover:-translate-y-0.5 hover:opacity-90"
              style={{
                backgroundColor: "var(--pf-primary)",
                color: "var(--pf-on-primary)",
                borderRadius: "var(--pf-radius)",
                boxShadow: "var(--pf-shadow)",
              }}
            >
              {cta.label}
            </a>
          </div>
        </div>

        <div className={mediaLeft ? "order-2 md:order-1" : "order-2"}>
          <div
            role="img"
            aria-label={mediaAlt}
            style={{
              width: "100%",
              aspectRatio: "4 / 3",
              borderRadius: "var(--pf-radius)",
              boxShadow: "var(--pf-shadow)",
              background: "linear-gradient(135deg, var(--pf-primary), var(--pf-accent))",
            }}
          />
        </div>
      </div>
    </section>
  );
}
