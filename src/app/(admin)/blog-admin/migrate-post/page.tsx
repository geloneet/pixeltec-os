'use client';

import { useState } from 'react';
import { migrateExistingPostBody } from '@/lib/blog/actions/migrations';

type Status = 'idle' | 'running' | 'done' | 'error';

export default function MigratePage() {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<{ before: number; after: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMigrate() {
    setStatus('running');
    setResult(null);
    setError(null);
    const res = await migrateExistingPostBody();
    if (res.ok && res.data) {
      setResult(res.data);
      setStatus('done');
    } else {
      setError(res.error ?? 'Error desconocido');
      setStatus('error');
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-1 text-xl font-bold text-foreground">Migración: strip code fence wrapper</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Slug:{' '}
        <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-blue-400">
          como-tomar-un-curso-de-ia-gratis
        </code>
        <br />
        Elimina el code fence externo del body y extrae el frontmatter a los campos del doc.
        Operación idempotente — segura de ejecutar más de una vez.
      </p>

      <button
        onClick={handleMigrate}
        disabled={status === 'running' || status === 'done'}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-muted"
      >
        {status === 'running' ? 'Ejecutando...' : status === 'done' ? '✓ Completado' : 'Ejecutar migración'}
      </button>

      {status === 'done' && result && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <p>
            Body antes:{' '}
            <span className="font-mono text-foreground">{result.before.toLocaleString('es-MX')}</span> chars
          </p>
          <p>
            Body después:{' '}
            <span className="font-mono text-foreground">{result.after.toLocaleString('es-MX')}</span> chars
          </p>
          <p>
            Eliminados:{' '}
            <span className="font-mono text-green-400">{(result.before - result.after).toLocaleString('es-MX')}</span>{' '}
            chars (frontmatter + code fence wrapper)
          </p>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-950/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
