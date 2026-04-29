import { notFound } from 'next/navigation';
import { checkPortalSlugAction } from '@/app/actions';
import PortalEntryClient from './portal-entry-client';

export const dynamic = 'force-dynamic';

export default async function PortalEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!slug?.trim()) notFound();

  const res = await checkPortalSlugAction(slug);
  if (!res.success || !res.data) notFound();

  return (
    <PortalEntryClient
      slug={slug}
      companyName={res.data.companyName}
    />
  );
}
