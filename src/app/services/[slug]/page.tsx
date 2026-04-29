import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import ServiceDetailClient from './service-detail-client';

const SERVICE_META: Record<string, { title: string; description: string }> = {
  'ecosistemas-web': {
    title: 'Ecosistemas Web Avanzados',
    description: 'Creación de aplicaciones web robustas, CRMs personalizados y sitios corporativos ultra rápidos con Next.js, React y Firebase.',
  },
  'automatizacion': {
    title: 'Automatización de Procesos con IA',
    description: 'Scripts Python, bots de Telegram/WhatsApp y herramientas de IA para eliminar tareas repetitivas y optimizar la operación diaria.',
  },
  'consultoria': {
    title: 'Consultoría Tecnológica Estratégica',
    description: 'Diagnóstico, transformación digital y rediseño UI/UX para modernizar tus procesos y elevar la eficiencia de tu empresa.',
  },
};

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const meta = SERVICE_META[slug];
  if (!meta) return { title: 'Servicio no encontrado' };
  return buildMetadata({
    path: `/services/${slug}`,
    title: meta.title,
    description: meta.description,
  });
}

export default async function ServiceDetailPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!SERVICE_META[slug]) notFound();
  return <ServiceDetailClient slug={slug} />;
}
