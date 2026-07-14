import Link from 'next/link';
import { Brain, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BrandBrainEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-8 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Brain className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-poppins text-lg font-semibold text-foreground">
        Sin Brand Brains todavía
      </p>
      <p className="mt-2 max-w-sm font-roboto text-sm text-muted-foreground">
        El Brand Brain es la memoria de tu marca. Define tus servicios, cliente ideal y voz para que
        la IA genere contenido que suena como tú.
      </p>
      <Button asChild className="mt-6 gap-2">
        <Link href="/crecimiento/brand-brain/nuevo">
          <Plus className="h-4 w-4" />
          Crear mi primer Brand Brain
        </Link>
      </Button>
    </div>
  );
}
