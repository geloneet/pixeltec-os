/**
 * FooterContact — cierre de la landing: datos de la empresa, contacto y hasta
 * 6 links secundarios. `<footer>` con dos columnas (empresa/dirección vs.
 * contacto + links) y una franja inferior de copyright. Los `href` de `links`
 * ya vienen validados como seguros por `validatePageTree`; los de teléfono y
 * email los construye ESTE componente (`tel:` / `mailto:`), no la IA.
 */
export interface FooterContactProps {
  empresa: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  links?: { label: string; href: string }[];
  /** "default". */
  variant: string;
}

export function FooterContact({ empresa, telefono, email, direccion, links }: FooterContactProps) {
  const year = new Date().getFullYear();
  const secondaryStyle = { fontSize: "0.95rem", lineHeight: 1.6, color: "var(--pf-muted)" } as const;

  return (
    <footer
      className="pf-block pf-footer-contact w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        borderTop: "1px solid var(--pf-muted)",
        paddingBlock: "calc(var(--pf-space) * 4)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div
        className="mx-auto grid w-full max-w-6xl grid-cols-1 md:grid-cols-[1.2fr_1fr]"
        style={{ gap: "calc(var(--pf-space) * 2)" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--pf-space) * 0.5)" }}>
          <p className="m-0" style={{ fontFamily: "var(--pf-font-display)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
            {empresa}
          </p>
          {direccion && (
            <address className="m-0 not-italic" style={secondaryStyle}>
              {direccion}
            </address>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--pf-space) * 0.75)" }}>
          {(telefono || email) && (
            <ul className="m-0 flex list-none flex-col p-0" style={{ gap: "calc(var(--pf-space) * 0.25)" }}>
              {telefono && (
                <li>
                  <a href={`tel:${telefono.replace(/[^+\d]/g, "")}`} className="no-underline hover:underline" style={secondaryStyle}>
                    {telefono}
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="no-underline hover:underline" style={secondaryStyle}>
                    {email}
                  </a>
                </li>
              )}
            </ul>
          )}
          {links && links.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap p-0" style={{ gap: "calc(var(--pf-space) * 1)" }}>
              {links.slice(0, 6).map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <a href={link.href} className="no-underline hover:underline" style={secondaryStyle}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-6xl"
        style={{
          marginTop: "calc(var(--pf-space) * 2)",
          paddingTop: "calc(var(--pf-space) * 1.5)",
          borderTop: "1px solid var(--pf-muted)",
          fontSize: "0.85rem",
          color: "var(--pf-muted)",
        }}
      >
        © {year} {empresa}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
