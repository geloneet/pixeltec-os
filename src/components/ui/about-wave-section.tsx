'use client';
import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ShinyButton } from './shiny-button';

export function AboutWaveSection() {
  return (
    <section id="about" className="relative w-full bg-[#030303] flex flex-col justify-center pt-24 pb-32 sm:pt-32 sm:pb-48 overflow-hidden">
      
      {/* Top Content Grid */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
        
        {/* Left Side - Large Headline */}
        <motion.div 
          className="md:col-span-7 text-center md:text-left"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-[1.1] tracking-tight">
            Arquitectos de tu transformación con <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-500">
              PIXELTEC
            </span>
          </h2>
        </motion.div>

        {/* Right Side - Description and Button */}
        <motion.div 
          className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          viewport={{ once: true }}
        >
          <p className="text-white/70 text-base leading-relaxed font-light mb-8 max-w-md">
            No somos una agencia tradicional de desarrollo. En PixelTEC entendemos que la tecnología es un medio, no el fin. Combinamos metodologías de consultoría empresarial con la potencia de la inteligencia artificial y el desarrollo de software a medida, creando ecosistemas que permiten a las empresas operar y escalar sin fricción.
          </p>
          <Link href="/about">
            <ShinyButton className="text-sm tracking-widest uppercase w-full sm:w-auto">
              Más Sobre Nosotros
            </ShinyButton>
          </Link>
        </motion.div>

      </div>

      {/* Bottom Abstract Wave SVG - HIGH INTENSITY ANIMATION */}
      <div className="absolute bottom-0 left-0 w-full h-[300px] sm:h-[400px] md:h-[500px] pointer-events-none opacity-70">
        <svg 
          viewBox="0 0 1440 500" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-full h-full object-cover overflow-visible"
        >
          {/* Animated Paths with MUCH larger movement range and faster speeds */}
          <motion.path 
            d="M0,250 C320,350 420,100 720,200 C1020,300 1120,150 1440,200" 
            stroke="url(#paint0_linear_intense)" strokeWidth="1" 
            // Significantly increased Y movement, added X movement, higher opacity contrast
            animate={{ y: [0, -80, 0], x: [0, 40, 0], opacity: [0.2, 0.9, 0.2] }}
            // Faster duration
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path 
            d="M0,270 C320,370 420,120 720,220 C1020,320 1120,170 1440,220" 
            stroke="url(#paint0_linear_intense)" strokeWidth="1" 
            animate={{ y: [0, -100, 0], x: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
          <motion.path 
            d="M0,290 C320,390 420,140 720,240 C1020,340 1120,190 1440,240" 
            stroke="url(#paint1_linear_intense)" strokeWidth="2" 
            animate={{ y: [0, -60, 0], x: [0, 50, 0], opacity: [0.4, 1, 0.4], strokeWidth: [2, 3, 2] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
          />
          <motion.path 
            d="M0,310 C320,410 420,160 720,260 C1020,360 1120,210 1440,260" 
            stroke="url(#paint1_linear_intense)" strokeWidth="1.5" 
            animate={{ y: [0, -120, 0], x: [0, -60, 0], opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
          <motion.path 
            d="M0,330 C320,430 420,180 720,280 C1020,380 1120,230 1440,280" 
            stroke="url(#paint0_linear_intense)" strokeWidth="1" 
            animate={{ y: [0, -70, 0], x: [0, 30, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />
          <defs>
            <linearGradient id="paint0_linear_intense" x1="0" y1="250" x2="1440" y2="250" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00F0FF" stopOpacity="0"/>
              <stop offset="0.5" stopColor="#00F0FF" stopOpacity="0.7"/>
              <stop offset="1" stopColor="#00F0FF" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="paint1_linear_intense" x1="0" y1="250" x2="1440" y2="250" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3b82f6" stopOpacity="0"/>
              <stop offset="0.5" stopColor="#00F0FF" stopOpacity="1"/>
              <stop offset="1" stopColor="#3b82f6" stopOpacity="0"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Gradient to blend bottom smoothly into next section */}
      <div className="absolute bottom-0 left-0 w-full h-24 sm:h-32 md:h-40 bg-gradient-to-t from-[#030303] via-[#030303]/80 to-transparent z-20"></div>
    </section>
  );
}
