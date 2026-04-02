'use client';

/**
 * PageHeader — unified header for all dashboard pages.
 * Replaces the inline flex justify-between pattern repeated across every page.
 *
 * Usage:
 *   <PageHeader
 *     title="Finanzas"
 *     icon={<Banknote size={36} />}
 *     action={<Button onClick={...}>+ Registrar</Button>}
 *     badge={{ label: '12 activos', color: 'lime' }}
 *   />
 */

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type BadgeColor = 'cyan' | 'lime' | 'yellow' | 'red' | 'zinc';

const badgeClasses: Record<BadgeColor, string> = {
  cyan:   'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
  lime:   'bg-lime-400/10 text-lime-400 border-lime-400/20',
  yellow: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  red:    'bg-red-500/10 text-red-400 border-red-500/20',
  zinc:   'bg-zinc-700/30 text-zinc-400 border-zinc-700/40',
};

interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  /** Primary CTA button rendered on the right */
  action?: ReactNode;
  /** Optional small badge next to the title */
  badge?: { label: string; color?: BadgeColor };
  className?: string;
}

export default function PageHeader({
  title,
  icon,
  action,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex justify-between items-center', className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <span className="text-zinc-400 flex-shrink-0">{icon}</span>
        )}
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {badge && (
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full border',
              badgeClasses[badge.color ?? 'zinc']
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
