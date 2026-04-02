'use client';

import { Facebook, Instagram, Phone } from 'lucide-react';
import { Dock, DockIcon, DockItem, DockLabel } from '@/components/ui/dock';
import { cn } from '@/lib/utils';

const socialLinksData = [
  { 
    title: 'Facebook', 
    href: 'https://www.facebook.com/profile.php?id=61556300117500',
    icon: <Facebook className='h-3/4 w-3/4 text-white group-hover:text-black transition-colors duration-300' />
  },
  { 
    title: 'Instagram', 
    href: 'https://instagram.com/pixeltecmx',
    icon: <Instagram className='h-3/4 w-3/4 text-white group-hover:text-black transition-colors duration-300' />
  },
  { 
    title: 'WhatsApp', 
    href: 'https://api.whatsapp.com/send?phone=523221246680&text=Hola,%20quiero%20informaci%C3%B3n.',
    icon: <Phone className='h-3/4 w-3/4 text-white group-hover:text-black transition-colors duration-300' />
  },
];

interface SocialLinksProps {
  className?: string;
}

export function SocialLinks({ className }: SocialLinksProps) {
  return (
    <Dock className={cn("items-end pb-3 mx-auto", className)} magnification={72}>
      {socialLinksData.map((link) => (
        <DockItem
          key={link.title}
          className='flex items-center justify-center group'
        >
          <DockLabel>{link.title}</DockLabel>
          <DockIcon>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full">
              <div className="flex items-center justify-center rounded-full h-full w-full bg-neutral-800 group-hover:bg-cyan-500 transition-colors duration-300">
                {link.icon}
              </div>
            </a>
          </DockIcon>
        </DockItem>
      ))}
    </Dock>
  );
}
