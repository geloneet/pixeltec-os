import { NextRequest, NextResponse } from 'next/server';
import { generateCampaignStrategy } from '@/lib/growth/actions/campaigns';

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const result = await generateCampaignStrategy(campaignId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
