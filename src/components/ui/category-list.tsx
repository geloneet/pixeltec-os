// category-list.tsx
"use client";
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

// Define the type for a single category item
export interface Category {
  id: string | number;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  featured?: boolean;
}

// Define the props for the CategoryList component
export interface CategoryListProps {
  title: string;
  subtitle?: string;
  categories: Category[];
  headerIcon?: React.ReactNode;
  className?: string;
}

export const CategoryList = ({
  title,
  subtitle,
  categories,
  headerIcon,
  className,
}: CategoryListProps) => {
  const [hoveredItem, setHoveredItem] = useState<string | number | null>(null);

  return (
    <div className={cn("w-full bg-[#030303] text-white py-20 px-4 md:px-8", className)}>
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16 md:mb-20">
          {headerIcon && (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 mb-6 text-black shadow-[0_0_30px_rgba(0,240,255,0.3)]">
              {headerIcon}
            </div>
          )}
          <h2 className="text-4xl md:text-6xl font-bold mb-2 tracking-tight text-white">{title}</h2>
          {subtitle && (
            <h3 className="text-3xl md:text-5xl font-bold text-cyan-400/80">{subtitle}</h3>
          )}
        </div>

        {/* Categories List */}
        <div className="space-y-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="relative group"
              onMouseEnter={() => setHoveredItem(category.id)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={category.onClick}
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl border transition-all duration-500 ease-out cursor-pointer",
                  // Hover state styles
                  hoveredItem === category.id
                    ? 'h-36 border-cyan-500 shadow-[0_0_30px_rgba(0,240,255,0.15)] bg-cyan-950/20'
                    : 'h-28 border-white/10 bg-white/[0.02] hover:border-cyan-500/50'
                )}
              >
                {/* Corner brackets that appear on hover */}
                {hoveredItem === category.id && (
                  <>
                    <div className="absolute top-4 left-4 w-6 h-6">
                      <div className="absolute top-0 left-0 w-4 h-[2px] bg-cyan-400" />
                      <div className="absolute top-0 left-0 w-[2px] h-4 bg-cyan-400" />
                    </div>
                    <div className="absolute bottom-4 right-4 w-6 h-6">
                      <div className="absolute bottom-0 right-0 w-4 h-[2px] bg-cyan-400" />
                      <div className="absolute bottom-0 right-0 w-[2px] h-4 bg-cyan-400" />
                    </div>
                  </>
                )}

                {/* Content */}
                <div className="flex items-center justify-between h-full px-8 md:px-12">
                  <div className="flex-1">
                    <h3
                      className={cn(
                        "font-bold transition-colors duration-300 tracking-wide",
                        category.featured ? 'text-2xl md:text-4xl' : 'text-xl md:text-3xl',
                        hoveredItem === category.id ? 'text-cyan-400' : 'text-white'
                      )}
                    >
                      {category.title}
                    </h3>
                    {category.subtitle && (
                      <p
                        className={cn(
                          "mt-2 transition-colors duration-300 text-sm md:text-lg font-light",
                           hoveredItem === category.id ? 'text-white/90' : 'text-white/50'
                        )}
                      >
                        {category.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Icon appears on the right on hover */}
                  {category.icon && (
                    <div className={cn(
                      "transition-all duration-500 transform",
                      hoveredItem === category.id ? "opacity-100 translate-x-0 text-cyan-400 scale-110" : "opacity-30 -translate-x-4 text-white/20 scale-100"
                    )}>
                      {category.icon}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};