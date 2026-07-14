'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Instagram, Facebook, Unlink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { disconnectSocialAccount } from '@/lib/growth/actions/social-accounts';
import type { SocialAccountClient } from '@/lib/growth/actions/social-accounts';

interface Props {
  account: SocialAccountClient;
}

function daysUntilExpiry(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
}

export function ConnectedAccountCard({ account }: Props) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  const daysLeft = daysUntilExpiry(account.tokenExpiresAt);
  const isExpiringSoon = daysLeft <= 7;
  const isExpired = daysLeft <= 0;

  async function handleDisconnect() {
    if (!confirm(`¿Desconectar ${account.facebookPageName}?`)) return;
    setDisconnecting(true);
    const result = await disconnectSocialAccount(account.id);
    if (result.ok) {
      toast.success('Cuenta desconectada');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Error al desconectar');
    }
    setDisconnecting(false);
  }

  const PlatformIcon = account.platform === 'instagram' ? Instagram : Facebook;
  const platformColor = account.platform === 'instagram' ? 'text-pink-400' : 'text-blue-400';

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary ${platformColor}`}>
        <PlatformIcon className="h-6 w-6" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-poppins font-semibold text-foreground truncate">
            {account.instagramUsername ? `@${account.instagramUsername}` : account.facebookPageName}
          </p>
          {isExpired ? (
            <span className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2 py-0.5 font-roboto text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" /> Token expirado
            </span>
          ) : isExpiringSoon ? (
            <span className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-0.5 font-roboto text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" /> Expira en {daysLeft}d
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-0.5 font-roboto text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Conectada
            </span>
          )}
        </div>
        <p className="mt-0.5 font-roboto text-xs text-muted-foreground">
          {account.facebookPageName}
          {account.instagramBusinessId ? ' · Instagram Business' : ' · Facebook Page'}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDisconnect}
        disabled={disconnecting}
        className="shrink-0 gap-1.5 text-muted-foreground hover:text-red-400"
      >
        <Unlink className="h-3.5 w-3.5" />
        {disconnecting ? '...' : 'Desconectar'}
      </Button>
    </div>
  );
}
