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
        // Mismo pill de 40px que SocialLinks, para que el header lea como una
        // sola familia de controles circulares.
        'flex h-10 w-10 items-center justify-center rounded-full',
        'border border-border bg-card text-muted-foreground',
        'cursor-pointer transition-all duration-300 ease-out',
        'hover:bg-accent hover:text-foreground hover:shadow-sm',
        'dark:hover:border-cyan-400/30 dark:hover:bg-zinc-900 dark:hover:text-cyan-400',
        'dark:hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className
      )}
    >
      {isDark ? (
        <Sun className={cn('h-4 w-4', !mounted && 'opacity-0')} />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
