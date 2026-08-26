"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createBlogCmsDraft } from "@/lib/blog-cms/actions";
import { ADMIN_BLOG_PATH } from "@/lib/blog-cms/paths";

/** «+ Crear nueva entrada» → modal Manual / Con IA → borrador + redirect al
 *  editor (paridad Encino `new-post-button.tsx`; no existe ruta /nuevo). */
export function NewPostButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function create(modo: "manual" | "ia") {
    start(async () => {
      const res = await createBlogCmsDraft();
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "No se pudo crear la entrada");
        return;
      }
      setOpen(false);
      router.push(`${ADMIN_BLOG_PATH}/${res.data.id}/editar${modo === "ia" ? "?ia=1" : ""}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Crear nueva entrada
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cómo quieres empezar?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Escribe desde cero o deja que la IA proponga un primer borrador.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => create("manual")}
              className="rounded-xl border border-border p-4 text-left transition-colors hover:border-cyan-500/40 hover:bg-secondary/40 disabled:opacity-50"
            >
              <PenLine className="mb-2 h-5 w-5 text-cyan-400" />
              <p className="font-semibold">Manual</p>
              <p className="text-xs text-muted-foreground">Editor en blanco.</p>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => create("ia")}
              className="rounded-xl border border-border p-4 text-left transition-colors hover:border-cyan-500/40 hover:bg-secondary/40 disabled:opacity-50"
            >
              <Sparkles className="mb-2 h-5 w-5 text-cyan-400" />
              <p className="font-semibold">Con IA</p>
              <p className="text-xs text-muted-foreground">Brief → artículo propuesto.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
