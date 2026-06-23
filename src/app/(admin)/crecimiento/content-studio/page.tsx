import { getSocialAccounts } from '@/lib/growth/actions/social-accounts';
import { ContentStudioClient } from '@/components/growth/content-studio/ContentStudioClient';

export default async function ContentStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  const [accounts, { brandId }] = await Promise.all([
    getSocialAccounts(),
    searchParams,
  ]);

  return <ContentStudioClient defaultBrandId={brandId} accounts={accounts} />;
}
