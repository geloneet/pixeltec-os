import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBrands } from '@/lib/growth/actions/brands';
import { BrandBrainCard } from '@/components/growth/brand-brain/BrandBrainCard';
import { BrandBrainEmptyState } from '@/components/growth/brand-brain/BrandBrainEmptyState';

export default async function BrandBrainListPage() {
  const brands = await getBrands();

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-poppins text-3xl font-bold tracking-tight text-foreground">
            Brand Brain
          </h1>
          <p className="mt-1 font-roboto text-sm text-muted-foreground">
            La memoria de tu marca. Alimenta cada generación de contenido.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/crecimiento/brand-brain/nuevo">
            <Plus className="h-4 w-4" />
            Nueva marca
          </Link>
        </Button>
      </header>

      {brands.length === 0 ? (
        <BrandBrainEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {brands.map((brand) => (
            <BrandBrainCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}
    </div>
  );
}
