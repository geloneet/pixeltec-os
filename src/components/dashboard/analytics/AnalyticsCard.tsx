'use client';
import { motion } from 'framer-motion';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

interface AnalyticsCardProps {
    title: string; 
    value: string; 
    icon: React.ReactNode; 
    change?: string; 
    index: number;
}

export default function AnalyticsCard({ title, value, icon, change, index }: AnalyticsCardProps) {
    return (
        <motion.div
            variants={cardVariants}
            custom={index}
            className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl flex flex-col justify-between"
        >
            <div>
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                    <p className="text-base font-medium">{title}</p>
                    {icon}
                </div>
                <p className="text-4xl font-semibold text-white">{value}</p>
            </div>
            {change && <p className="text-xs text-zinc-500 mt-4">{change}</p>}
        </motion.div>
    );
}
