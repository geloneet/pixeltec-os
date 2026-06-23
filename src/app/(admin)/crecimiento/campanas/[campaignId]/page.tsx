import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCampaign } from '@/lib/growth/actions/campaigns';
import { CampaignDetail } from '@/components/growth/campaigns/CampaignDetail';

interface Props {
  params: Promise<{ campaignId: string }>;
}

export default async function CampaignDetailPage({ params }: Props) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <nav className="mb-6">
        <Link href="/crecimiento/campanas" className="flex items-center gap-1.5 font-roboto text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-4 w-4" /> Campañas
        </Link>
      </nav>
      <CampaignDetail campaign={campaign} />
    </div>
  );
}
