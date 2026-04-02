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
        @property --gradient-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }

        .shiny-cta {
          --shiny-cta-bg: #000000;
          --shiny-cta-fg: #ffffff;
          --shiny-cta-highlight: #2196F3; /* PixelTEC Blue */
          --duration: 3s;
          
          display: inline-flex;
          align-items: center;
          justify-content: center;
          isolation: isolate;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          outline-offset: 4px;
          padding: 1rem 2rem;
          font-size: 1rem;
          line-height: 1.2;
          font-weight: 700;
          border: 1px solid transparent;
          border-radius: 360px;
          color: var(--shiny-cta-fg);
          background: linear-gradient(var(--shiny-cta-bg), var(--shiny-cta-bg)) padding-box,
            conic-gradient(
              from var(--gradient-angle),
              transparent 0%,
              var(--shiny-cta-highlight) 5%,
              white 10%,
              var(--shiny-cta-highlight) 15%,
              transparent 20%
            ) border-box;

          animation: gradient-angle var(--duration) linear infinite;
        }

        .shiny-cta > span {
          z-index: 1;
          letter-spacing: 0.05em;
        }

        @keyframes gradient-angle {
          to {
            --gradient-angle: 360deg;
          }
        }
      `}</style>

      <button className={cn(
        "shiny-cta tracking-wide transition-all duration-300 ease-out hover:bg-brand-blue/10 hover:text-blue-300 hover:shadow-[0_0_20px_rgba(33,150,243,0.2)] active:scale-95 active:shadow-none",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
        className)} {...props}>
        <span className="flex items-center justify-center gap-2">{children}</span>
      </button>
    </>
  )
}
