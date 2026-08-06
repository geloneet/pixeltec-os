"use client";

import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import type { BlogActivityEntry } from "@/lib/blog/activity";
import type { BlogPostVersionMeta } from "@/lib/blog/versions";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { SourcesEditor } from "../sources-editor";
import { EditorialPanel } from "../editorial-panel";
import { VersionsCard } from "../versions-card";

/** Etiquetas legibles del vocabulario de blog_activity; un tipo fuera del
 *  vocabulario se muestra tal cual (extensible sin tocar la UI). */
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  creado: "Creado",
  "generado-ia": "Generado con IA",
  editado: "Editado",
  "enviado-a-revision": "Enviado a revisión",
  devuelto: "Devuelto",
  aprobado: "Aprobado",
  publicado: "Publicado",
  archivado: "Archivado",
  "restaurado-archivo": "Restaurado",
  "slug-cambiado": "Slug cambiado",
  "regenerado-ia": "Regenerado con IA",
  "version-restaurada": "Versión restaurada",
  "advertencias-aceptadas": "Advertencias aceptadas",
};

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateFmt.format(date);
}

interface VerificarStageProps {
  form: UseFormReturn<BlogPostEditInput>;
  activity: BlogActivityEntry[];
  /** B-PR6 — versionado del artículo (fire-safe: [] si no está disponible). */
  postId: string;
  versions: BlogPostVersionMeta[];
}

/** Etapa 3 — Verificar: evidencia (fuentes), editorial, historial y versiones
 *  (dictamen UX 2026-08-05 §3 + B-PR6). */
export function VerificarStage({ form, activity, postId, versions }: VerificarStageProps) {
  return (
    <div className="space-y-6">
      {/* Fuentes / evidencia. id=anchor-*: destinos de los deep-links del
          panel de publicación (B-PR4). */}
      <div id="anchor-sources">
        <FormField
          control={form.control}
          name="sources"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <SourcesEditor value={field.value ?? []} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div id="anchor-editorial">
        <EditorialPanel form={form} />
      </div>

      {/* Historial de versiones (B-PR6): snapshots con diff y restauración */}
      <VersionsCard postId={postId} versions={versions} form={form} />

      {/* Historial editorial */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Historial editorial
        </h3>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin actividad registrada todavía.
          </p>
        ) : (
          <ul className="space-y-2">
            {activity.map((entry) => (
              <li
                key={entry.id}
                className="border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-medium text-foreground">
                    {ACTIVITY_TYPE_LABEL[entry.type] ?? entry.type}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="min-w-0 break-words text-muted-foreground">
                    {entry.message}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {entry.actorName ?? "Sistema"} · {formatActivityDate(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
