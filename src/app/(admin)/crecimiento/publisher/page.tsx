import Link from 'next/link';
import { Instagram, Facebook, Plus, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSocialAccounts } from '@/lib/growth/actions/social-accounts';
import { ConnectedAccountCard } from '@/components/growth/publisher/ConnectedAccountCard';

export default async function PublisherPage() {
  const accounts = await getSocialAccounts();
  const hasAccounts = accounts.length > 0;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">Publisher</h1>
          <p className="mt-1 font-roboto text-sm text-zinc-500">
            Conecta tus cuentas sociales para publicar directamente desde PixelTEC OS.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/api/auth/meta">
            <Plus className="h-4 w-4" />
            Conectar cuenta Meta
          </Link>
        </Button>
      </header>

      {!hasAccounts ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
          <div className="mb-4 flex gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
              <Instagram className="h-7 w-7 text-pink-400" />
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
              <Facebook className="h-7 w-7 text-blue-400" />
            </div>
          </div>
          <h3 className="font-poppins text-lg font-bold text-zinc-300">Sin cuentas conectadas</h3>
          <p className="mt-2 max-w-sm font-roboto text-sm text-zinc-600">
            Conecta tu cuenta de Facebook Business para acceder a tus Páginas e
            Instagram Business Accounts vinculadas.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href="/api/auth/meta">
              <Plus className="h-4 w-4" />
              Conectar con Meta
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {accounts.map((account) => (
              <ConnectedAccountCard key={account.id} account={account} />
            ))}
          </div>

          <Button asChild variant="outline" className="gap-2">
            <Link href="/api/auth/meta">
              <Plus className="h-4 w-4" />
              Agregar otra cuenta
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-12 rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-500" />
          <h2 className="font-poppins text-sm font-semibold text-zinc-400">
            Publicación automática (cron)
          </h2>
        </div>
        <p className="mb-3 font-roboto text-sm text-zinc-500">
          Para publicar posts programados automáticamente, agrega este cron al VPS:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs text-zinc-400">
{`# Cada 5 minutos — publica posts con scheduledAt en el pasado
*/5 * * * * curl -s -X POST https://pixeltec.mx/api/growth/publish/scheduled \\
  -H "Authorization: Bearer $CRON_SECRET"`}
        </pre>
        <p className="mt-3 font-roboto text-xs text-zinc-600">
          La variable <code className="text-zinc-400">CRON_SECRET</code> ya está en tu{' '}
          <code className="text-zinc-400">.env.local</code>.
        </p>
      </div>
    </div>
  );
}
