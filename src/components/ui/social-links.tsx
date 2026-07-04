'use client';

import { Facebook, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Official WhatsApp glyph (single-path, optimized).
 * Used as a brand icon — Facebook and Instagram come from Lucide; using a
 * generic <Phone /> for WhatsApp broke visual parity with the other two.
 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

interface SocialLink {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const socialLinksData: SocialLink[] = [
  {
    title: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61556300117500',
    icon: <Facebook className="h-4 w-4" aria-hidden="true" />,
  },
  {
    title: 'Instagram',
    href: 'https://instagram.com/pixeltecmx',
    icon: <Instagram className="h-4 w-4" aria-hidden="true" />,
  },
  {
    title: 'WhatsApp',
    href: 'https://api.whatsapp.com/send?phone=523221378336&text=Hola,%20quiero%20informaci%C3%B3n.',
    icon: <WhatsAppIcon className="h-4 w-4" />,
  },
];

interface SocialLinksProps {
  className?: string;
}

export function SocialLinks({ className }: SocialLinksProps) {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <ul className={cn('flex items-center gap-2', className)}>
        {socialLinksData.map((link) => (
          <li key={link.title}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.title}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full',
                    'border border-border bg-card text-muted-foreground',
                    'cursor-pointer transition-all duration-300 ease-out',
                    'hover:scale-105 hover:bg-accent hover:text-foreground hover:shadow-sm',
                    'dark:hover:border-cyan-400/30 dark:hover:bg-zinc-900 dark:hover:text-cyan-400',
                    'dark:hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                  )}
                >
                  {link.icon}
                </a>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={8}
                className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground"
              >
                {link.title}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </TooltipProvider>
  );
}
