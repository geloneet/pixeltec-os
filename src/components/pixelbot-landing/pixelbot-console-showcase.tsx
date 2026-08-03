'use client';

import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CONSOLE_SHOWCASE } from './pixelbot-content';

/**
 * Showcase de la consola real de PixelBot (capturas con datos de
 * demostración). Tabs accesibles de Radix; la primera imagen carga lazy
 * porque la sección vive below-the-fold.
 */
export function PixelbotConsoleShowcase() {
  return (
    <section className="py-14 sm:py-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {CONSOLE_SHOWCASE.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base sm:text-lg text-muted-foreground leading-relaxed">
          {CONSOLE_SHOWCASE.intro}
        </p>

        <Tabs defaultValue={CONSOLE_SHOWCASE.tabs[0].id} className="mt-10">
          <div className="flex justify-center">
            <TabsList className="h-auto flex-wrap justify-center gap-1 bg-muted/60 dark:bg-white/5 border border-border">
              {CONSOLE_SHOWCASE.tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="px-4 py-2 text-sm data-[state=active]:text-primary dark:data-[state=active]:text-cyan-400"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {CONSOLE_SHOWCASE.tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-start">
                <div className="text-center lg:text-left lg:pt-4">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground">{tab.heading}</h3>
                  <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">{tab.detail}</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-border bg-[#050506] shadow-sm dark:shadow-[0_0_40px_rgba(33,150,243,0.06)]">
                  <Image
                    src={tab.image}
                    alt={tab.alt}
                    width={tab.width}
                    height={tab.height}
                    sizes="(min-width: 1024px) 640px, 100vw"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">{CONSOLE_SHOWCASE.note}</p>
      </div>
    </section>
  );
}
