'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

/**
 * Mantiene la meta tag theme-color alineada con el tema activo.
 * No puede ser media query en metadata porque el tema es por clase
 * (toggle manual), no por prefers-color-scheme.
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    const color = resolvedTheme === 'light' ? '#F9F8F6' : '#030303'; /* hsl(40 20% 97%) = --background light */
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      nonce={nonce}
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
