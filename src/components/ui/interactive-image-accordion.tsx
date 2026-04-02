'use client';
import React, { useState } from 'react';
import { ShinyButton } from './shiny-button';

// --- Data for the image accordion ---
const accordionItems = [
  {
    id: 1,
    title: 'Automatización con IA',
    imageUrl: 'https://images.unsplash.com/photo-1677756119517-756a188d2d94?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: 2,
    title: 'Desarrollo Web & Apps',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop',
  },
  {
    id: 3,
    title: 'Consultoría & Soporte TI',
    imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop',
  },
  {
    id: 4,
    title: 'Arquitectura Cloud',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',
  }
];

// --- Accordion Item Component ---
const AccordionItem = ({ item, isActive, onMouseEnter }: { item: any, isActive: boolean, onMouseEnter: () => void }) => {
  return (
    <div
      className={`
        relative h-[450px] rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-700 ease-in-out
        ${isActive ? 'w-[400px]' : 'w-[60px]'}
      `}
      onMouseEnter={onMouseEnter}
    >
      {/* Background Image */}
      <img
        src={item.imageUrl}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = 'https://placehold.co/400x450/111111/ffffff?text=Tech+Image'; }}
      />
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300 hover:bg-opacity-30"></div>

      {/* Caption Text */}
      <span
        className={`
          absolute text-white text-lg font-semibold whitespace-nowrap
          transition-all duration-300 ease-in-out
          ${
            isActive
              ? 'bottom-6 left-1/2 -translate-x-1/2 rotate-0' 
              : 'w-auto text-left bottom-24 left-1/2 -translate-x-1/2 -rotate-90 origin-left'
          }
        `}
      >
        {item.title}
      </span>
    </div>
  );
};


// --- Main App Component ---
export function LandingAccordionItem() {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleItemHover = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="bg-transparent font-sans">
      <section id="services" className="container mx-auto px-4 py-12 md:py-24">
        <div className="flex flex-col md:flex-row-reverse items-center justify-between gap-12">
          
          {/* Left Side: Image Accordion */}
          <div className="w-full md:w-1/2">
            <div className="flex flex-row items-center justify-center gap-4 overflow-x-auto p-4 hidden-scrollbar">
              {accordionItems.map((item, index) => (
                <AccordionItem
                  key={item.id}
                  item={item}
                  isActive={index === activeIndex}
                  onMouseEnter={() => handleItemHover(index)}
                />
              ))}
            </div>
          </div>
          
          {/* Right Side: Text Content */}
          <div className="w-full md:w-1/2 text-center md:text-right">
            <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tighter">
              Servicios Diseñados para el Futuro
            </h2>
            <p className="mt-6 text-lg text-gray-400 max-w-xl mx-auto md:ml-auto font-light tracking-wide">
              Impulsamos tu transformación digital con soluciones de vanguardia. Desde inteligencia artificial hasta arquitecturas web de alto rendimiento y soporte empresarial.
            </p>
            <div className="mt-8">
              <ShinyButton onClick={() => {
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Agendar Diagnóstico
              </ShinyButton>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
