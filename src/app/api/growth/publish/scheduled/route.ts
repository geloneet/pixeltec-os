import { NextRequest, NextResponse } from 'next/server';
import { publishScheduledPosts } from '@/lib/growth/social/publish';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await publishScheduledPosts();
  return NextResponse.json(result);
}
