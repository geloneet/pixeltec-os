import { NextRequest, NextResponse } from 'next/server';
import { publishScheduledPosts } from '@/lib/growth/social/publish';
import { assertCronExecutionAllowed, cronBlockedResponse } from '@/lib/cron-guard';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Conocer el secreto no basta. La política de egress de Meta sigue decidiendo
  // aparte si una publicación concreta está permitida: son capas distintas.
  try {
    assertCronExecutionAllowed();
  } catch (err) {
    const blocked = cronBlockedResponse(err);
    if (blocked) return blocked;
    throw err;
  }

  const result = await publishScheduledPosts();
  return NextResponse.json(result);
}
