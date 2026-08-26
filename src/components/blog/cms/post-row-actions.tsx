"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { archiveBlogCmsPost, deleteBlogCmsPost, unarchiveBlogCmsPost } from "@/lib/blog-cms/actions";
import { ADMIN_BLOG_PATH } from "@/lib/blog-cms/paths";

const ICON_BTN = "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50";

/** Acciones por fila (paridad Encino): Editar · Ver en la web (solo publicadas)
 *  · Archivar / Restaurar · Eliminar (definitivo, con confirmación). */
export function PostRowActions({ id, slug, status, title }: { id: string; slug: string; status: string; title: string }) {
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await action();
      if (!res.ok) toast.error(res.error ?? "Error");
      else {
        toast.success(okMsg);
        router.refresh();
      }
      setConfirm(null);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Link href={`${ADMIN_BLOG_PATH}/${id}/editar`} className={ICON_BTN} aria-label={`Editar ${title || "entrada"}`} title="Editar">
        <Pencil className="h-4 w-4" />
      </Link>
      {status === "published" && (
        <a href={`/blog/${slug}`} target="_blank" rel="noopener noreferrer" className={ICON_BTN} aria-label="Ver en la web" title="Ver en la web">
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
      {status === "archived" ? (
        <button type="button" className={ICON_BTN} disabled={pending} aria-label="Restaurar" title="Restaurar como borrador" onClick={() => run(() => unarchiveBlogCmsPost(id), "Entrada restaurada como borrador")}>
          <ArchiveRestore className="h-4 w-4" />
        </button>
      ) : (
        <button type="button" className={ICON_BTN} disabled={pending} aria-label="Archivar" title="Archivar" onClick={() => setConfirm("archive")}>
          <Archive className="h-4 w-4" />
        </button>
      )}
      <button type="button" className={`${ICON_BTN} hover:text-red-400`} disabled={pending} aria-label="Eliminar" title="Eliminar" onClick={() => setConfirm("delete")}>
        <Trash2 className="h-4 w-4" />
      </button>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? "¿Eliminar esta entrada?" : "¿Archivar esta entrada?"}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {confirm === "delete"
                ? `Se eliminará «${title || "sin título"}» de forma definitiva, incluidas sus revisiones. Esta acción no se puede deshacer.`
                : `«${title || "sin título"}» dejará de verse en el sitio y pasará a Archivadas. Podrás restaurarla como borrador.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirm === "delete" ? "bg-red-700 text-white hover:bg-red-600" : ""}
              onClick={() =>
                confirm === "delete"
                  ? run(() => deleteBlogCmsPost(id), "Entrada eliminada")
                  : run(() => archiveBlogCmsPost(id), "Entrada archivada")
              }
            >
              {confirm === "delete" ? "Eliminar" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
