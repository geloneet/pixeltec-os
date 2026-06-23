import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Pencil, ArrowLeft, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBrand } from '@/lib/growth/actions/brands';
import { BrandBrainScore } from '@/components/growth/brand-brain/BrandBrainScore';

interface Props {
  params: Promise<{ brandId: string }>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6">
      <h3 className="mb-4 font-poppins text-sm font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return <p className="font-roboto text-sm text-zinc-600">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="rounded-lg bg-zinc-800 px-2.5 py-1 font-roboto text-xs text-zinc-400">
          {t}
        </span>
      ))}
    </div>
  );
}

export default async function BrandDetailPage({ params }: Props) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();

  const services = brand.business?.services ?? [];
  const icp = brand.positioning?.targetAudience;
  const voice = brand.voice;
  const identity = brand.identity;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <nav className="mb-6">
        <Link href="/crecimiento/brand-brain" className="flex items-center gap-1.5 font-roboto text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-4 w-4" /> Brand Brain
        </Link>
      </nav>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {identity?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={identity.logoUrl} alt={brand.name} className="h-16 w-16 rounded-xl object-contain bg-zinc-800 p-2" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-800">
              <span className="font-poppins text-2xl font-bold text-zinc-400">
                {brand.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">
                {brand.name}
              </h1>
              <BrandBrainScore score={brand.completionScore} />
            </div>
            <p className="mt-1 font-roboto text-sm text-zinc-500">
              {brand.business?.industry}
              {brand.business?.location ? ` · ${brand.business.location}` : ''}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href={`/crecimiento/brand-brain/${brandId}/editar`}>
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Section title="Servicios">
          {services.length === 0 ? (
            <p className="font-roboto text-sm text-zinc-600">Sin servicios definidos</p>
          ) : (
            <div className="space-y-3">
              {services.map((s) => (
                <div key={s.id} className="rounded-xl border border-zinc-800/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-poppins text-sm font-semibold text-zinc-200">{s.name}</p>
                    {s.isHighlight && <Star className="h-3.5 w-3.5 text-amber-400" />}
                  </div>
                  <p className="mt-1 font-roboto text-xs text-zinc-500 line-clamp-2">{s.description}</p>
                  {s.benefit && (
                    <p className="mt-1.5 font-roboto text-xs text-cyan-400">{s.benefit}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Cliente Ideal (ICP)">
          <div className="space-y-3">
            {icp?.painPoints?.length ? (
              <div>
                <p className="mb-1.5 font-roboto text-xs font-medium text-zinc-600">Dolores</p>
                <TagList tags={icp.painPoints} />
              </div>
            ) : null}
            {icp?.goals?.length ? (
              <div>
                <p className="mb-1.5 font-roboto text-xs font-medium text-zinc-600">Objetivos</p>
                <TagList tags={icp.goals} />
              </div>
            ) : null}
            {icp?.triggers?.length ? (
              <div>
                <p className="mb-1.5 font-roboto text-xs font-medium text-zinc-600">Disparadores</p>
                <TagList tags={icp.triggers} />
              </div>
            ) : null}
            {brand.positioning?.valueProps?.length ? (
              <div>
                <p className="mb-1.5 font-roboto text-xs font-medium text-zinc-600">Propuestas de valor</p>
                <TagList tags={brand.positioning.valueProps} />
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Voz y comunicación">
          <div className="space-y-3">
            {voice?.personality?.length ? (
              <div>
                <p className="mb-1.5 font-roboto text-xs font-medium text-zinc-600">Personalidad</p>
                <TagList tags={voice.personality} />
              </div>
            ) : null}
            {voice?.formality && (
              <div className="flex items-center gap-2">
                <p className="font-roboto text-xs text-zinc-600">Formalidad:</p>
                <span className="rounded-lg bg-zinc-800 px-2 py-0.5 font-roboto text-xs text-zinc-400 capitalize">
                  {voice.formality.replace('_', ' ')}
                </span>
              </div>
            )}
            {brand.contentRules?.contentPillars?.length ? (
              <div>
                <p className="mb-1.5 font-roboto text-xs font-medium text-zinc-600">Pilares</p>
                <TagList tags={brand.contentRules.contentPillars} />
              </div>
            ) : null}
          </div>
        </Section>

        {brand.objections?.length ? (
          <Section title="Objeciones y respuestas">
            <div className="space-y-3">
              {brand.objections.map((obj) => (
                <div key={obj.id} className="rounded-xl border border-zinc-800/60 p-3 text-sm">
                  <p className="font-roboto text-zinc-400">&ldquo;{obj.objection}&rdquo;</p>
                  <p className="mt-1 font-roboto text-xs text-cyan-400">{obj.response}</p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {identity && (
          <Section title="Identidad visual">
            <div className="space-y-3">
              {identity.colors && (
                <div>
                  <p className="mb-2 font-roboto text-xs font-medium text-zinc-600">Paleta</p>
                  <div className="flex gap-2">
                    {Object.entries(identity.colors).map(([key, color]) => (
                      color ? (
                        <div key={key} className="flex flex-col items-center gap-1">
                          <div className="h-8 w-8 rounded-lg border border-zinc-700/60" style={{ background: color }} />
                          <span className="font-roboto text-[10px] text-zinc-600 capitalize">{key}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              )}
              {identity.typography && (
                <div>
                  <p className="mb-1.5 font-roboto text-xs font-medium text-zinc-600">Tipografía</p>
                  <p className="font-roboto text-xs text-zinc-400">
                    Títulos: {identity.typography.heading} · Cuerpo: {identity.typography.body}
                  </p>
                </div>
              )}
            </div>
          </Section>
        )}

        <Section title="Acciones rápidas">
          <div className="space-y-3">
            {!brand.isUsable && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="font-roboto text-xs text-amber-400">
                  Tu Brand Brain necesita más información (completitud mínima 60%) para generar contenido.
                </p>
              </div>
            )}
            <Button asChild className="w-full gap-2" disabled={!brand.isUsable}>
              <Link href={`/crecimiento/content-studio?brandId=${brandId}`}>
                <Zap className="h-4 w-4" />
                Generar contenido
              </Link>
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
