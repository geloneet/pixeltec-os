import { HandHelping, ShieldCheck, SlidersHorizontal, Wrench } from 'lucide-react';
import { ShinyButton } from '@/components/ui/shiny-button';
import { TEAM_PHONE } from '@/lib/diagnostic/logic';
import { HERO } from './pixelbot-content';
import { PixelbotConversationDemo } from './pixelbot-conversation-demo';

const TRUST_ICONS = [ShieldCheck, SlidersHorizontal, HandHelping, Wrench] as const;

const DEMO_WHATSAPP_HREF = `https://api.whatsapp.com/send?phone=${TEAM_PHONE}&text=${encodeURIComponent(
  HERO.demoMessage
)}`;

export function PixelbotHero() {
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40 pb-16 sm:pb-20">
      {/* Glow discreto de fondo, solo decorativo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,hsl(var(--primary)/0.07),transparent)] dark:bg-[radial-gradient(60%_50%_at_70%_20%,rgba(34,211,238,0.06),transparent)]"
      />
      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs sm:text-sm font-medium tracking-wide text-primary dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-400">
              {HERO.eyebrow}
            </p>
            <h1 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight [text-wrap:balance]">
              {HERO.h1}
            </h1>
            <p className="mx-auto lg:mx-0 mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              {HERO.subcopy}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <ShinyButton
                href={DEMO_WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                {HERO.ctaDemo}
              </ShinyButton>
              <a
                href="#planes"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-primary dark:hover:text-cyan-400 transition-colors"
              >
                {HERO.ctaPrimary}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </a>
            </div>
            <a
              href="#como-funciona"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary dark:hover:text-cyan-400 transition-colors"
            >
              {HERO.ctaSecondary}
              <span aria-hidden="true" className="transition-transform group-hover:translate-y-0.5">↓</span>
            </a>
            <ul className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3">
              {HERO.trust.map((item, i) => {
                const Icon = TRUST_ICONS[i] ?? ShieldCheck;
                return (
                  <li key={item} className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Icon className="h-4 w-4 text-primary dark:text-cyan-400" aria-hidden="true" />
                    {item}
                  </li>
                );
              })}
            </ul>
          </div>

          <PixelbotConversationDemo />
        </div>
      </div>
    </section>
  );
}
