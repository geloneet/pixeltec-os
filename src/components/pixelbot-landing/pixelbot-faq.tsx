'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FAQ } from './pixelbot-content';

/**
 * FAQ accesible (Radix Accordion, teclado incluido). Las preguntas y
 * respuestas provienen de pixelbot-content.ts — la MISMA fuente que el
 * JSON-LD FAQPage de la página, para que el markup nunca diverja del texto.
 */
export function PixelbotFaq() {
  return (
    <section className="py-14 sm:py-20">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {FAQ.title}
        </h2>
        <Accordion type="single" collapsible className="mt-10">
          {FAQ.items.map((item, index) => (
            <AccordionItem key={item.q} value={`faq-${index}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:text-primary dark:hover:text-cyan-400 hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
