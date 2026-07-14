'use client';

import Link from 'next/link';
import { Brain, ChevronRight, Trash2 } from 'lucide-react';
import { BrandBrainScore } from './BrandBrainScore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { deleteBrand } from '@/lib/growth/actions/brands';
import { useRouter } from 'next/navigation';
import type { BrandBrainClient } from '@/lib/growth/actions/brands';

interface Props {
  brand: BrandBrainClient;
  onDeleted?: () => void;
}

export function BrandBrainCard({ brand, onDeleted }: Props) {
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`¿Eliminar "${brand.name}"? Esta acción no se puede deshacer.`)) return;
    const result = await deleteBrand(brand.id);
    if (result.ok) {
      toast.success('Marca eliminada');
      onDeleted?.();
      router.refresh();
    } else {
      toast.error(result.error ?? 'Error al eliminar');
    }
  }

  const serviceCount = brand.business?.services?.length ?? 0;

  return (
    <Link
      href={`/crecimiento/brand-brain/${brand.id}`}
      className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 backdrop-blur-xl transition-colors hover:bg-secondary/40"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {brand.identity?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.identity.logoUrl}
              alt={brand.name}
              className="h-10 w-10 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
              <Brain className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-poppins font-semibold text-foreground">
              {brand.name}
            </p>
            <p className="font-roboto text-xs text-muted-foreground">
              {brand.business?.industry || 'Sin industria'}
              {brand.business?.location ? ` · ${brand.business.location}` : ''}
            </p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDelete}
          className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-auto flex items-center justify-between pt-3">
        <BrandBrainScore score={brand.completionScore ?? 0} size="sm" />
        <div className="flex items-center gap-2">
          <span className="font-roboto text-xs text-muted-foreground/80">
            {serviceCount} servicio{serviceCount !== 1 ? 's' : ''}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/80 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </div>
    </Link>
  );
}
