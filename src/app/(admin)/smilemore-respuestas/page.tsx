import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { resolveAuthority } from "@/lib/auth/authority";
import { listSmilemoreQaResponses } from "@/lib/smilemore-qa-repo";

export const metadata: Metadata = {
  title: "Respuestas Smile More · Pixeltec.mx",
  description: "Respuestas del cuestionario de corrección y adaptación del sistema de citas",
};

const DATE_FORMAT = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/**
 * Respuestas del cuestionario público /smilemoreqa (levantamiento Smile More).
 * Solo admins — mismo guard que /usuarios: el rol se resuelve contra Postgres,
 * no contra el JWT (ADR-0036).
 */
export default async function SmilemoreRespuestasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirect=/smilemore-respuestas");

  const authority = await resolveAuthority(session.user.id, session.user.credentialIssuedAt);
  if (!authority.ok) redirect("/login?redirect=/smilemore-respuestas");
  if (!authority.isAdmin) redirect("/hoy");

  const responses = await listSmilemoreQaResponses();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Respuestas — Cuestionario Smile More</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Levantamiento &quot;Corrección y Adaptación de Sistema&quot;. El personal de la clínica
          responde en{" "}
          <Link href="/smilemoreqa" className="underline underline-offset-2" target="_blank">
            /smilemoreqa
          </Link>
          .
        </p>
      </div>

      {responses.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          Todavía no hay respuestas. Comparte el enlace{" "}
          <span className="font-mono text-foreground">pixeltec.mx/smilemoreqa</span> con la
          clínica.
        </div>
      ) : (
        <ul className="space-y-3">
          {responses.map((r) => (
            <li key={r.id}>
              <Link
                href={`/smilemore-respuestas/${r.id}`}
                className="block rounded-xl border border-border bg-card p-4 hover:border-primary/60 transition-colors"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{r.respondentName}</p>
                  <p className="text-xs text-muted-foreground">{DATE_FORMAT.format(r.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[r.respondentRole, r.branch && `Sucursal: ${r.branch}`, r.systemUsage && `Uso: ${r.systemUsage}`]
                    .filter(Boolean)
                    .join(" · ") || "Sin datos de perfil"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
