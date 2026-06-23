import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { CalendarGrid } from '@/components/growth/calendar/CalendarGrid';

async function getScheduledPosts() {
  const uid = await getSessionUid();
  if (!uid) return [];

  const db = getFirestore(getAdminApp());
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);

  const snap = await db
    .collection('growthPosts')
    .where('uid', '==', uid)
    .where('status', 'in', ['scheduled', 'published'])
    .where('scheduledAt', '>=', Timestamp.fromDate(fromDate))
    .where('scheduledAt', '<=', Timestamp.fromDate(toDate))
    .orderBy('scheduledAt', 'asc')
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    caption: doc.data().caption as string,
    format: doc.data().format as string,
    status: doc.data().status as string,
    scheduledAt: (doc.data().scheduledAt as Timestamp)?.toDate?.()?.toISOString() ?? '',
    brandSnapshot: doc.data().brandSnapshot as { name: string },
  }));
}

export default async function CalendarioPage() {
  const posts = await getScheduledPosts();

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">Calendario</h1>
        <p className="mt-1 font-roboto text-sm text-zinc-500">
          Vista de publicaciones programadas.
        </p>
      </header>
      <CalendarGrid posts={posts} />
    </div>
  );
}
