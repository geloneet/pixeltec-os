"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createBlogCmsCategory, deleteBlogCmsCategory } from "@/lib/blog-cms/actions";
import type { BlogCategoryDto } from "@/lib/blog-cms/queries";
import { StatusPill } from "./status-pill";

/** Formulario «Nueva categoría» (paridad Encino: nombre, slug opcional, padre
 *  de un nivel, descripción). Sin edición: Encino solo crea/elimina. */
export function NewCategoryForm({ parents }: { parents: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createBlogCmsCategory({ name, slug: slug || undefined, parentId: parentId || null, description });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Categoría creada");
      setName(""); setSlug(""); setParentId(""); setDescription("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Nueva categoría</h3>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground" htmlFor="cat-name">Nombre *</label>
        <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground" htmlFor="cat-slug">Slug (opcional)</label>
        <Input id="cat-slug" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={120} placeholder="se genera del nombre" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground" htmlFor="cat-parent">Categoría padre</label>
        <select id="cat-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
          <option value="">— Ninguna —</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground" htmlFor="cat-desc">Descripción</label>
        <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
      </div>
      <Button type="submit" disabled={pending || !name.trim()}>Crear categoría</Button>
    </form>
  );
}

export function DeleteCategoryButton({ category }: { category: BlogCategoryDto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" aria-label={`Eliminar categoría ${category.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-red-400" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{category.name}»?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Se elimina del catálogo. Las {category.postCount} entradas que la usan conservan el texto de la categoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-700 text-white hover:bg-red-600" disabled={pending} onClick={() => start(async () => {
              const res = await deleteBlogCmsCategory(category.id);
              if (!res.ok) toast.error(res.error ?? "Error"); else { toast.success("Categoría eliminada"); router.refresh(); }
              setOpen(false);
            })}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CategoryPostsButton({ name, count, posts }: { name: string; count: number; posts: Array<{ id: string; title: string; status: string; slug: string }> }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return <span className="text-muted-foreground">0 entradas</span>;
  return (
    <>
      <button type="button" className="text-cyan-400 hover:underline" onClick={() => setOpen(true)}>{count} entrada{count === 1 ? "" : "s"}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-lg">
          <DialogHeader><DialogTitle>Entradas en «{name}»</DialogTitle></DialogHeader>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto text-sm">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{p.title || <span className="italic text-muted-foreground">Sin título</span>}</span>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
