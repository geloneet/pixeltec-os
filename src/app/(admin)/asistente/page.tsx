import { redirect } from 'next/navigation';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getCurrentWeekTasks } from '@/lib/assistant/queries/tasks';
import { getCurrentWeekKey } from '@/lib/assistant/week-helpers';
import { AsistenteClient } from './asistente-client';

export default async function AsistentePage() {
  const uid = await getSessionUid();
  if (!uid) redirect('/login?redirect=/asistente');

  const [tasks, weekKey] = await Promise.all([
    getCurrentWeekTasks(uid),
    Promise.resolve(getCurrentWeekKey()),
  ]);

  return <AsistenteClient initialTasks={tasks} weekKey={weekKey} />;
}
