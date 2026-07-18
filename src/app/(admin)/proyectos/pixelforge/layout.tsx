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
 * A partir de T4 el wrapper también PINTA el lienzo del módulo: `bg-pfx-canvas`
 * (carbón azulado en dark / papel cálido en light) + `text-pfx-text` como color
 * base, con `min-h-screen` para que el canvas cubra toda la altura del módulo
 * (no solo el alto del contenido). El fondo del shell global queda tapado
 * DENTRO del wrapper, sin tocar nada fuera de él.
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
    <div
      data-product="pixelforge"
      className={`${forgeMono.variable} min-h-screen bg-pfx-canvas text-pfx-text`}
    >
      {children}
    </div>
  );
}
