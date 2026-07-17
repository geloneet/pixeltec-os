/**
 * PageRenderer — materializa un `ValidatedPageTree` (ya validado por
 * `validatePageTree`, T4 — aquí se CONFÍA en él, no se re-valida) en el DOM
 * real de la landing. Es server-safe salvo por los blocks/boundary que se
 * declaran client donde toque.
 *
 * Contrato:
 *  - Ordena los nodos por `orden` (el árbol validado garantiza `orden` únicos).
 *  - Aplica las vars `--pf-*` de la dirección elegida como `style` del wrapper
 *    raíz (`<div className="pf-page">`): TODO block hereda los tokens de ahí.
 *  - Resuelve cada nodo vía `RENDER_MAP[componentId]` y lo envuelve en un
 *    `SectionErrorBoundary` propio, de modo que una sección que lance no tumba
 *    la landing entera.
 *  - Pasa al componente `{...props, variant}` — `props` ya vienen parseadas y
 *    validadas contra `def.propsSchema`.
 *  - Un `componentId` sin componente en `RENDER_MAP` (block aún no implementado,
 *    llega en T6) degrada a un placeholder neutro, no a un crash.
 */
import type { CSSProperties } from "react";
import type { ValidatedPageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import { directionTokensToCssVars, type DesignTokens } from "./tokens";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { RENDER_MAP } from "./blocks";

interface PageRendererProps {
  tree: ValidatedPageTree;
  tokens: DesignTokens;
}

export function PageRenderer({ tree, tokens }: PageRendererProps) {
  const cssVars = directionTokensToCssVars(tokens) as CSSProperties;
  const nodes = [...tree.nodes].sort((a, b) => a.orden - b.orden);

  return (
    <div className="pf-page" style={cssVars}>
      {nodes.map((node) => {
        const Block = RENDER_MAP[node.componentId];
        return (
          <SectionErrorBoundary key={node.nodeId} componentId={node.componentId}>
            {Block ? (
              <Block {...(node.props as Record<string, unknown>)} variant={node.variant} />
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
        );
      })}
    </div>
  );
}
