import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname),
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['198.100.155.231', 'dev.pixeltec.mx'],
  // grammy y ws NO deben ser bundleados por webpack. @react-pdf/renderer
  // tampoco: si Next lo empaqueta a través de su propio grafo de módulos, la
  // instancia de "react" que usa para crear los elementos JSX del documento
  // PDF no es la misma con la que su reconciler interno los reconoce ->
  // "Objects are not valid as a React child" (React error #31) al renderizar.
  serverExternalPackages: ['grammy', 'ws', '@anthropic-ai/sdk', '@react-pdf/renderer'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Inlinea CSS crítico above-the-fold y difiere el resto (usa beasties internamente)
    optimizeCss: true,
  },
  async redirects() {
    return [
      // ── Existing permanent redirects ────────────────────────────────────
      // Directo a /hoy: antes /crm→/dashboard→/hoy encadenaba dos 301.
      { source: '/crm', destination: '/hoy', permanent: true },
      { source: '/crm/:path*', destination: '/hoy', permanent: true },
      { source: '/nosotros', destination: '/about', permanent: true },
      { source: '/contacto', destination: '/contact', permanent: true },
      { source: '/servicios', destination: '/services', permanent: true },
      { source: '/blog/de-excel-a-saas', destination: '/blog', permanent: true },
      // ── Posts demo estáticos retirados (2026-08-03, decisión de Miguel):
      //    eran contenido de demostración, nunca gestionado por blog-admin ──
      { source: '/blog/escalabilidad-en-la-nube-con-nextjs-y-firebase', destination: '/blog', permanent: true },
      { source: '/blog/automatizacion-de-procesos-logisticos-con-python-y-apis', destination: '/blog', permanent: true },
      { source: '/blog/agentes-ia-soporte-b2b', destination: '/blog', permanent: true },
      { source: '/blog/de-excel-a-saas-roi', destination: '/blog', permanent: true },
      { source: '/blog/optimizacion-extrema-nextjs', destination: '/blog', permanent: true },
      { source: '/blog/arquitecturas-multi-tenant', destination: '/blog', permanent: true },
      // ── IA Redesign — Semana 1 route migration (301 — rollout estable) ──
      { source: '/dashboard', destination: '/hoy', permanent: true },
      { source: '/dashboard/:path*', destination: '/hoy', permanent: true },
      { source: '/asistente', destination: '/tareas', permanent: true },
      { source: '/asistente/:path*', destination: '/tareas/:path*', permanent: true },
      { source: '/herramientas', destination: '/accesos', permanent: true },
      { source: '/herramientas/:path*', destination: '/accesos/:path*', permanent: true },
      // ── PixelBot landing — aliases 301 hacia la única canonical /pixelbot ──
      { source: '/whatsappbot', destination: '/pixelbot', permanent: true },
      { source: '/whatsapp-bot', destination: '/pixelbot', permanent: true },
      { source: '/bot-whatsapp', destination: '/pixelbot', permanent: true },
      { source: '/chatbot-whatsapp', destination: '/pixelbot', permanent: true },
      { source: '/agente-whatsapp', destination: '/pixelbot', permanent: true },
    ];
  },
  async headers() {
    return [
      ...(process.env.NODE_ENV === 'production' ? [{
        // Production only: static assets have content hashes → safe to cache for 1 year
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      }] : []),
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // HSTS con preload (incluir en https://hstspreload.org después de verificar)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Deshabilita APIs sensibles del navegador que la app no usa.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          // La Content-Security-Policy vive ÚNICAMENTE en src/middleware.ts (con
          // nonce + strict-dynamic, enforcing). Antes coexistían dos CSP y el
          // navegador aplicaba la de aquí (con 'unsafe-inline'/'unsafe-eval'),
          // dejando sin efecto la política más estricta del middleware.
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // TODO(Fase C retiro Firebase): agregar aquí el dominio custom de R2
      // (R2_PUBLIC_URL) una vez que Miguel lo conecte en Cloudflare — avatares
      // y logos de marca ahora se sirven desde ahí, ver src/lib/r2/upload.ts.
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.pixabay.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
