'use client';

import { useState } from 'react';
import { PostGeneratorForm } from './PostGeneratorForm';
import { GeneratedPostView } from './GeneratedPostView';
import type { ContentPost } from '@/types/growth/post';
import type { SocialAccountClient } from '@/lib/growth/actions/social-accounts';

interface Props {
  defaultBrandId?: string;
  accounts: SocialAccountClient[];
}

export function ContentStudioClient({ defaultBrandId, accounts }: Props) {
  const [generatedPost, setGeneratedPost] = useState<ContentPost | null>(null);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">
          Content Studio
        </h1>
        <p className="mt-1 font-roboto text-sm text-zinc-500">
          Genera contenido de alto impacto en segundos.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 backdrop-blur-xl">
          <PostGeneratorForm
            defaultBrandId={defaultBrandId}
            onGenerated={(post) => setGeneratedPost(post)}
          />
        </div>

        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 backdrop-blur-xl">
          {generatedPost ? (
            <GeneratedPostView
              post={generatedPost}
              onReset={() => setGeneratedPost(null)}
              accounts={accounts}
            />
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800">
                <span className="text-3xl">✨</span>
              </div>
              <p className="font-poppins text-base font-semibold text-zinc-300">
                Tu contenido aparecerá aquí
              </p>
              <p className="font-roboto text-sm text-zinc-600">
                Completa el formulario y genera tu primer post.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
