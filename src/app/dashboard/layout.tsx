'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Plus,
    Bell,
    Monitor,
    BarChart3,
    DollarSign,
    LifeBuoy,
    Banknote,
    ListTodo,
    BotMessageSquare,
    Sprout,
    ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { PresentationModeProvider, usePresentationMode } from '@/context/PresentationModeContext';

const menuItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Clientes', path: '/dashboard/clients', icon: Users },
    { name: 'Tareas', path: '/dashboard/tasks', icon: ListTodo },
    { name: 'Pipeline', path: '/dashboard/pipeline', icon: DollarSign },
    { name: 'Finanzas', path: '/dashboard/finance', icon: Banknote },
    { name: 'Analytics', path: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Soporte', path: '/dashboard/support', icon: LifeBuoy },
    { name: 'AI Agents', path: '/dashboard/agents', icon: BotMessageSquare },
    { name: 'Seed Data', path: '/dashboard/seed', icon: Sprout },
    { name: 'Admin', path: '/dashboard/admin', icon: ShieldCheck },
];

// Sidebar Component
const Sidebar = () => {
    const pathname = usePathname();

    return (
    <aside className="h-full flex-shrink-0 flex items-center p-4 transition-opacity duration-300">
        <div className="h-full w-20 bg-black/20 backdrop-blur-xl border border-white/5 rounded-[2rem] flex flex-col items-center justify-between py-6">
            <Link href="/">
                <Image 
                    src="https://firebasestorage.googleapis.com/v0/b/studio-1487114664-78b63.firebasestorage.app/o/ptlogo2.png?alt=media"
                    alt="PixelTEC Logo"
                    width={40}
                    height={40}
                    className="hover:scale-110 transition-transform"
                />
            </Link>
            <nav className="flex flex-col items-center gap-4">
                {menuItems.map((item) => (
                    <Link href={item.path} key={item.path}>
                        <SidebarItem 
                            icon={<item.icon />} 
                            label={item.name} 
                            active={pathname.startsWith(item.path) && (item.path === '/dashboard' ? pathname === item.path : true)}
                        />
                    </Link>
                ))}
            </nav>
            <div>
                <button>
                    <SidebarItem icon={<Plus />} label="Add Project" />
                </button>
            </div>
        </div>
    </aside>
)};

