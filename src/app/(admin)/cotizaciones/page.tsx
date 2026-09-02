import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { listQuotesForOwner } from "@/lib/quotes/dashboard-queries";
import { formatAmountWithCode, STATUS_LABEL, type Currency } from "@/lib/quotes/terms";
import PageHeader from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Cotizaciones — Pixeltec.mx",
};

const STATUS_TINT: Record<string, string> = {
  vencida: "bg-red-500/10 text-red-600 dark:text-red-400",
  enviada: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  lista: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  aceptada: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rechazada: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  borrador: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

const PROXIMA_DIAS = 7;

/**
 * Cotizaciones — vista dedicada (WO-2026-00132). Antes solo se veían dentro
 * de cada cliente; aquí se ven TODAS, agrupadas para poder mandar
 * recordatorios sin entrar cliente por cliente.
 */
export default async function CotizacionesPage() {
  const ownerId = await getSessionUserId();
  if (!ownerId) redirect("/login?redirect=/cotizaciones");

  const quotes = await listQuotesForOwner();
  const now = Date.now();
  const proximaFecha = now + PROXIMA_DIAS * 24 * 60 * 60 * 1000;

  const vencidas = quotes.filter((q) => q.status === "vencida");
  const proximasAVencer = quotes.filter(
    (q) => q.status === "enviada" && q.validUntil && new Date(q.validUntil).getTime() <= proximaFecha
  );
  const resto = quotes.filter((q) => !vencidas.includes(q) && !proximasAVencer.includes(q));

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8">
      <PageHeader title="Cotizaciones" description="Vencidas, próximas a vencer y el resto — todas juntas" />

      {quotes.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          Todavía no hay cotizaciones. Se crean desde la pestaña Cotizaciones de cada cliente.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {vencidas.length > 0 && (
            <QuoteSection title={`Vencidas (${vencidas.length})`} quotes={vencidas} tone="text-red-500" />
          )}
          {proximasAVencer.length > 0 && (
            <QuoteSection
              title={`Próximas a vencer — ${PROXIMA_DIAS} días (${proximasAVencer.length})`}
              quotes={proximasAVencer}
              tone="text-amber-500"
            />
          )}
          {resto.length > 0 && <QuoteSection title={`Todas las demás (${resto.length})`} quotes={resto} />}
        </div>
      )}
    </div>
  );
}

function QuoteSection({
  title,
  quotes,
  tone,
}: {
  title: string;
  quotes: Awaited<ReturnType<typeof listQuotesForOwner>>;
  tone?: string;
}) {
  return (
    <section>
      <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${tone ?? "text-muted-foreground"}`}>
        {title}
      </h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {quotes.map((q) => (
          <Link
            key={q.id}
            href={`/clientes/${q.clientId}?tab=cotizaciones`}
            className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {q.folio} · {q.title}
              </p>
              <p className="truncate text-sm text-muted-foreground">{q.clientName}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {formatAmountWithCode(q.totalCents, q.currency as Currency)}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TINT[q.status]}`}>
                {STATUS_LABEL[q.status]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
