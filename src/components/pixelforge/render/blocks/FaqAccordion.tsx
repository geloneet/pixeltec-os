/**
 * FaqAccordion — preguntas frecuentes en acordeón. Reusa el `Accordion` de
 * shadcn (Radix) que ya trae teclado accesible (foco, Enter/Space, flechas) y
 * el patrón ARIA correcto — no se reimplementa. Como shadcn trae clases de la
 * paleta admin, cada trigger/contenido/borde se re-colorea con `style` inline
 * a `--pf-*` (el inline gana al utility class).
 *
 * El `variant` cambia la composición:
 *  - `single`: un acordeón a una columna.
 *  - `two-column`: los items se reparten en dos acordeones independientes lado
 *    a lado (cada columna colapsa por su cuenta) — útil para 6-8 preguntas.
 *
 * `type="single" collapsible` (un panel abierto a la vez por columna). Cada
 * item necesita un `value` único → se deriva de su posición global.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface FaqItem {
  pregunta: string;
  respuesta: string;
}

export interface FaqAccordionProps {
  titulo: string;
  items: FaqItem[];
  /** "single" (default) | "two-column". */
  variant: string;
}

function FaqColumn({ items, offset }: { items: FaqItem[]; offset: number }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item, index) => (
        <AccordionItem key={item.pregunta} value={`faq-${offset + index}`} style={{ borderColor: "var(--pf-muted)" }}>
          <AccordionTrigger
            style={{
              fontFamily: "var(--pf-font-display)",
              fontSize: "clamp(1rem, 1.6vw, 1.15rem)",
              fontWeight: 600,
              color: "var(--pf-fg)",
              paddingBlock: "calc(var(--pf-space) * 1.25)",
              textAlign: "left",
            }}
          >
            {item.pregunta}
          </AccordionTrigger>
          <AccordionContent style={{ fontSize: "1rem", lineHeight: 1.65, color: "var(--pf-muted)" }}>
            {item.respuesta}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function FaqAccordion({ titulo, items, variant }: FaqAccordionProps) {
  const twoColumn = variant === "two-column";
  const mid = Math.ceil(items.length / 2);
  const left = twoColumn ? items.slice(0, mid) : items;
  const right = twoColumn ? items.slice(mid) : [];

  return (
    <section
      className="pf-block pf-faq-accordion w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div className="mx-auto w-full max-w-4xl">
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

        <div
          className={twoColumn ? "grid grid-cols-1 md:grid-cols-2" : ""}
          style={{ marginTop: "calc(var(--pf-space) * 2.5)", columnGap: "calc(var(--pf-space) * 3)" }}
        >
          <FaqColumn items={left} offset={0} />
          {twoColumn && right.length > 0 && <FaqColumn items={right} offset={mid} />}
        </div>
      </div>
    </section>
  );
}
