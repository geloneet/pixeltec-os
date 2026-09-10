// animated-menu.tsx
"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const STAGGER = 0.025;

/**
 * Enlace cuyo texto se desliza letra a letra al pasar el ratón.
 *
 * A11Y-01 (WO-2026-00268): el efecto necesita DOS copias del texto, y ambas
 * eran contenido accesible — un lector de pantalla leía «NosotrosNosotros» en
 * cada elemento del menú. Además los contenedores eran `<div>` dentro de un
 * `<span>`, HTML inválido (flujo dentro de contenido en línea) que el
 * navegador reacomoda de forma impredecible. Ahora: las dos capas son `<span>`
 * decorativos con `aria-hidden`, y el nombre accesible lo da un único
 * `sr-only`. Con `prefers-reduced-motion` no se duplica nada: se pinta el
 * texto y ya.
 */
export const AnimatedTextLink: React.FC<{
  children: string;
  className?: string;
  center?: boolean;
}> = ({ children, className, center = false }) => {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={cn("relative block", className)}>{children}</span>;
  }

  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      className={cn("relative block overflow-hidden cursor-pointer", className)}
      style={{
        lineHeight: 1.2,
      }}
    >
      {/* El único texto que existe para lectores de pantalla y buscadores. */}
      <span className="sr-only">{children}</span>

      {/* Top Text (Slides up) */}
      <span aria-hidden="true" className="flex">
        {children.split("").map((l, i) => {
          const delay = center
            ? STAGGER * Math.abs(i - (children.length - 1) / 2)
            : STAGGER * i;

          return (
            <motion.span
              variants={{
                initial: { y: 0 },
                hovered: { y: "-100%" },
              }}
              transition={{ ease: "easeInOut", delay }}
              className="inline-block whitespace-pre"
              key={i}
            >
              {l}
            </motion.span>
          );
        })}
      </span>

      {/* Bottom Text (Slides in from bottom) */}
      <span aria-hidden="true" className="absolute inset-0 flex text-brand-blue">
        {children.split("").map((l, i) => {
          const delay = center
            ? STAGGER * Math.abs(i - (children.length - 1) / 2)
            : STAGGER * i;

          return (
            <motion.span
              variants={{
                initial: { y: "100%" },
                hovered: { y: 0 },
              }}
              transition={{ ease: "easeInOut", delay }}
              className="inline-block whitespace-pre"
              key={i}
            >
              {l}
            </motion.span>
          );
        })}
      </span>
    </motion.span>
  );
};
