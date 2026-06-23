import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getBrand } from '@/lib/growth/actions/brands';
import { BrandBrainWizard } from '@/components/growth/brand-brain/wizard/BrandBrainWizard';

interface Props {
  params: Promise<{ brandId: string }>;
}

export default async function EditarMarcaPage({ params }: Props) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <nav className="mb-6">
        <Link
          href={`/crecimiento/brand-brain/${brandId}`}
          className="flex items-center gap-1.5 font-roboto text-sm text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" /> {brand.name}
        </Link>
      </nav>
      <div className="mb-8">
        <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">
          Editar Brand Brain
        </h1>
        <p className="mt-1 font-roboto text-sm text-zinc-500">
          Actualiza la memoria de <span className="text-zinc-300">{brand.name}</span>.
        </p>
      </div>
      <BrandBrainWizard mode="edit" initialData={brand} />
    </div>
  );
}
