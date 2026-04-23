import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section
      id="home"
      className="relative w-full min-h-[calc(100vh-8rem)] flex items-center justify-center text-center overflow-hidden"
    >
      <div className="absolute inset-0 z-0 bg-background">
        <div 
          className="absolute inset-0 z-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '2rem 2rem',
          }}
        />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.1),transparent_50%)]"></div>
      </div>


      <div className="container mx-auto px-4 md:px-6 relative z-20 flex flex-col items-center justify-center">
        <h1 
          className="text-[clamp(2.25rem,8vw,6rem)] font-bold tracking-tighter text-gray-100 max-w-5xl opacity-0 animate-fade-in-up"
          style={{ animationDelay: '0.2s' }}
        >
          Arquitectura Digital que Escala con <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">IA</span>
        </h1>
        
        <div 
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '0.4s' }}
        >
          <Button
            asChild
            size="lg"
            className="rounded-full h-14 px-8 bg-black text-primary font-semibold border border-primary/50 transition-all duration-300 hover:shadow-[0_0_25px_hsl(var(--primary)/0.8)] hover:border-primary hover:-translate-y-0.5"
          >
            <Link href="#contact">
              Agendar Diagnóstico
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full h-14 px-8 bg-transparent border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-all duration-300 hover:-translate-y-0.5"
          >
            <Link href="#">
              Ver Demo
            </Link>
          </Button>
        </div>

        <div 
          className="mt-16 w-full max-w-md rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-4 text-xs font-mono text-left opacity-0 animate-fade-in-up"
          style={{ animationDelay: '0.6s' }}
        >
          <p className="text-gray-400">&gt; initializing digital architecture...</p>
          <p className="text-green-400 animate-pulse">&gt; [OK] AI core services deployed.</p>
          <p className="text-gray-400">&gt; scaling automated ecosystems...</p>
          <p className="text-green-400">&gt; [OK] High-performance infrastructure ready.</p>
          <p className="text-yellow-400 animate-pulse">&gt; Awaiting diagnostic input<span className="animate-ping">.</span></p>
        </div>
      </div>
    </section>
  );
}
