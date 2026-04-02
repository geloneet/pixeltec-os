import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal de Cliente — PixelTEC',
  description: 'Accede al estado de tu proyecto en PixelTEC.',
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      {children}
    </div>
  );
}
