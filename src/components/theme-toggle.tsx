'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Antes de montar no sabemos el tema real (SSR): asumimos dark (el
  // default del sitio) y ocultamos el icono para no pintar el incorrecto.
  const isDark = !mounted || resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={cn(
        'flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full',
        'border border-border bg-secondary/60 text-muted-foreground backdrop-blur-md',
        'hover:text-foreground hover:bg-secondary transition-all duration-200',
        className
      )}
    >
      {isDark ? (
        <Sun className={cn('w-4 h-4', !mounted && 'opacity-0')} />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
