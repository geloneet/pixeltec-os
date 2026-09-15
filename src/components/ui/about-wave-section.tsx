import { ShinyButton } from './shiny-button';
import { WaveDecoration } from './wave-decoration';
import { HOME_ABOUT } from '@/lib/content/home';

/**
 * Server Component: el H2, el párrafo y el CTA se renderizan en el servidor y
 * viajan en el HTML sin ejecutar JavaScript. Lo único cliente es
 * `<WaveDecoration />`, que aísla framer-motion.
 */
export function AboutWaveSection() {
  return (
    <section id="about" className="relative w-full bg-background dark:bg-[#030303] flex flex-col justify-center pt-24 pb-32 sm:pt-32 sm:pb-48 overflow-hidden">

      {/* Top Content Grid */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">

        {/* Left Side - Large Headline */}
        <div className="md:col-span-7 text-center md:text-left">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-foreground leading-[1.1] tracking-tight">
            {HOME_ABOUT.headingLead} <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-cyan-700 dark:from-cyan-500 dark:to-blue-500">
              {HOME_ABOUT.headingAccent}
            </span>
          </h2>
        </div>

        {/* Right Side - Description and Button */}
        <div className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left">
          <p className="text-muted-foreground dark:text-white/70 text-base leading-relaxed font-light mb-8 max-w-md">
            {HOME_ABOUT.paragraph}
          </p>
          {/* `href` evita el anidamiento inválido <Link><button>: ShinyButton
              renderiza un <a> cuando recibe destino. */}
          <ShinyButton href="/about" className="text-sm tracking-widest uppercase w-full sm:w-auto">
            Más Sobre Nosotros
          </ShinyButton>
        </div>

      </div>

      <WaveDecoration />

      {/* Gradient to blend bottom smoothly into next section */}
      <div className="absolute bottom-0 left-0 w-full h-24 sm:h-32 md:h-40 bg-gradient-to-t from-background via-background/80 to-transparent dark:from-[#030303] dark:via-[#030303]/80 z-20"></div>
    </section>
  );
}
