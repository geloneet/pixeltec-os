import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { resolveAuthority } from "@/lib/auth/authority";
import { getSmilemoreQaResponse } from "@/lib/smilemore-qa-repo";
import {
  SECTIONS,
  type ModuleAnswer,
  type SmilemoreQaAnswers,
} from "@/lib/smilemore-qa/definition";

export const metadata: Metadata = {
  title: "Respuesta Smile More · Pixeltec.mx",
  description: "Detalle de una respuesta del cuestionario de levantamiento",
};

const DATE_FORMAT = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

function Answer({ value }: { value?: string }) {
  if (!value || value.trim() === "") {
    return <p className="text-sm italic text-muted-foreground/60">Sin respuesta</p>;
  }
  return <p className="text-sm whitespace-pre-wrap leading-relaxed">{value}</p>;
}

export default async function SmilemoreRespuestaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirect=/smilemore-respuestas");

  const authority = await resolveAuthority(session.user.id, session.user.credentialIssuedAt);
  if (!authority.ok) redirect("/login?redirect=/smilemore-respuestas");
  if (!authority.isAdmin) redirect("/hoy");

  const { id } = await params;
  // uuid inválido reventaría el cast de Postgres — se filtra antes de tocar DB.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const row = await getSmilemoreQaResponse(id);
  if (!row) notFound();

  const answers = row.answers as SmilemoreQaAnswers;
  const respuestas = answers.respuestas ?? {};
  const multiples = answers.multiples ?? {};
  const modulos = answers.modulos ?? {};
  const incidencias = answers.incidencias ?? [];
  const prioridades = answers.prioridades ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/smilemore-respuestas"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Todas las respuestas
      </Link>

      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">{row.respondentName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[
            row.respondentRole,
            row.branch && `Sucursal: ${row.branch}`,
            row.systemUsage && `Uso del sistema: ${row.systemUsage}`,
          ]
            .filter(Boolean)
            .join(" · ") || "Sin datos de perfil"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Recibida: {DATE_FORMAT.format(row.createdAt)}
        </p>
      </div>

      {incidencias.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-bold">Registro rápido de incidencias</h2>
          {incidencias.map((inc, i) => (
            <div key={i} className="rounded-lg border border-border bg-background/50 p-4 space-y-2">
              <p className="text-sm font-semibold text-primary">Incidencia {i + 1}</p>
              <dl className="space-y-2 text-sm">
                {inc.seccion && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Sección</dt>
                    <dd>{inc.seccion}</dd>
                  </div>
                )}
                {inc.haciendo && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Qué estaba haciendo</dt>
                    <dd className="whitespace-pre-wrap">{inc.haciendo}</dd>
                  </div>
                )}
                {inc.esperabas && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Qué esperaba</dt>
                    <dd className="whitespace-pre-wrap">{inc.esperabas}</dd>
                  </div>
                )}
                {inc.ocurrio && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Qué ocurrió / error</dt>
                    <dd className="whitespace-pre-wrap">{inc.ocurrio}</dd>
                  </div>
                )}
                {(inc.frecuencia || inc.impacto) && (
                  <div className="flex gap-4">
                    {inc.frecuencia && (
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                        Frecuencia: {inc.frecuencia}
                      </span>
                    )}
                    {inc.impacto && (
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                        Impacto: {inc.impacto}
                      </span>
                    )}
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}

      {SECTIONS.map((section) => (
        <div key={section.id} className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-bold">
            <span className="text-primary mr-2">{section.num}</span>
            {section.title}
          </h2>

          {section.id === "priorizacion" && prioridades.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Los cinco cambios más importantes</p>
              {prioridades.map((p, i) => (
                <div key={i} className="rounded-lg border border-border bg-background/50 p-4 space-y-1.5 text-sm">
                  <p className="font-semibold text-primary">Prioridad {i + 1}</p>
                  {p.cambio && <p><span className="text-xs text-muted-foreground">Cambio: </span>{p.cambio}</p>}
                  {p.problema && <p><span className="text-xs text-muted-foreground">Problema que resuelve: </span>{p.problema}</p>}
                  {p.paraQuien && <p><span className="text-xs text-muted-foreground">Para quién: </span>{p.paraQuien}</p>}
                </div>
              ))}
            </div>
          )}

          {section.items.map((item) => {
            if (item.type === "module-block") {
              const m: ModuleAnswer = modulos[item.id] ?? {};
              return (
                <div key={item.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-semibold">{item.module}</p>
                    {m.prioridad && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                        Prioridad: {m.prioridad}
                      </span>
                    )}
                  </div>
                  <Answer value={m.observacion} />
                </div>
              );
            }
            const value =
              item.type === "checkbox-group"
                ? (multiples[item.id] ?? []).join(", ")
                : respuestas[item.id];
            return (
              <div key={item.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold mb-1.5">{item.label}</p>
                <Answer value={value} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
