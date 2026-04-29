import { notFound } from 'next/navigation';
import { getServerFirestore } from '@/lib/firebase-server';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import PortalEntryClient from './portal-entry-client';

export const dynamic = 'force-dynamic';

async function resolvePortalSlug(slug: string): Promise<{ companyName: string } | null> {
  try {
    const db = getServerFirestore();
    const snap = await getDocs(
      query(collection(db, 'clients'), where('slug', '==', slug.trim()), limit(1))
    );
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