const SidebarItem = ({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) => (
    <div className={cn(
        "relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group",
        active ? "bg-cyan-950/40 text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]" : "bg-transparent text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
    )}>
        {icon}
        <span className="absolute left-full ml-4 px-3 py-1.5 text-xs font-semibold bg-zinc-800 border border-zinc-700 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none translate-x-[-10px] group-hover:translate-x-0">
            {label}
        </span>
    </div>
);

// Header (Topbar) Component
const Header = () => {
    const { userProfile } = useUserProfile();
    const { isPresentationMode, setPresentationMode } = usePresentationMode();
    const pathname = usePathname();

    return (
    <header className="flex-shrink-0 w-full flex justify-between items-center py-4 px-8">
        <div className={cn(
            "flex items-center gap-3 transition-all duration-500",
            isPresentationMode ? "scale-110" : "scale-100"
        )}>
             <Image 
                src="https://firebasestorage.googleapis.com/v0/b/studio-1487114664-78b63.firebasestorage.app/o/ptlogo2.png?alt=media"
                alt="PixelTEC Logo"
                width={isPresentationMode ? 48 : 40}
                height={isPresentationMode ? 48 : 40}
                className="hover:scale-110 transition-transform"
            />
            <span className={cn("font-logo font-extrabold uppercase tracking-tighter text-gray-100 transition-all duration-300", isPresentationMode ? "text-3xl" : "text-2xl")}>
                Pixel<span className="text-brand-blue">Tec</span>
            </span>
        </div>

        <div className={cn("absolute left-1/2 -translate-x-1/2 transition-opacity duration-500", isPresentationMode ? "opacity-0 pointer-events-none" : "opacity-100")}>
            <div className="bg-white/5 rounded-full p-2 border border-white/10 backdrop-blur-md flex items-center gap-2">
                <PillNavItem label="Overview" href="/dashboard" active={pathname === '/dashboard'} />
                <PillNavItem label="Clientes" href="/dashboard/clients" active={pathname.startsWith('/dashboard/clients')} />
                <PillNavItem label="Tareas" href="/dashboard/tasks" active={pathname.startsWith('/dashboard/tasks')} />
                <PillNavItem label="Pipeline" href="/dashboard/pipeline" active={pathname.startsWith('/dashboard/pipeline')} />
                <PillNavItem label="Finanzas" href="/dashboard/finance" active={pathname.startsWith('/dashboard/finance')} />
                <PillNavItem label="Analytics" href="/dashboard/analytics" active={pathname.startsWith('/dashboard/analytics')} />
                <PillNavItem label="Soporte" href="/dashboard/support" active={pathname.startsWith('/dashboard/support')} />
                <PillNavItem label="AI Agents" href="/dashboard/agents" active={pathname.startsWith('/dashboard/agents')} />
            </div>
        </div>
        
        <div className="flex items-center gap-4">
             <button onClick={() => setPresentationMode(prev => !prev)} className={cn(
                 "relative flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md cursor-pointer transition-all duration-300",
                 isPresentationMode ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/30' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
             )}>
                 <Monitor className="w-5 h-5" />
             </button>
            <div className={cn("flex items-center gap-4 transition-opacity duration-500", isPresentationMode ? "opacity-0 pointer-events-none" : "opacity-100")}>
                <button className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                    <Bell className="w-5 h-5" />
                    <div className="absolute top-2.5 right-3 h-2.5 w-2.5 rounded-full bg-lime-400 border-2 border-[#030303]" />
                </button>
                <div className="relative">
                    <Image 
                        src="https://firebasestorage.googleapis.com/v0/b/studio-1487114664-78b63.firebasestorage.app/o/fotodeperfil.jpg?alt=media"
                        alt="User Avatar"
                        width={48}
                        height={48}
                        className="rounded-full object-cover border-2 border-white/10"
                    />
                    {userProfile?.role && (
                        <span className={cn(
                            "absolute -bottom-1 -right-2 text-[10px] font-bold rounded-full px-1.5 py-0.5 border capitalize",
                            userProfile.role === 'admin' 
                                ? "bg-yellow-400/20 text-yellow-400 border-yellow-400/30" 
                                : "bg-cyan-400/20 text-cyan-400 border-cyan-400/30"
                        )}>
                            {userProfile.role}
                        </span>
                    )}
                </div>
            </div>
        </div>
    </header>
)};

const PillNavItem = ({ label, href, active = false }: { label: string; href: string; active?: boolean }) => (
    <Link href={href} className={cn(
        "px-6 py-2 rounded-full text-sm font-medium transition-colors",
        active ? "bg-white text-black" : "text-white/60 hover:text-white"
    )}>
        {label}
    </Link>
);

function LayoutWithContext({ children }: { children: ReactNode }) {
    const { isPresentationMode } = usePresentationMode();

    return (
        <div className={cn(
            "h-screen w-full flex bg-[#030303] text-zinc-100 font-sans overflow-hidden transition-all duration-700 ease-in-out",
            isPresentationMode ? "bg-black" : ""
        )}>
            <div className={cn("transition-all duration-500 ease-in-out", isPresentationMode ? "w-0 opacity-0" : "w-auto opacity-100")}>
                {!isPresentationMode && <Sidebar />}
            </div>
            <div className="flex-1 flex flex-col h-full min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  if (pathname.startsWith('/dashboard/clients/')) {
    const clientsItem = menuItems.find(item => item.path === '/dashboard/clients');
    if (clientsItem) {
        const overviewItem = menuItems.find(item => item.path === '/dashboard');
        if(overviewItem) overviewItem.path = '/dashboard/overview'; 
    }
  }

  return (
    <PresentationModeProvider>
      <LayoutWithContext>{children}</LayoutWithContext>
    </PresentationModeProvider>
  );
}
