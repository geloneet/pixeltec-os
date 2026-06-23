import { NextRequest, NextResponse } from 'next/server';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { publishPostToAccount } from '@/lib/growth/social/publish';

export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId, accountId } = (await req.json()) as { postId?: string; accountId?: string };
  if (!postId || !accountId) {
    return NextResponse.json({ error: 'postId y accountId requeridos' }, { status: 400 });
  }

  const result = await publishPostToAccount(postId, accountId, uid);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, publishedUrl: result.publishedUrl });
}
