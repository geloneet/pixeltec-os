import { cn } from "@/lib/utils"

interface NewsletterSectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string
  backgroundEffect?: boolean
}

export function NewsletterSection({
  title = "Mantente a la vanguardia.",
  backgroundEffect = true,
  className,
  ...props
}: NewsletterSectionProps) {
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
              Recibe insights sobre automatización, arquitectura y crecimiento operativo para empresas que escalan.
            </p>
          </div>

          <div className="w-full md:w-auto md:min-w-[360px] rounded-2xl border border-white/10 bg-white/5 px-6 py-5 space-y-3">
            <p className="text-sm text-zinc-300 leading-relaxed">
              Pronto lanzaremos nuestro newsletter. Si quieres estar entre los primeros en recibirlo, escríbenos con asunto{' '}
              <span className="font-semibold text-white">NEWSLETTER</span>:
            </p>
            <a
              href="mailto:hola@pixeltec.mx?subject=NEWSLETTER"
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium text-sm transition-colors"
            >
              hola@pixeltec.mx
            </a>
          </div>
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
          <linearGradient id="ill-b" x1="210.5" x2="210.5" y1="88" y2="467" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F0FF" stopOpacity="0.8" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ill-d" x1="578.5" x2="578.5" y1="257" y2="636" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F0FF" stopOpacity="0.8" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
          </linearGradient>
          <filter id="ill-a" width="520" height="576" x="-32" y="0" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur result="effect1_foregroundBlur_244_5" stdDeviation="44" />
          </filter>
          <filter id="ill-c" width="520" height="576" x="336" y="169" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur result="effect1_foregroundBlur_244_5" stdDeviation="44" />
          </filter>
        </defs>
      </svg>
    </div>
  )
}
