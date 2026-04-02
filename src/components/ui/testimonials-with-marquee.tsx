'use client';

import { cn } from "@/lib/utils"
import { motion } from "framer-motion";
import { TestimonialCard } from "@/components/ui/testimonial-card"
import type { TestimonialAuthor } from "@/components/ui/testimonial-card"

interface TestimonialsSectionProps {
  title: string
  description: string
  testimonials: Array<{
    author: TestimonialAuthor
    text: string
    href?: string
  }>
  className?: string
}

export function TestimonialsWithMarquee({ 
  title,
  description,
  testimonials,
  className 
}: TestimonialsSectionProps) {
  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <section className={cn(
      "bg-[#030303] text-white",
      "py-16 sm:py-24 md:py-32 px-0",
      className
    )}>
      <div className="mx-auto flex w-full max-w-container flex-col items-center gap-6 text-center sm:gap-16">
        <div className="flex flex-col items-center gap-4 px-4 sm:gap-6">
          <h2 className="max-w-[720px] text-4xl font-bold leading-tight sm:text-6xl sm:leading-tight tracking-tight text-white">
            {title}
          </h2>
          <p className="text-md max-w-[600px] font-light text-white/60 sm:text-xl tracking-wide">
            {description}
          </p>
        </div>

        <div 
          className="relative w-full overflow-hidden mt-8"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
        >
          <motion.div
            className="flex gap-6 p-2"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ 
              repeat: Infinity, 
              repeatType: "loop", 
              duration: 35, 
              ease: "linear" 
            }}
          >
            {duplicatedTestimonials.map((testimonial, i) => (
              <TestimonialCard 
                key={i}
                {...testimonial}
                className="shrink-0"
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
