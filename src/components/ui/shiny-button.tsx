"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
}

export function ShinyButton({ children, className = "", ...props }: ShinyButtonProps) {
  return (
    <>
      <style jsx>{`
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
      `}</style>

      <button className={cn(
        "shiny-cta tracking-wide transition-all duration-300 ease-out shadow-md hover:shadow-lg dark:shadow-none hover:text-blue-300 dark:hover:shadow-[0_0_20px_rgba(33,150,243,0.2)] active:scale-95 active:shadow-none",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
        className)} {...props}>
        <span className="flex items-center justify-center gap-2">{children}</span>
      </button>
    </>
  )
}
