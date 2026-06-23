'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Send, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SocialAccountClient } from '@/lib/growth/actions/social-accounts';

interface Props {
  postId: string;
  accounts: SocialAccountClient[];
  hasImage: boolean;
}

export function PublishButton({ postId, accounts, hasImage }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id ?? '');

  const eligibleAccounts = accounts.filter(
    (a) => a.status === 'connected' && (a.platform === 'facebook' || hasImage)
  );

  if (publishedUrl) {
    return (
      <a
        href={publishedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 font-roboto text-sm text-emerald-400 hover:text-emerald-300"
      >
        <ExternalLink className="h-4 w-4" />
        Ver publicación
      </a>
    );
  }

  if (eligibleAccounts.length === 0) {
    return (
      <p className="font-roboto text-xs text-zinc-600">
        {accounts.length === 0
          ? 'Conecta una cuenta en /crecimiento/publisher'
          : 'Instagram requiere imagen para publicar'}
      </p>
    );
  }

  async function handlePublish() {
    if (!selectedAccount) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/growth/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, accountId: selectedAccount }),
      });
      const data = (await res.json()) as { ok?: boolean; publishedUrl?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error al publicar');
      toast.success('¡Publicado!');
      setPublishedUrl(data.publishedUrl ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al publicar');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex gap-2">
      {eligibleAccounts.length > 1 && (
        <select
          className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3 py-2 font-roboto text-sm text-zinc-100 outline-none"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
        >
          {eligibleAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.instagramUsername ? `@${a.instagramUsername}` : a.facebookPageName}
            </option>
          ))}
        </select>
      )}
      <Button onClick={handlePublish} disabled={publishing} className="gap-2">
        {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {publishing ? 'Publicando...' : 'Publicar ahora'}
      </Button>
    </div>
  );
}
