/**
 * OfferTiers — 2-3 planes/paquetes. El `variant` cambia por completo la
 * composición:
 *  - `cards`: tarjetas lado a lado; el tier `destacado` se eleva (borde de
 *    acento, badge "Recomendado", sombra) y toma el foco visual.
 *  - `table`: tabla comparativa (usa el `Table` de shadcn) con una COLUMNA por
 *    tier — encabezado con el nombre, filas de precio, beneficios y CTA.
 *
 * Nota de accesibilidad/color: el `Table` de shadcn trae clases de la paleta
 * admin (`text-muted-foreground`, `bg-muted`, bordes del tema). Como los blocks
 * consumen SOLO `--pf-*`, aquí se sobreescriben esos colores con `style` inline
 * en cada celda/encabezado (el inline gana al utility class).
 *
 * El schema de un tier trae `ctaLabel` pero NO href (la acción se cableará en
 * F6C/capabilities), así que el CTA se rinde como `<button type="button">`
 * semánticamente honesto, no como un link a ninguna parte.
 */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Tier {
  nombre: string;
  precio: string;
  periodo?: string;
  bullets: string[];
  destacado?: boolean;
  ctaLabel: string;
}

export interface OfferTiersProps {
  titulo: string;
  tiers: Tier[];
  /** "cards" (default) | "table". */
  variant: string;
}

function CtaButton({ label, destacado }: { label: string; destacado?: boolean }) {
  return (
    <button
      type="button"
      className="inline-flex w-full items-center justify-center px-5 py-3 font-semibold transition-[transform,opacity] duration-200 hover:-translate-y-0.5 hover:opacity-90"
      style={{
        backgroundColor: destacado ? "var(--pf-primary)" : "var(--pf-bg)",
        color: destacado ? "var(--pf-on-primary)" : "var(--pf-primary)",
        border: "1px solid var(--pf-primary)",
        borderRadius: "var(--pf-radius)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function OfferTiers({ titulo, tiers, variant }: OfferTiersProps) {
  const isTable = variant === "table";
  const cols = tiers.length >= 3 ? "md:grid-cols-3" : "sm:grid-cols-2";

  return (
    <section
      className="pf-block pf-offer-tiers w-full"
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
          className="m-0 text-center"
          style={{
            fontFamily: "var(--pf-font-display)",
            fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            fontWeight: 700,
          }}
        >
          {titulo}
        </h2>

        {isTable ? (
          <div style={{ marginTop: "calc(var(--pf-space) * 3)" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "var(--pf-muted)" }}>
                  <TableHead style={{ color: "var(--pf-muted)", width: "1%" }} />
                  {tiers.map((tier) => (
                    <TableHead
                      key={tier.nombre}
                      scope="col"
                      className="text-center"
                      style={{
                        color: "var(--pf-fg)",
                        fontFamily: "var(--pf-font-display)",
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        verticalAlign: "bottom",
                      }}
                    >
                      {tier.nombre}
                      {tier.destacado && (
                        <span
                          className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase"
                          style={{ backgroundColor: "var(--pf-accent)", color: "var(--pf-on-primary)", borderRadius: "999px", letterSpacing: "0.06em" }}
                        >
                          Recomendado
                        </span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow style={{ borderColor: "var(--pf-muted)" }}>
                  <TableHead scope="row" style={{ color: "var(--pf-muted)", fontWeight: 600 }}>
                    Precio
                  </TableHead>
                  {tiers.map((tier) => (
                    <TableCell key={tier.nombre} className="text-center" style={{ color: "var(--pf-fg)" }}>
                      <span style={{ fontFamily: "var(--pf-font-display)", fontSize: "1.6rem", fontWeight: 700 }}>{tier.precio}</span>
                      {tier.periodo && <span style={{ color: "var(--pf-muted)", fontSize: "0.9rem" }}> {tier.periodo}</span>}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow style={{ borderColor: "var(--pf-muted)" }}>
                  <TableHead scope="row" style={{ color: "var(--pf-muted)", fontWeight: 600, verticalAlign: "top" }}>
                    Incluye
                  </TableHead>
                  {tiers.map((tier) => (
                    <TableCell key={tier.nombre} style={{ verticalAlign: "top" }}>
                      <ul className="m-0 list-none p-0" style={{ display: "flex", flexDirection: "column", gap: "calc(var(--pf-space) * 0.5)" }}>
                        {tier.bullets.map((bullet) => (
                          <li key={bullet} style={{ display: "flex", gap: "0.5rem", fontSize: "0.95rem", lineHeight: 1.5, color: "var(--pf-fg)" }}>
                            <span aria-hidden="true" style={{ color: "var(--pf-accent)", fontWeight: 700 }}>
                              ✓
                            </span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow style={{ borderColor: "transparent" }}>
                  <TableCell style={{ borderColor: "transparent" }} />
                  {tiers.map((tier) => (
                    <TableCell key={tier.nombre} className="text-center" style={{ borderColor: "transparent" }}>
                      <CtaButton label={tier.ctaLabel} destacado={tier.destacado} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <ul
            className={`m-0 grid list-none grid-cols-1 items-stretch p-0 ${cols}`}
            style={{ gap: "calc(var(--pf-space) * 1.5)", marginTop: "calc(var(--pf-space) * 3)" }}
          >
            {tiers.map((tier) => (
              <li
                key={tier.nombre}
                className="flex flex-col"
                style={{
                  gap: "calc(var(--pf-space) * 1.25)",
                  padding: "calc(var(--pf-space) * 2)",
                  borderRadius: "var(--pf-radius)",
                  boxShadow: tier.destacado ? "var(--pf-shadow)" : "none",
                  border: tier.destacado ? "2px solid var(--pf-primary)" : "1px solid var(--pf-muted)",
                  backgroundColor: "var(--pf-bg)",
                  position: "relative",
                }}
              >
                {tier.destacado && (
                  <span
                    className="absolute inline-flex items-center px-3 py-1 text-xs font-semibold uppercase"
                    style={{
                      top: "0",
                      right: "calc(var(--pf-space) * 1.5)",
                      transform: "translateY(-50%)",
                      backgroundColor: "var(--pf-accent)",
                      color: "var(--pf-on-primary)",
                      borderRadius: "999px",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Recomendado
                  </span>
                )}
                <h3 className="m-0" style={{ fontFamily: "var(--pf-font-display)", fontSize: "1.35rem", fontWeight: 700 }}>
                  {tier.nombre}
                </h3>
                <p className="m-0" style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
                  <span style={{ fontFamily: "var(--pf-font-display)", fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: 700, lineHeight: 1 }}>
                    {tier.precio}
                  </span>
                  {tier.periodo && <span style={{ color: "var(--pf-muted)", fontSize: "0.95rem" }}>{tier.periodo}</span>}
                </p>
                <ul className="m-0 list-none p-0" style={{ display: "flex", flexDirection: "column", gap: "calc(var(--pf-space) * 0.75)" }}>
                  {tier.bullets.map((bullet) => (
                    <li key={bullet} style={{ display: "flex", gap: "0.6rem", fontSize: "1rem", lineHeight: 1.5, color: "var(--pf-fg)" }}>
                      <span aria-hidden="true" style={{ color: "var(--pf-accent)", fontWeight: 700 }}>
                        ✓
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: "auto", paddingTop: "calc(var(--pf-space) * 0.75)" }}>
                  <CtaButton label={tier.ctaLabel} destacado={tier.destacado} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
