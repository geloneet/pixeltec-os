import { NextRequest, NextResponse } from 'next/server';
import { publishScheduledPosts } from '@/lib/growth/social/publish';
import { assertCronExecutionAllowed, cronBlockedResponse } from '@/lib/cron-guard';
import { bearerToken, cronSecretMatches } from '@/lib/cron-secret';

export async function POST(req: NextRequest) {
  if (!cronSecretMatches(bearerToken(req.headers.get('authorization')))) {
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
