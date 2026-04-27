'use client';

import { useEffect, useId, useState } from 'react';

type RenderState = 'loading' | 'rendered' | 'error';

export default function MermaidDiagram({ content }: { content: string }) {
  const reactId = useId();
  const uid = `mermaid-${reactId.replace(/:/g, 'x')}`;
  const [state, setState] = useState<RenderState>('loading');
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({ theme: 'dark', startOnLoad: false, securityLevel: 'loose' });
        const result = await mermaid.render(uid, content);
        if (!cancelled) {
          setSvg(result.svg);
          setState('rendered');
        }
      } catch (err) {
        console.error('[MermaidDiagram] render failed:', err);
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [content, uid]);

  if (state === 'error') {
    return (
      <div className="my-6 overflow-x-auto rounded-lg border border-red-500/20 bg-white/5 p-4">
        <p className="mb-2 text-xs text-zinc-500">Diagrama no disponible</p>
        <pre className="text-sm text-zinc-400">{content}</pre>
      </div>
    );
  }

  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-white/10 bg-white/5 p-4">
      {state === 'loading' ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
        </div>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </div>
  );
}
