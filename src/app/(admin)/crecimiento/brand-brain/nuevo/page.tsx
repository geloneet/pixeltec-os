import { BrandBrainWizard } from '@/components/growth/brand-brain/wizard/BrandBrainWizard';

export default function NuevaMarcaPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">
          Nueva marca
        </h1>
        <p className="mt-1 font-roboto text-sm text-zinc-500">
          Construye la memoria de tu marca en 5 pasos.
        </p>
      </div>
      <BrandBrainWizard mode="create" />
    </div>
  );
}
