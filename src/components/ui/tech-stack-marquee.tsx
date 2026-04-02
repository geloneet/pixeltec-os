import { cn } from '@/lib/utils';
import { SiPython, SiNextdotjs, SiReact, SiFirebase, SiVercel, SiNodedotjs, SiTailwindcss, SiGooglecloud } from '@icons-pack/react-simple-icons';

const technologies = [
    { name: "Next.js", icon: <SiNextdotjs /> },
    { name: "React", icon: <SiReact /> },
    { name: "Firebase", icon: <SiFirebase /> },
    { name: "Python", icon: <SiPython /> },
    { name: "Tailwind CSS", icon: <SiTailwindcss /> },
    { name: "Node.js", icon: <SiNodedotjs /> },
    { name: "Vercel", icon: <SiVercel /> },
    { name: "Google Cloud", icon: <SiGooglecloud /> },
];

export function TechStackMarquee() {
    const marqueeItems = [...technologies, ...technologies]; // Duplicate for seamless loop

    return (
        <div
            className="relative flex w-full max-w-5xl mx-auto flex-col items-center justify-center overflow-hidden"
        >
            <div className="group flex overflow-hidden p-2 [--gap:2.5rem] [gap:var(--gap)] flex-row w-full">
                <div className="flex shrink-0 justify-around [gap:var(--gap)] animate-marquee flex-row items-center group-hover:[animation-play-state:paused]">
                    {marqueeItems.map((tech, index) => (
                        <div key={index} className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors duration-300 cursor-default">
                            <div className="text-2xl">{tech.icon}</div>
                            <span className="text-lg font-medium tracking-tight">{tech.name}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/12 bg-gradient-to-r from-[#030303] via-[#030303] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/12 bg-gradient-to-l from-[#030303] via-[#030303] to-transparent" />
        </div>
    );
}
