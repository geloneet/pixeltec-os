"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { diffLines } from "diff";
import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import type { BlogPostVersionMeta } from "@/lib/blog/versions";
import {
  getPostVersionContent,
  restorePostVersion,
} from "@/lib/blog/actions/versions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Etiquetas legibles de los reasons del versionado (versions.ts); un reason
 *  fuera del vocabulario se muestra tal cual — extensible sin tocar la UI. */
const REASON_LABEL: Record<string, string> = {
  "pre-regeneracion-ia": "Antes de regenerar con IA",
  publicacion: "Publicación",
  "nueva-revision": "Nueva revisión",
  "pre-restauracion": "Antes de restaurar",
  manual: "Manual",
};

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateFmt.format(date);
}

interface VersionsCardProps {
  postId: string;
  versions: BlogPostVersionMeta[];
  form: UseFormReturn<BlogPostEditInput>;
}

interface DiffView {
  version: number;
  parts: ReturnType<typeof diffLines>;
}

/**
 * B-PR6 — «Historial de versiones» (etapa Verificar): lista los snapshots del
 * artículo con diff del cuerpo (dep `diff`, contra el cuerpo actual del
 * formulario) y restauración con confirmación. Restaurar guarda primero una
 * versión `pre-restauracion` y JAMÁS toca estado ni slug.
 */
export function VersionsCard({ postId, versions, form }: VersionsCardProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffView | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BlogPostVersionMeta | null>(null);

  async function showDiff(meta: BlogPostVersionMeta) {
    setBusyId(meta.id);
    try {
      const result = await getPostVersionContent(postId, meta.id);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "No se pudo leer la versión");
        return;
      }
      // Diff versión → estado ACTUAL del formulario (lo que el editor ve).
      setDiff({ version: meta.version, parts: diffLines(result.data.body, form.getValues("body")) });
    } finally {
      setBusyId(null);
    }
  }

  async function executeRestore() {
    if (!confirmRestore) return;
    setBusyId(confirmRestore.id);
    try {
      const result = await restorePostVersion(postId, confirmRestore.id);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo restaurar");
        return;
      }
      toast.success(`Versión ${confirmRestore.version} restaurada — recargando…`);
      setConfirmRestore(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Historial de versiones
      </h3>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin versiones todavía — se crean al regenerar con IA, publicar o abrir una nueva revisión.
        </p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-foreground">v{v.version}</span>
                  <span className="text-muted-foreground">{REASON_LABEL[v.reason] ?? v.reason}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {v.createdByName} · {formatDate(v.createdAt)} ·{" "}
                  {new Intl.NumberFormat("es-MX").format(v.bodyLength)} caracteres
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId != null}
                  onClick={() => void showDiff(v)}
                  className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {busyId === v.id ? <Spinner size="sm" /> : "Ver diff"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId != null}
                  onClick={() => setConfirmRestore(v)}
                  className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
                >
                  Restaurar…
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Diff del cuerpo: versión seleccionada → estado actual del formulario */}
      <Dialog open={diff != null} onOpenChange={(open) => !open && setDiff(null)}>
        <DialogContent className="max-w-3xl border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Diff — v{diff?.version} → actual</DialogTitle>
            <DialogDescription>
              Rojo: solo en la versión v{diff?.version}. Verde: solo en el cuerpo actual.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-secondary/20 p-3 font-mono text-xs">
            {diff?.parts.map((part, i) => (
              <pre
                key={i}
                className={
                  part.added
                    ? "whitespace-pre-wrap bg-green-500/15 text-green-600 dark:text-green-300"
                    : part.removed
                      ? "whitespace-pre-wrap bg-red-500/15 text-red-600 dark:text-red-300"
                      : "whitespace-pre-wrap text-muted-foreground"
                }
              >
                {part.value}
              </pre>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restaurar con confirmación explícita */}
      <AlertDialog
        open={confirmRestore != null}
        onOpenChange={(open) => !open && setConfirmRestore(null)}
      >
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              ¿Restaurar la versión {confirmRestore?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              El contenido actual se guardará primero como una versión nueva (podrás
              volver a él). Se restauran título, extracto, cuerpo, categoría, etiquetas,
              portada, SEO, fuentes y enlaces internos — el estado editorial y el slug
              NO cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void executeRestore();
              }}
              className="bg-yellow-600 text-white hover:bg-yellow-500"
            >
              {busyId === confirmRestore?.id ? <Spinner size="sm" className="mr-2" /> : null}
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
