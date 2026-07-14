'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublishButton } from '@/components/growth/publisher/PublishButton';
import type { ContentPost } from '@/types/growth/post';
import type { SocialAccountClient } from '@/lib/growth/actions/social-accounts';
import { cn } from '@/lib/utils';

interface Props {
  post: ContentPost;
  onReset: () => void;
  accounts?: SocialAccountClient[];
}

export function GeneratedPostView({ post, onReset, accounts = [] }: Props) {
  const [copied, setCopied] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption);

  async function handleCopy() {
    const text = [editedCaption, '', ...(post.hashtags ?? []).map((h) => `#${h}`)].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formatLabel: Record<string, string> = {
    instagram_post: 'Instagram Feed',
    instagram_story: 'Instagram Story',
    facebook_post: 'Facebook',
    linkedin_post: 'LinkedIn',
    twitter_post: 'Twitter/X',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="rounded-lg bg-cyan-500/20 px-2.5 py-1 font-roboto text-xs text-cyan-700 dark:text-cyan-300">
            {formatLabel[post.format] ?? post.format}
          </span>
          <p className="mt-1.5 font-roboto text-xs text-muted-foreground">{post.brandSnapshot.name}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground hover:text-foreground">
          Nuevo post
        </Button>
      </div>

      {post.imageUrl && (
        <div className="relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt={post.altText ?? 'Imagen generada'}
            className="w-full object-cover"
          />
        </div>
      )}

      {!post.imageUrl && (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border">
          <div className="flex flex-col items-center gap-2 text-muted-foreground/70">
            <ImageIcon className="h-6 w-6" />
            <p className="font-roboto text-xs">Sin imagen generada</p>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="font-roboto text-xs font-medium text-muted-foreground">Caption</label>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 font-roboto text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado' : 'Copiar todo'}
          </button>
        </div>
        <textarea
          className={cn(
            'w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 font-roboto text-sm text-foreground leading-relaxed outline-none transition-colors focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30'
          )}
          rows={8}
          value={editedCaption}
          onChange={(e) => setEditedCaption(e.target.value)}
        />
      </div>

      {post.hashtags && post.hashtags.length > 0 && (
        <div>
          <p className="mb-2 font-roboto text-xs font-medium text-muted-foreground">Hashtags</p>
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.map((tag) => (
              <span key={tag} className="rounded-lg bg-secondary px-2.5 py-1 font-roboto text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {post.suggestedTime && (
        <p className="font-roboto text-xs text-muted-foreground/70">
          Mejor momento para publicar: <span className="text-muted-foreground">{post.suggestedTime}</span>
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button className="flex-1 gap-2" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? '¡Copiado!' : 'Copiar caption'}
        </Button>
        {post.imageUrl && (
          <Button variant="outline" asChild className="gap-2">
            <a href={post.imageUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Ver imagen
            </a>
          </Button>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 font-roboto text-xs font-medium text-muted-foreground">Publicar directamente</p>
          <PublishButton
            postId={post.id}
            accounts={accounts}
            hasImage={!!post.imageUrl}
          />
        </div>
      )}
    </div>
  );
}
