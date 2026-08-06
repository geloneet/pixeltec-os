'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Lightbulb, PenLine, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createManualPost } from '@/lib/blog/actions/posts';

/**
 * CTA principal del Blog (dictamen 2026-08-05): la intención del usuario es
 * «crear un artículo», no «crear un brief». El brief sigue existiendo como
 * mecanismo interno de la vía con IA; aquí solo se eligen las tres entradas.
 */
export function NewArticleMenu() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleFromScratch() {
    if (creating) return;
    setCreating(true);
    const res = await createManualPost();
    setCreating(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'No se pudo crear el borrador');
      return;
    }
    router.push(`/blog-admin/${res.data.id}/editar`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 md:h-10"
        disabled={creating}
      >
        {creating ? 'Creando…' : '+ Nuevo artículo'}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => router.push('/blog-admin/nuevo')}>
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          <div>
            <p className="font-medium">Generar con IA</p>
            <p className="text-xs text-muted-foreground">Desde un brief con revisión humana</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void handleFromScratch()}>
          <PenLine className="mr-2 h-4 w-4" aria-hidden />
          <div>
            <p className="font-medium">Escribir desde cero</p>
            <p className="text-xs text-muted-foreground">Borrador vacío directo al editor</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/blog-admin/nuevo?modo=idea')}>
          <Lightbulb className="mr-2 h-4 w-4" aria-hidden />
          <div>
            <p className="font-medium">Guardar una idea</p>
            <p className="text-xs text-muted-foreground">Solo el tema, para retomarla después</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
