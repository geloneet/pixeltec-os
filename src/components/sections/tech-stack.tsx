'use client';

import { motion } from 'framer-motion';
import { TechStackMarquee } from '@/components/ui/tech-stack-marquee';

const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { 
    opacity: 1, 
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
