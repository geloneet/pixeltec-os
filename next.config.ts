import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // grammy, ws y firebase-admin NO deben ser bundleados por webpack.
  serverExternalPackages: ['grammy', 'ws', 'firebase-admin'],
  experimental: {
    // @ts-expect-error: nodeMiddleware es un flag de runtime válido en Next.js 15.2+
    // pero aún no está reflejado en los tipos de ExperimentalConfig.
    nodeMiddleware: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/crm', destination: '/dashboard', permanent: true },
      { source: '/crm/:path*', destination: '/dashboard', permanent: true },
      { source: '/nosotros', destination: '/about', permanent: true },
      { source: '/contacto', destination: '/contact', permanent: true },
      { source: '/servicios', destination: '/services', permanent: true },
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
    ],
  },
};

export default nextConfig;
