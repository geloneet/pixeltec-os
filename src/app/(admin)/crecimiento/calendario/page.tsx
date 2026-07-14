import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthPosts } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/auth/session';
import { resolveOwnerId, publicId } from '@/lib/growth/pg';
import { CalendarGrid } from '@/components/growth/calendar/CalendarGrid';

async function getScheduledPosts() {
  const uid = await getSessionUid();
  if (!uid) return [];
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return [];

  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);

  const rows = await db
    .select()
    .from(growthPosts)
    .where(
      and(
        eq(growthPosts.ownerId, ownerId),
        inArray(growthPosts.status, ['scheduled', 'published']),
        gte(growthPosts.scheduledAt, fromDate),
        lte(growthPosts.scheduledAt, toDate)
      )
    )
    .orderBy(asc(growthPosts.scheduledAt));

  return rows.map((row) => ({
    id: publicId(row),
    caption: row.caption,
    format: row.format,
    status: row.status as string,
    scheduledAt: row.scheduledAt?.toISOString() ?? '',
    brandSnapshot: row.brandSnapshot as { name: string },
  }));
}

export default async function CalendarioPage() {
  const posts = await getScheduledPosts();

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-poppins text-3xl font-bold tracking-tight text-foreground">Calendario</h1>
        <p className="mt-1 font-roboto text-sm text-muted-foreground">
          Vista de publicaciones programadas.
        </p>
      </header>
      <CalendarGrid posts={posts} />
    </div>
  );
}
