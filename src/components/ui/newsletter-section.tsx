"use client"

import { cn } from "@/lib/utils"
import { ShinyButton } from "@/components/ui/shiny-button"
import { Input } from "@/components/ui/input"
import { ArrowRight, LoaderCircle } from "lucide-react"
import { useState } from "react"

type FormStatus = "idle" | "loading" | "success" | "error"

interface NewsletterSectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string
  onSubscribe?: (email: string) => Promise<{ success: boolean; error?: string }>
  backgroundEffect?: boolean
}

export function NewsletterSection({
  title = "Mantente a la vanguardia. Suscríbete a nuestro newsletter.",
  onSubscribe,
  backgroundEffect = true,
  className,
  ...props
}: NewsletterSectionProps) {
  const [formState, setFormState] = useState({
    email: "",
    status: "idle" as FormStatus,
    message: "",
  })

  const isLoading = formState.status === "loading"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onSubscribe) {
      // Mock subscription if no handler is provided
      setFormState({ email: "", status: "success", message: "¡Gracias por suscribirte a PixelTEC!" })
      return
    }

    setFormState((prev) => ({ ...prev, status: "loading", message: "" }))

    try {
      const result = await onSubscribe(formState.email)
      if (!result.success) {
        setFormState((prev) => ({
          ...prev,
          status: "error",
          message: result.error || "",
        }))
      } else {
        setFormState({
          email: "",
          status: "success",
          message: "¡Gracias por suscribirte!",
        })
      }
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        status: "error",
        message: error instanceof Error ? error.message : "Error al suscribirse",
      }))
    }
  }

  return (
    <section
      className={cn(
        "relative bg-transparent text-white",
        "py-12 md:py-16",
        "overflow-hidden w-full max-w-6xl mx-auto px-4",
        className,
      )}
      {...props}
    >
      <div className="relative overflow-hidden rounded-3xl bg-[#0A0A0B] border border-white/10 px-6 py-12 md:px-12 shadow-[0_0_30px_rgba(0,240,255,0.05)]">
        {backgroundEffect && <BackgroundEffect />}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-4">
              {title}
            </h2>
            <p className="text-zinc-400 text-sm md:text-base">
              Recibe las últimas tendencias en inteligencia artificial, desarrollo de software y estrategias para escalar tu ecosistema digital.
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="w-full md:w-auto md:min-w-[400px]">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="subscribe-form"
                className="flex-1 rounded-full h-12 px-6 border-white/10 bg-black/50 text-white placeholder:text-zinc-500 focus-visible:ring-cyan-500 focus-visible:border-cyan-500 transition-all"
                placeholder="tu@correo.com"
                type="email"
                value={formState.email}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, email: e.target.value }))
                }
                disabled={isLoading}
                aria-label="Suscribirse al newsletter"
                required
              />
              <ShinyButton
                type="submit"
                className="group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoaderCircle className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    Suscribirse
                    <ArrowRight
                      className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </>
                )}
              </ShinyButton>
            </div>
            {formState.message && (
              <p
                className={cn(
                  "mt-3 text-sm font-medium pl-4",
                  formState.status === "error"
                    ? "text-red-400"
                    : "text-cyan-400",
                )}
                role="alert"
                aria-live="polite"
              >
                {formState.message}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  )
}

function BackgroundEffect() {
  return (
    <div
      className="pointer-events-none absolute -right-64 -top-48 opacity-50 mix-blend-screen"
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="856"
        height="745"
        fill="none"
      >
        <g filter="url(#ill-a)">
          <path
            fill="url(#ill-b)"
            fillRule="evenodd"
            d="m56 88 344 212-166 188L56 88Z"
            clipRule="evenodd"
          />
        </g>
        <g filter="url(#ill-c)">
          <path
            fill="url(#ill-d)"
            fillRule="evenodd"
            d="m424 257 344 212-166 188-178-400Z"
            clipRule="evenodd"
          />
        </g>
        <defs>
          <linearGradient
            id="ill-b"
            x1="210.5"
            x2="210.5"
            y1="88"
            y2="467"
            gradientUnits="userSpaceOnUse"
          >
            {/* PixelTEC Cyan glow */}
            <stop stopColor="#00F0FF" stopOpacity="0.8" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id="ill-d"
            x1="578.5"
            x2="578.5"
            y1="257"
            y2="636"
            gradientUnits="userSpaceOnUse"
          >
            {/* PixelTEC Cyan glow */}
            <stop stopColor="#00F0FF" stopOpacity="0.8" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
          </linearGradient>
          <filter
            id="ill-a"
            width="520"
            height="576"
            x="-32"
            y="0"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feGaussianBlur
              result="effect1_foregroundBlur_244_5"
              stdDeviation="44"
            />
          </filter>
          <filter
            id="ill-c"
            width="520"
            height="576"
            x="336"
            y="169"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feGaussianBlur
              result="effect1_foregroundBlur_244_5"
              stdDeviation="44"
            />
          </filter>
        </defs>
      </svg>
    </div>
  )
}
