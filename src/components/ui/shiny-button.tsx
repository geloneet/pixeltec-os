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

// WO-2026-00275: los estilos de `.shiny-cta` (pill, shine cónico, variante
// whatsapp-cta, entrada y reduced-motion) viven en src/app/globals.css.
// Estaban aquí en un <style jsx global>; en el App Router styled-jsx no se
// sirve en el HTML inicial (no hay StyleRegistry), así que el CTA pintaba
// como texto plano y el pill "aparecía de golpe" al hidratar. En el CSS del
// build las reglas existen antes de la primera pintura y la entrada
// (materialización + ignición del shine) corre como CSS animation, fuera del
// hilo principal y sin esperar a React.
const SHINY_CLASSES =
  "shiny-cta tracking-wide transition-all duration-300 ease-out shadow-md hover:shadow-lg dark:shadow-none dark:hover:text-blue-300 hover:shadow-[0_8px_24px_-8px_rgba(33,150,243,0.45)] dark:hover:shadow-[0_0_20px_rgba(33,150,243,0.2)] active:scale-95 active:shadow-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus " +
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

  if (href) {
    // Externo: <a> nativo conservando target/rel del consumidor.
    // Interno: <Link> de Next. En ambos casos se evita <a><button>.
    return isExternal ? (
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
  }

  return (
    <button className={cn(SHINY_CLASSES, className)} data-cta={dataCta} data-cta-pos={dataCtaPos} {...props}>
      <span className="flex items-center justify-center gap-2">{children}</span>
    </button>
  )
}
