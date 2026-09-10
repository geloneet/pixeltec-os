'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

// Duración del despliegue circular. Cubre todo el viewport (bastante más
// área que un modal), así que se apoya en el extremo superior del rango de
// UI (200-500ms) en vez de las duraciones cortas de un control pequeño.
const REVEAL_MS = 500;
// Mismo --ease-out "fuerte" del resto del sitio: el tema nuevo "entra" desde
// el botón, así que acelera al salir y frena al cubrir la pantalla.
const REVEAL_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Antes de montar no sabemos el tema real (SSR): asumimos dark (el
  // default del sitio) y ocultamos el icono para no pintar el incorrecto.
  const isDark = !mounted || resolvedTheme === 'dark';

  const handleToggle = () => {
    const next = isDark ? 'light' : 'dark';
    const doc = document as DocumentWithViewTransition;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Sin soporte de View Transitions o con reduce-motion: cambio directo.
    // disableTransitionOnChange del ThemeProvider ya evita el crossfade de
    // color por defecto — queda un cambio instantáneo y limpio, no un flash.
    if (!doc.startViewTransition || reduceMotion) {
      setTheme(next);
      return;
    }

    // Origen del círculo: el centro del propio botón (no el evento de click,
    // que en una activación por teclado llega en (0,0) y rompería el efecto
    // para quien navega sin mouse).
    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(() => {
      // La API toma el snapshot "after" apenas este callback retorna, de
      // forma síncrona. `setTheme` por sí solo NO alcanza a tiempo: el
      // efecto de next-themes que aplica la clase `dark`/`light` es un
      // `useEffect` pasivo (async), y ni `flushSync` lo adelanta — solo
      // fuerza el commit de React, no efectos pasivos. Sin este mutado
      // manual y síncrono, la API capturaba el mismo estado dos veces
      // (transición sin efecto visible, y a veces `InvalidStateError`).
      // Se replica aquí exactamente lo que hace next-themes internamente
      // para `attribute="class"` + `enableColorScheme` (ver theme-provider.tsx).
      flushSync(() => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(next);
        document.documentElement.style.colorScheme = next;
        setTheme(next);
      });
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
          { duration: REVEAL_MS, easing: REVEAL_EASING, pseudoElement: '::view-transition-new(root)' }
        );
      })
      // `ready` rechaza si el navegador aborta la transición (pestaña en
      // segundo plano, otra transición en curso). La clase ya se aplicó
      // arriba de forma síncrona, así que el tema cambia igual — solo se
      // pierde la animación, nunca el cambio de tema en sí.
      .catch(() => {});
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleToggle}
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
