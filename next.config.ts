import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // grammy y ws NO deben ser bundleados por webpack — usan APIs de Node.js
  // que se corrompen con el tree-shaking/minification del bundler.
  serverExternalPackages: ['grammy', 'ws'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/crm', destination: '/dashboard', permanent: true },
      { source: '/crm/:path*', destination: '/dashboard', permanent: true },
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
    ],
  },
};

export default nextConfig;
