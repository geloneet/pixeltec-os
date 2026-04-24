'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AnimatedTextLink } from './ui/animated-menu';
import { SocialLinks } from './ui/social-links';
import { ShinyButton } from './ui/shiny-button';

const navLinks = [
    { label: 'Inicio', href: '/' },
    { label: 'Nosotros', href: '/about' },
    { label: 'Servicios', href: '/services' },
    { label: 'Industrias', href: '/industrias' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contacto', href: '/contact' },
];

const AnimatedHamburger = ({ isOpen, onClick, className }: { isOpen: boolean; onClick: () => void, className?: string }) => (
    <button 
      onClick={onClick}
      className={cn("relative block flex-shrink-0 cursor-pointer w-[50px] h-[40px] z-[60] focus:outline-none lg:hidden", className)}
      aria-label="Abrir menú"
    >
      <span 
        className={cn(
          "absolute left-0 h-[7px] bg-[#f1faee] rounded-full transition-all duration-300 ease-out",
          isOpen ? "top-0 rotate-45 left-[5px] w-[48px] origin-top-left" : "top-0 w-[45px]"
        )} 
      />
      <span 
        className={cn(
          "absolute left-0 w-[45px] h-[7px] bg-[#f1faee] rounded-full transition-all duration-300 ease-out top-[17px]",
          isOpen ? "-translate-x-[20px] opacity-0" : ""
        )} 
      />
      <span 
        className={cn(
          "absolute left-0 h-[7px] bg-[#f1faee] rounded-full transition-all duration-300 ease-out",
          isOpen ? "bottom-[-1px] -rotate-45 left-[5px] w-[48px] origin-bottom-left" : "bottom-0 w-[45px]"
        )} 
      />
    </button>
  );

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
        isScrolled
          ? "h-20 bg-[#030303]/85 backdrop-blur-md border-b border-white/10 shadow-lg shadow-blue-950/10"
          : "h-24 sm:h-28 bg-transparent"
      )}
    >
        <div className="w-full h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src={process.env.NEXT_PUBLIC_LOGO_URL!}
                alt="PixelTEC Logo"
                width={40}
                height={40}
                className={cn(
                  "w-auto transition-all duration-300 ease-in-out",
                  isScrolled ? "h-8" : "h-10"
                )} 
              />
              <span className={cn(
                  "font-logo font-extrabold uppercase tracking-tighter transition-all duration-300 ease-in-out translate-y-0.5",
                  "hover:brightness-110 hover:drop-shadow-[0_0_15px_rgba(33,150,243,0.3)]",
                  isScrolled ? "text-3xl" : "text-4xl"
              )}>
                  <span className="text-gray-100">Pixel</span><span className="text-brand-blue">Tec</span>
              </span>
            </Link>
            
            <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
                <Link 
                key={link.href}
                href={link.href}
                className="text-base font-bold tracking-wide text-gray-300 transition-colors hover:text-primary"
                >
                <AnimatedTextLink>{link.label}</AnimatedTextLink>
                </Link>
            ))}
            </nav>

            <div className="hidden lg:block">
              <a href="https://api.whatsapp.com/send?phone=523221246680&text=Hola,%20quiero%20informaci%C3%B3n." target="_blank" rel="noopener noreferrer">
                <ShinyButton>
                    <Phone className="h-5 w-5" />
                    WhatsApp
                </ShinyButton>
              </a>
            </div>

            <div className="lg:hidden">
                <AnimatedHamburger isOpen={isMenuOpen} onClick={() => setIsMenuOpen(true)} />
                <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <SheetContent 
                      side="right" 
                      className="bg-[#030303]/90 backdrop-blur-xl bottom-auto top-4 h-[calc(100dvh-2rem)] w-[90%] max-w-sm rounded-l-3xl border-l border-t border-b border-white/10 shadow-2xl shadow-black/50 p-0 [&>button[aria-label='Close']]:hidden right-0 rounded-r-none border-r-0"
                    >
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                    <AnimatedHamburger isOpen={isMenuOpen} onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 z-10"/>
                    <div className="flex flex-col min-h-full w-full p-6">
                        <div className="flex-1 flex flex-col justify-center items-center">
                            <div className="flex items-center gap-3 mb-16">
                                <Image src={process.env.NEXT_PUBLIC_LOGO_URL!} alt="PixelTEC Logo" width={40} height={40} className="h-10 w-auto" />
                                <span className={cn(
                                    "font-logo text-4xl font-extrabold uppercase tracking-tighter translate-y-0.5"
                                )}>
                                    <span className="text-gray-100">Pixel</span><span className="text-brand-blue">Tec</span>
                                </span>
                            </div>
                            <nav className="flex flex-col items-center justify-center gap-8 text-center">
                            {navLinks.map((link) => (
                                <Link
                                key={link.href}
                                href={link.href}
                                className="text-white font-black uppercase text-4xl"
                                onClick={() => setIsMenuOpen(false)}
                                >
                                <AnimatedTextLink>{link.label}</AnimatedTextLink>
                                </Link>
                            ))}
                            </nav>
                        </div>
                        <div className="w-full">
                          <div className="mb-8">
                              <SocialLinks />
                          </div>
                          <a href="https://api.whatsapp.com/send?phone=523221246680&text=Hola,%20quiero%20informaci%C3%B3n." target="_blank" rel="noopener noreferrer" onClick={() => setIsMenuOpen(false)}>
                            <ShinyButton className="w-full text-sm uppercase tracking-widest">
                              <Phone className="h-5 w-5" />
                              WhatsApp
                            </ShinyButton>
                          </a>
                        </div>
                    </div>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    </header>
  );
}
