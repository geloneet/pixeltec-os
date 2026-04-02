"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const liquidbuttonVariants = cva(
  "inline-flex items-center transition-all duration-300 justify-center cursor-pointer gap-2 whitespace-nowrap rounded-full text-sm font-bold disabled:pointer-events-none disabled:opacity-50 outline-none",
  {
    variants: {
      variant: {
        // PixelTEC specific variant
        pixeltec: "bg-cyan-500 text-black hover:bg-cyan-400 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,240,255,0.6)] shadow-[0_0_15px_rgba(0,240,255,0.3)] tracking-wide",
        default: "bg-transparent hover:scale-105 duration-300 transition text-white",
      },
      size: {
        default: "h-11 px-8 py-2",
        lg: "h-12 px-10 text-base",
        xl: "h-14 px-12 text-lg",
      },
    },
    defaultVariants: {
      variant: "pixeltec",
      size: "default",
    },
  }
)

function LiquidButton({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof liquidbuttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <>
      <Comp
        className={cn(
          "relative overflow-hidden",
          liquidbuttonVariants({ variant, size, className })
        )}
        {...props}
      >
        <div className="contents">
          <div className="relative z-10">{children}</div>
          <div
            className="absolute inset-0 -z-10"
            style={{ backdropFilter: 'url("#container-glass")' }}
          />
        </div>
      </Comp>
      <GlassFilter />
    </>
  )
}

function GlassFilter() {
  return (
    <svg className="hidden">
      <defs>
        <filter
          id="container-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          {/* Generate turbulent noise for distortion */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03 0.03"
            numOctaves="1"
            seed="2"
            result="turbulence"
          />

          {/* Blur the turbulence pattern slightly */}
          <feGaussianBlur in="turbulence" stdDeviation="1.5" result="blurredNoise" />

          {/* Displace the source graphic with the noise */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="15"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />

          {/* Apply overall blur on the final result */}
          <feGaussianBlur in="displaced" stdDeviation="1" result="finalBlur" />

          {/* Output the result */}
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}


export { liquidbuttonVariants, LiquidButton }
