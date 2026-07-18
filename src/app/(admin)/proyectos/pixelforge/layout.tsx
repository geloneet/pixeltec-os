import type { ReactNode } from "react";
import { IBM_Plex_Mono } from "next/font/google";
import "./pixelforge-theme.css";

/**
 * Layout de scoping visual del módulo PixelForge (PF-X1 T1).
 *
 * Envuelve TODAS las rutas del módulo (listado, nueva, [id]/* incluyendo el
 * stepper y cada estación) en un único `<div data-product="pixelforge">`.
 * Ese atributo es el ancla de cascada que activa los tokens `--pfx-*`
 * definidos en `./pixelforge-theme.css` (bloque base = valores LIGHT,
 * `.dark [data-product="pixelforge"]` = valores DARK) — el tema global
 * (`next-themes`, clase `.dark` en `<html>`) sigue siendo quien decide qué
 * variante aplica; este layout solo abre el namespace.
 *
 * Usamos `--pfx-*` (no `--pf-*`) porque `--pf-*` está reservado al render de
 * landings embebido (vive en un iframe, documento aparte, sin colisión de
 * cascada posible) — mezclar ambos namespaces en el mismo árbol del admin
 * sería ambiguo y frágil ante cambios futuros en cualquiera de los dos
 * sistemas. `--pfx-*` es exclusivamente para la interfaz de administración
 * de PixelForge (este módulo).
 *
 * IMPORTANTE: este layout, por sí solo, NO cambia nada visualmente. No
 * consume ningún token `--pfx-*` (sin `bg-pfx-canvas`, sin `text-pfx-text`,
 * sin `font-forge-mono` aplicado aquí) — solo abre el scope y carga la
 * fuente. Las páginas y el layout de `[id]/*` siguen renderizando su propio
 * markup sin cambios hasta que las tareas siguientes (T2+) empiecen a
 * consumir los tokens.
 *
 * La tipografía de forja (IBM Plex Mono, pesos 400/500) se carga aquí vía
 * `next/font/google`, SOLO para este módulo — no se importa en el layout
 * global (`src/app/layout.tsx`) porque el resto del admin no la usa. La
 * variable CSS que genera (`--pfx-font-mono-src`) alimenta a
 * `--pfx-font-mono` en `pixelforge-theme.css`, que a su vez expone el
 * fallback `ui-monospace, monospace` para el intervalo de carga (`swap`).
 */

const forgeMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--pfx-font-mono-src",
  display: "swap",
});

export default function PixelforgeModuleLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div data-product="pixelforge" className={forgeMono.variable}>
      {children}
    </div>
  );
}
