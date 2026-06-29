import { Instagram, Facebook, Plus, Terminal, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSocialAccounts } from '@/lib/growth/actions/social-accounts';
import { ConnectedAccountCard } from '@/components/growth/publisher/ConnectedAccountCard';

interface Props {
  searchParams: Promise<{ meta_connected?: string; meta_error?: string; meta_desc?: string }>;
}

export default async function PublisherPage({ searchParams }: Props) {
  const [accounts, params] = await Promise.all([
    getSocialAccounts(),
    searchParams,
  ]);
  const hasAccounts = accounts.length > 0;

  const metaError = params.meta_error;
  const metaDesc = params.meta_desc;
  const metaConnected = params.meta_connected ? parseInt(params.meta_connected, 10) : null;

  const errorMessages: Record<string, string> = {
    no_pages: 'Tu cuenta de Facebook no tiene Páginas de negocio. Crea una Página en Facebook primero.',
    invalid_state: 'Error de seguridad en el flujo OAuth. Inténtalo de nuevo.',
    oauth_failed: metaDesc ? `Error de Meta API: ${metaDesc}` : 'Error al conectar con Meta. Revisa los logs del servidor.',
    meta_denied: 'Cancelaste la autorización de Meta.',
    missing_params: 'Meta no devolvió los parámetros esperados.',
  };

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
          <a href="/api/auth/meta">
            <Plus className="h-4 w-4" />
            Conectar cuenta Meta
          </a>
        </Button>
      </header>

      {/* Feedback banner */}
      {metaConnected !== null && metaConnected > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <p className="font-roboto text-sm text-emerald-300">
            {metaConnected === 1
              ? '1 cuenta conectada correctamente.'
              : `${metaConnected} cuentas conectadas correctamente.`}
          </p>
        </div>
      )}

      {metaError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
          <div>
            <p className="font-roboto text-sm text-red-300">
              {errorMessages[metaError] ?? `Error: ${metaError}`}
            </p>
            {metaError === 'no_pages' && (
              <p className="mt-1 font-roboto text-xs text-red-400/70">
                Asegúrate de que tu cuenta de Facebook tenga al menos una Página de negocio y que hayas aceptado el permiso <code>pages_show_list</code>.
              </p>
            )}
          </div>
        </div>
      )}

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
            <a href="/api/auth/meta">
              <Plus className="h-4 w-4" />
              Conectar con Meta
            </a>
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
            <a href="/api/auth/meta">
              <Plus className="h-4 w-4" />
              Agregar otra cuenta
            </a>
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
