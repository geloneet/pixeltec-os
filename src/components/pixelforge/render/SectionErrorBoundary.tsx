"use client";

/**
 * SectionErrorBoundary — primer error boundary del repo. Aísla el render de
 * CADA sección de la landing: si un block lanza al renderizar (props raras que
 * pasaron validación, un edge de un componente futuro, etc.), la landing NO se
 * cae entera — esa sección se reemplaza por una tarjeta neutra y el resto sigue
 * vivo. Class component porque React sólo soporta `getDerivedStateFromError` /
 * `componentDidCatch` en clases (no hay equivalente en hooks).
 *
 * La tarjeta de fallback usa vars `--pf-*` (coherente con el resto del render)
 * y nombra el `componentId` para que el equipo sepa qué sección falló.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  componentId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[PixelForge] Falló el render de la sección "${this.props.componentId}":`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          className="pf-block pf-section-error w-full"
          style={{
            backgroundColor: "var(--pf-bg)",
            color: "var(--pf-fg)",
            fontFamily: "var(--pf-font-body)",
            paddingBlock: "calc(var(--pf-space) * 3)",
            paddingInline: "calc(var(--pf-space) * 2)",
          }}
        >
          <div
            className="mx-auto w-full max-w-3xl text-center"
            style={{
              padding: "calc(var(--pf-space) * 2)",
              borderRadius: "var(--pf-radius)",
              border: "1px dashed var(--pf-muted)",
              color: "var(--pf-muted)",
            }}
          >
            Esta sección no se pudo renderizar ({this.props.componentId}).
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}
