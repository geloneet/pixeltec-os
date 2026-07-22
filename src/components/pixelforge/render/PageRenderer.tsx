/**
 * PageRenderer — materializa un `ValidatedPageTree` (ya validado por
 * `validatePageTree`, T4 — aquí se CONFÍA en él, no se re-valida) en el DOM
 * real de la landing. Es server-safe salvo por los blocks/boundary que se
 * declaran client donde toque.
 *
 * Contrato:
 *  - Ordena los nodos por `orden` (el árbol validado garantiza `orden` únicos
 *    entre blocks y capabilities, mismo espacio de numeración).
 *  - Aplica las vars `--pf-*` de la dirección elegida como `style` del wrapper
 *    raíz (`<div className="pf-page">`): TODO nodo hereda los tokens de ahí.
 *  - Resuelve cada nodo por `node.kind` (F6C-T2/T5): `"block"` →
 *    `RENDER_MAP[componentId]`, `"capability"` →
 *    `CAPABILITY_RENDER_MAP[componentId]`. Cada nodo se envuelve en un
 *    `SectionErrorBoundary` propio, de modo que una sección que lance no tumba
 *    la landing entera.
 *  - Blocks reciben `{...props, variant}`. Las capabilities NO tienen variant
 *    visual en v1 (D1: `validatePageTree` ya fuerza `variant === "default"`
 *    para ellas) y sus componentes no lo declaran en sus props — reciben solo
 *    `{...props}`.
 *  - Un nodo `kind: "capability"` NUNCA se envuelve en `MotionSection`, aunque
 *    trajera `choreography`: `validatePageTree` ya rechaza choreography sobre
 *    capabilities (D1 — el mismo nodo no combina interactividad + motion, ver
 *    docstring de `validate-page-tree.ts`), pero el renderer no depende SOLO
 *    de esa garantía aguas arriba — bifurca explícitamente por `kind` antes de
 *    decidir si envuelve en motion, así que un nodo capability jamás activa
 *    esa rama sin importar qué traiga en `choreography`.
 *  - Un `componentId` sin componente en el mapa correspondiente (block o
 *    capability aún no implementado, o id fuera de catálogo) degrada a un
 *    placeholder neutro, no a un crash.
 *  - Cada nodo (block o capability, resuelto o placeholder) queda envuelto en
 *    un `<div data-pf-node={nodeId} data-pf-component={componentId}>` (PF-F8
 *    T3): superficie DOM ADITIVA que el qa-runner (T6, Playwright) usa para
 *    localizar secciones — no toca estructura/clases/orden del contenido que
 *    ya se renderizaba dentro.
 */
import type { CSSProperties } from "react";
import type { ValidatedPageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import { directionTokensToCssVars, type DesignTokens } from "./tokens";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { MotionSection } from "./motion/MotionSection";
import type { MotionDnaInput } from "./motion/resolve";
import { RENDER_MAP } from "./blocks";
import { CAPABILITY_RENDER_MAP } from "./capabilities";

interface PageRendererProps {
  tree: ValidatedPageTree;
  tokens: DesignTokens;
  /**
   * Motion DNA de la dirección elegida (F6B). Modula duración/easing/stagger
   * del motion. Opcional: sin él, MotionSection usa los defaults del resolver.
   */
  motionDna?: MotionDnaInput;
}

export function PageRenderer({ tree, tokens, motionDna }: PageRendererProps) {
  const cssVars = directionTokensToCssVars(tokens) as CSSProperties;
  const nodes = [...tree.nodes].sort((a, b) => a.orden - b.orden);

  return (
    <div className="pf-page" style={cssVars}>
      {nodes.map((node) => {
        // Bifurca por `kind`, no por presencia/ausencia en un único mapa: un
        // nodo capability nunca consulta RENDER_MAP ni pasa por la rama de
        // MotionSection, sin importar qué traiga `choreography` — la garantía
        // de "capabilities sin motion" no descansa solo en `validatePageTree`.
        const block =
          node.kind === "capability"
            ? (() => {
                const Capability = CAPABILITY_RENDER_MAP[node.componentId];
                // Las capabilities no declaran `variant` (D1: siempre
                // "default" en v1) — solo se pasan las props parseadas.
                return Capability ? <Capability {...(node.props as Record<string, unknown>)} /> : null;
              })()
            : (() => {
                const Block = RENDER_MAP[node.componentId];
                if (!Block) return null;
                // Un nodo CON coreografía se envuelve en MotionSection (dentro
                // del boundary, para que un fallo de motion tampoco tumbe la
                // landing); un nodo SIN coreografía renderiza el block directo
                // — cero coste de JS de motion en secciones que no animan.
                return node.choreography ? (
                  <MotionSection nodeId={node.nodeId} choreography={node.choreography} motionDna={motionDna}>
                    <Block {...(node.props as Record<string, unknown>)} variant={node.variant} />
                  </MotionSection>
                ) : (
                  <Block {...(node.props as Record<string, unknown>)} variant={node.variant} />
                );
              })();
        return (
          // Wrapper ADITIVO por nodo (PF-F8 T3): `data-pf-node`/
          // `data-pf-component` son la superficie DOM que el qa-runner
          // (T6, Playwright) usa para localizar secciones — no cambia
          // estructura/clases/orden de lo que ya renderizaba cada nodo,
          // solo añade este contenedor con los dos atributos.
          <div key={node.nodeId} data-pf-node={node.nodeId} data-pf-component={node.componentId}>
            <SectionErrorBoundary componentId={node.componentId}>
              {block ? (
                block
              ) : (
                <section
                  className="pf-block pf-block-missing w-full"
                  style={{
                    backgroundColor: "var(--pf-bg)",
                    color: "var(--pf-muted)",
                    fontFamily: "var(--pf-font-body)",
                    paddingBlock: "calc(var(--pf-space) * 2)",
                    paddingInline: "calc(var(--pf-space) * 2)",
                  }}
                >
                  <div
                    className="mx-auto w-full max-w-3xl text-center"
                    style={{ padding: "calc(var(--pf-space) * 1.5)", borderRadius: "var(--pf-radius)", border: "1px dashed var(--pf-muted)" }}
                  >
                    Componente “{node.componentId}” aún no disponible.
                  </div>
                </section>
              )}
            </SectionErrorBoundary>
          </div>
        );
      })}
    </div>
  );
}
