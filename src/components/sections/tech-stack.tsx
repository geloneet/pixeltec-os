'use client';

import { motion } from 'framer-motion';
import { TechStackMarquee } from '@/components/ui/tech-stack-marquee';

// REN-01 (WO-2026-00268): el scroll-reveal anima SOLO transform. Con
// `opacity: 0` en el estado inicial, todo este contenido salía invisible del
// servidor y no aparecía nunca si framer-motion no hidrataba (JS lento o
// bloqueado); los rastreadores que no ejecutan JS veían la página en blanco.
const sectionVariants = {
  hidden: { y: 50 },
  visible: { 
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' }
  },
};

export default function TechStackSection() {
    return (
        <motion.section
            className="py-16 sm:py-24"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={sectionVariants}
        >
            <div className="container mx-auto px-4 text-center">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-8">
                    Tecnologías que Dominamos
                </h3>
                <TechStackMarquee />
            </div>
        </motion.section>
    );
}
