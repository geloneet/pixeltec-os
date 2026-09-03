"use client"

import type React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  /** Con destino se renderiza un <a>, no un <button>: evita el anidamiento
   *  inválido <Link><button> en los CTA que navegan. */
  href?: string
  /** Solo para destinos externos; conserva el comportamiento de apertura del consumidor. */
  target?: string
  rel?: string
  /**
   * WO-2026-00214 — marca el botón como CTA medible por el tracker de
   * contenido. Van explícitos y no vía `{...props}` porque las dos ramas con
   * `href` renderizan `<a>`/`<Link>` y NO derraman props: sin esto, un
   * `data-cta` puesto por el consumidor se perdería en silencio, que es la
   * peor forma de fallo posible para instrumentación.
   */
  "data-cta"?: string
  "data-cta-pos"?: string
}

const SHINY_CLASSES =
  "shiny-cta tracking-wide transition-all duration-300 ease-out shadow-md hover:shadow-lg dark:shadow-none hover:text-blue-300 dark:hover:shadow-[0_0_20px_rgba(33,150,243,0.2)] active:scale-95 active:shadow-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"

export function ShinyButton({
  children,
  className = "",
  href,
  target,
  rel,
  "data-cta": dataCta,
  "data-cta-pos": dataCtaPos,
  ...props
}: ShinyButtonProps) {
  const isExternal = Boolean(href && /^https?:\/\//.test(href));

  return (
    <>
      {/* global: styled-jsx solo aplica sus clases con ámbito a elementos DOM
          directos; la variante <Link> renderiza su propio <a> y se quedaba sin
          estilos. Los selectores .shiny-cta son suficientemente específicos. */}
      <style jsx global>{`
        /* Composited rotation via transform instead of @property --gradient-angle */
        @keyframes shiny-rotate {
          to { transform: rotate(360deg); }
        }

        .shiny-cta {
          /* Identidad de marca intencional: pill negro/blanco en AMBOS temas
             (no se invierte con background/foreground para no perder el CTA
             de alto contraste que WhatsApp necesita). */
          --shiny-cta-bg: #000000;
          --shiny-cta-fg: #ffffff;
          --shiny-cta-highlight: #2196F3;
          --duration: 3s;

          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          isolation: isolate;
          cursor: pointer;
          outline-offset: 4px;
          padding: 1rem 2rem;
          font-size: 1rem;
          line-height: 1.2;
          font-weight: 700;
          /* Light: borde definido (oscuro suave) para que el pill negro no
             se vea "flotando" sin contorno sobre el fondo claro. */
          border: 1px solid hsl(var(--foreground) / 0.12);
          border-radius: 360px;
          color: var(--shiny-cta-fg);
          background: transparent;
        }

        :global(.dark) .shiny-cta {
          /* Dark: como hoy, sin borde propio (el glow hace ese trabajo). */
          border-color: transparent;
        }

        /* Rotating gradient layer — uses transform:rotate() which is GPU-composited */
        .shiny-cta::before {
          content: '';
          position: absolute;
          width: 400px;
          height: 400px;
          top: 50%;
          left: 50%;
          margin-top: -200px;
          margin-left: -200px;
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            var(--shiny-cta-highlight) 5%,
            white 10%,
            var(--shiny-cta-highlight) 15%,
            transparent 20%
          );
          animation: shiny-rotate var(--duration) linear infinite;
          z-index: -2;
          /* El shine rotante fuerte queda solo para dark (ver .dark abajo);
             en light se reemplaza por shadow-md + borde definido. */
          opacity: 0;
        }

        :global(.dark) .shiny-cta::before {
          opacity: 1;
        }

        /* Solid fill layer — creates the 1px "border" gap */
        .shiny-cta::after {
          content: '';
          position: absolute;
          inset: 1px;
          background: var(--shiny-cta-bg);
          border-radius: 360px;
          z-index: -1;
          transition: background 0.3s ease;
        }

        .shiny-cta:hover::after {
          background: rgb(33 150 243 / 0.08);
        }

        .shiny-cta > span {
          position: relative;
          z-index: 1;
          letter-spacing: 0.05em;
        }

        /* Reducción de movimiento acotada: detiene SOLO el shine rotante
           infinito. El hover, el focus, el active y las transiciones de
           estado siguen dando feedback. */
        @media (prefers-reduced-motion: reduce) {
          .shiny-cta::before {
            animation: none;
          }
        }
      `}</style>

      {href ? (
        // Externo: <a> nativo conservando target/rel del consumidor.
        // Interno: <Link> de Next. En ambos casos se evita <a><button>.
        isExternal ? (
          <a
            href={href}
            target={target}
            rel={rel}
            data-cta={dataCta}
            data-cta-pos={dataCtaPos}
            onClick={props.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
            className={cn(SHINY_CLASSES, className)}
          >
            <span className="flex items-center justify-center gap-2">{children}</span>
          </a>
        ) : (
          <Link
            href={href}
            data-cta={dataCta}
            data-cta-pos={dataCtaPos}
            onClick={props.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
            className={cn(SHINY_CLASSES, className)}
          >
            <span className="flex items-center justify-center gap-2">{children}</span>
          </Link>
        )
      ) : (
        <button className={cn(SHINY_CLASSES, className)} data-cta={dataCta} data-cta-pos={dataCtaPos} {...props}>
          <span className="flex items-center justify-center gap-2">{children}</span>
        </button>
      )}
    </>
  )
}
