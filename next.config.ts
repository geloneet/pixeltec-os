import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // grammy, ws y firebase-admin NO deben ser bundleados por webpack.
  serverExternalPackages: ['grammy', 'ws', 'firebase-admin', '@anthropic-ai/sdk'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Inlinea CSS crítico above-the-fold y difiere el resto (usa beasties internamente)
    optimizeCss: true,
  },
  async redirects() {
    return [
      { source: '/crm', destination: '/dashboard', permanent: true },
      { source: '/crm/:path*', destination: '/dashboard', permanent: true },
      { source: '/nosotros', destination: '/about', permanent: true },
      { source: '/contacto', destination: '/contact', permanent: true },
      { source: '/servicios', destination: '/services', permanent: true },
      { source: '/blog/de-excel-a-saas', destination: '/blog/de-excel-a-saas-roi', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Assets estáticos con hash en el nombre → inmutables por 1 año
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // HSTS con preload (incluir en https://hstspreload.org después de verificar)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requiere unsafe-inline para scripts de hidratación
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              // Permite imágenes remotas ya whitelistadas en next.config
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https: wss:",
              // Firebase Auth carga un iframe en <project>.firebaseapp.com para sync de sesión
              "frame-src 'self' https:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
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
        hostname: 'firebasestorage.googleapis.com',
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
        hostname: 'storage.googleapis.com',
        pathname: '/studio-1487114664-78b63.firebasestorage.app/**',
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
