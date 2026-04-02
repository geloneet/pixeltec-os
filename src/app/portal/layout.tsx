'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, LayoutDashboard, FolderKanban, FileText, LifeBuoy, LoaderCircle } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/firebase/auth/use-user-profile';

// Define navigation items
const navItems = [
    { name: 'Resumen', href: '/portal', icon: LayoutDashboard },
    { name: 'Proyectos', href: '/portal/projects', icon: FolderKanban },
    { name: 'Facturas', href: '/portal/billing', icon: FileText },
    { name: 'Soporte', href: '/portal/support', icon: LifeBuoy },
];

export default function PortalLayout({ children }: { children: ReactNode }) {
    const user = useUser();
    const { userProfile, loading: profileLoading } = useUserProfile();
    const auth = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = async () => {
        if (auth) {
            await signOut(auth);
            router.push('/login');
        }
    };

    // Authentication and Authorization check
    useEffect(() => {
        // user is undefined during initial load, null if not logged in, object if logged in.
        if (user === null) {
            router.push('/login');
        }
    }, [user, router]);


    // Loading state
    if (user === undefined || profileLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#030303]">
                <LoaderCircle className="h-10 w-10 animate-spin text-cyan-400" />
            </div>
        );
    }

    // If user is null, it means they are logged out, redirect will happen, but we can show nothing to prevent flicker
    if (!user) {
        return null;
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#030303] text-zinc-100">
            {/* Top Navbar */}
            <header className="sticky top-0 z-50 flex h-20 w-full shrink-0 items-center justify-between border-b border-white/10 bg-[#030303]/80 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
                {/* Left Side */}
                <div className="flex items-center gap-4">
                     <Image 
                        src="https://firebasestorage.googleapis.com/v0/b/studio-1487114664-78b63.firebasestorage.app/o/ptlogo2.png?alt=media" 
                        alt="PixelTEC Logo" 
                        width={32} 
                        height={32} 
                    />
                    <span className="font-logo text-xl font-extrabold uppercase tracking-tight text-gray-100">
                        Pixel<span className="text-brand-blue">Tec</span>
                        <span className="ml-2 font-sans text-lg normal-case text-zinc-400">/ Portal de Cliente</span>
                    </span>
                </div>

                {/* Center Navigation */}
                <nav className="hidden items-center gap-2 rounded-full bg-white/5 p-2 md:flex">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                                pathname === item.href
                                    ? 'bg-white text-black'
                                    : 'text-zinc-400 hover:text-white'
                            )}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>

                {/* Right Side */}
                <div className="flex items-center gap-4">
                     <div className="text-right">
                        <p className="text-sm font-semibold text-white">{userProfile?.displayName || user.email}</p>
                        <p className="text-xs text-zinc-500">Cliente</p>
                    </div>
                    <Button
                        onClick={handleLogout}
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-red-400"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="sr-only">Cerrar Sesión</span>
                    </Button>
                </div>
            </header>
            
             {/* Content Area */}
            <main className="mx-auto w-full max-w-7xl flex-1 p-6">
                {children}
            </main>
        </div>
    );
}
