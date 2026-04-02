import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication',
  description: 'Authenticate to access PixelTEC System OS.',
  robots: {
    index: false,
    follow: false,
  }
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
