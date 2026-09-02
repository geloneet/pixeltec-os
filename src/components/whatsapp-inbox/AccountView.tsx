"use client";

import { AlertTriangle, RefreshCw, ServerCrash } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWhatsAppAccount } from "@/hooks/use-whatsapp-account";
import { useWhatsAppTemplates } from "@/hooks/use-whatsapp-templates";
import { BusinessProfileCard } from "./account/BusinessProfileCard";
import { PhoneNumberCard } from "./account/PhoneNumberCard";
import { TemplatesSection } from "./account/TemplatesSection";
import { EmptyState } from "./ui/EmptyState";

/**
 * Pestaña **Cuenta** — la superficie de `whatsapp_business_management`
 * (WO-2026-00181).
 *
 * Existe porque Meta exige que el revisor pueda *demostrar por sí mismo*, sin
 * ayuda, cómo la app accede a los activos del negocio: el número, el perfil de
 * empresa y las plantillas, más el alta de una plantilla nueva.
 *
 * Regla que atraviesa toda la vista: **nada aquí puede parecer roto**. Un
 * error, una env que falta o una lectura parcial se explican en su tarjeta y
 * el resto de la pantalla sigue en pie; un 403, un spinner infinito o una
 * pantalla en blanco es exactamente lo que hace fallar un App Review.
 */

/** Fallo de configuración: se declara con las variables que faltan, no se disfraza. */
function NotConfiguredCard({ missing }: { missing: string[] }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
      <AlertTriangle aria-hidden className="mb-3 h-8 w-8 text-amber-400" />
      <h2 className="mb-2 text-lg font-semibold text-foreground">Cuenta no configurada</h2>
      <p className="text-sm text-muted-foreground">
        La conexión con WhatsApp Business Management no está completa. Faltan estas variables de entorno:
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {missing.length > 0 ? (
          missing.map((env) => (
            <li
              key={env}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-xs text-amber-700 dark:text-amber-300"
            >
              {env}
            </li>
          ))
        ) : (
          <li className="text-xs text-muted-foreground">Sin detalle de variables.</li>
        )}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Configúralas en el entorno del despliegue y recarga la página.
      </p>
    </div>
  );
}

/** Botón de reintento compartido por las dos tarjetas de error. */
function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
    >
      <RefreshCw aria-hidden className="h-3.5 w-3.5" />
      Reintentar
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando la cuenta de WhatsApp">
      {[0, 1].map((card) => (
        <div key={card} className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function AccountView() {
  const { account, loading: accountLoading, error: accountError, refetch: refetchAccount } = useWhatsAppAccount();
  const {
    templates,
    configured: templatesConfigured,
    missing: templatesMissing,
    loading: templatesLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = useWhatsAppTemplates();

  if (accountLoading && templatesLoading) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-3xl">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  // «No configurado» gana a cualquier otro estado: sin env no hay nada que
  // leer y las dos rutas responden lo mismo.
  const notConfigured = account?.configured === false || templatesConfigured === false;
  const missing = account?.missing ?? templatesMissing;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {notConfigured ? (
          <NotConfiguredCard missing={missing} />
        ) : (
          <>
            {accountError ? (
              <EmptyState
                icon={ServerCrash}
                tone="error"
                title="No se pudo leer la cuenta"
                description={accountError}
                actions={<RetryButton onRetry={() => void refetchAccount()} />}
              />
            ) : null}

            {/* Lectura parcial: una de las dos llamadas a Meta falló y la otra sí trajo datos. */}
            {account?.errors?.length ? (
              <div
                role="status"
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
              >
                {account.errors.join(" · ")}
              </div>
            ) : null}

            {account?.phone ? <PhoneNumberCard phone={account.phone} /> : null}
            {account?.profile ? <BusinessProfileCard profile={account.profile} /> : null}

            {templatesError ? (
              <EmptyState
                icon={ServerCrash}
                tone="error"
                title="No se pudieron cargar las plantillas"
                description={templatesError}
                actions={<RetryButton onRetry={() => void refetchTemplates()} />}
              />
            ) : (
              <TemplatesSection templates={templates} onCreated={() => void refetchTemplates()} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
