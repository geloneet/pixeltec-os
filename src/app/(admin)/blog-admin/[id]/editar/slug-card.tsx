"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { changeSlug } from "@/lib/blog/actions/posts";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SlugCardProps {
  postId: string;
  slug: string;
  isPublished: boolean;
  /** Notifica al editor el slug nuevo (para preview y readiness). */
  onSlugChanged: (newSlug: string) => void;
}

export function SlugCard({ postId, slug, isPublished, onSlugChanged }: SlugCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftSlug, setDraftSlug] = useState("");
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    setDraftSlug(slug);
    setDialogOpen(true);
  }

  function handleConfirm() {
    const next = draftSlug.trim().toLowerCase();
    if (!next || next === slug) {
      setDialogOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await changeSlug(postId, next);
      if (result.ok && result.data) {
        toast.success(
          isPublished
            ? `Slug actualizado a "${result.data.slug}" — se creó un redirect 301 desde el anterior`
            : `Slug actualizado a "${result.data.slug}"`,
        );
        onSlugChanged(result.data.slug);
        setDialogOpen(false);
      } else {
        toast.error(result.error ?? "Error al cambiar el slug");
      }
    });
  }

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cambiar slug</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              El slug define la URL pública del artículo (/blog/&lt;slug&gt;).
              {isPublished
                ? " Este post está publicado: al cambiarlo se creará un redirect permanente (301) del slug anterior al nuevo, para no romper enlaces externos ni el posicionamiento."
                : " El post aún no está publicado, por lo que no se creará ningún redirect."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Nuevo slug</Label>
            <Input
              value={draftSlug}
              onChange={(e) => setDraftSlug(e.target.value)}
              placeholder="mi-articulo-2026"
              className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Minúsculas, números y guiones. Se validará que no esté ocupado.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
              className="border-border bg-secondary/50 text-foreground hover:bg-secondary"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || !draftSlug.trim()}
              className="bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending && <Spinner size="sm" className="mr-2" />}
              Cambiar slug
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Slug
        </h3>
        <p className="break-all rounded-md bg-secondary/50 px-2 py-1.5 font-mono text-xs text-foreground">
          {slug || "(sin slug — se generará al publicar)"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openDialog}
          className="w-full border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Cambiar slug
        </Button>
      </section>
    </>
  );
}
