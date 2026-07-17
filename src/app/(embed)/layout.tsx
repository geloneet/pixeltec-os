/**
 * Layout del route group `(embed)` — superficies pensadas para vivir DENTRO de
 * un <iframe> same-origin (hoy: el preview de landing de PixelForge). Es un
 * grupo HERMANO de `(admin)`: comparte el mismo árbol de URLs bajo
 * `/proyectos/pixelforge/...` pero NO hereda el chrome admin (sidebar, stepper,
 * header del proyecto) porque ese chrome vive en los layouts de `(admin)`, no
 * en el root. Aquí solo un contenedor neutro: sin nav, sin providers extra, sin
 * toaster propio. La CSP `frame-ancestors 'self'` de la ruta preview (ver
 * `@/lib/security/csp`) es la que autoriza el embebido.
 *
 * La auth NO se resuelve aquí: cada page del grupo hace su propio gate
 * server-side por ownerId (el middleware ya protege `/proyectos/*` por prefijo,
 * y la page vuelve a verificar propiedad del proyecto → notFound si no es dueño).
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
