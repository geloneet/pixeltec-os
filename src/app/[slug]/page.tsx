import { notFound } from 'next/navigation';
import { getAdminFirestore } from '@/lib/firebase-admin';
import PortalEntryClient from './portal-entry-client';

async function resolvePortalSlug(slug: string): Promise<{ companyName: string } | null> {
  try {
    const snap = await getAdminFirestore()
      .collection('clients')
      .where('slug', '==', slug.trim())
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0].data();
    return { companyName: d.companyName as string };
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
