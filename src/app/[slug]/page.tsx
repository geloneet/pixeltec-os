import { notFound } from 'next/navigation';
import { findPortalClientBySlug } from '@/lib/portal/pg';
import PortalEntryClient from './portal-entry-client';

// Fase 4: Postgres — antes Firestore `clients`.
async function resolvePortalSlug(slug: string): Promise<{ companyName: string } | null> {
  try {
    const row = await findPortalClientBySlug(slug);
    if (!row) return null;
    return { companyName: row.name };
  } catch {
    return null;
  }
}

export default async function PortalEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!slug?.trim()) notFound();

  const portal = await resolvePortalSlug(slug);
  if (!portal) notFound();

  return <PortalEntryClient slug={slug} companyName={portal.companyName} />;
}
