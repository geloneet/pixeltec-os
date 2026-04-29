import { redirect } from 'next/navigation';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getCurrentWeekTasks } from '@/lib/assistant/queries/tasks';
import { getCurrentWeekKey } from '@/lib/assistant/week-helpers';
import { getRecentReports } from '@/lib/assistant/queries/reports';
import { AsistenteClient } from './asistente-client';

export default async function AsistentePage() {
  const uid = await getSessionUid();
  if (!uid) redirect('/login?redirect=/asistente');

  const weekKey = getCurrentWeekKey();
  const [tasks, reports] = await Promise.all([
    getCurrentWeekTasks(uid),
    getRecentReports(uid, 1),
  ]);

  return (
    <AsistenteClient
      initialTasks={tasks}
      weekKey={weekKey}
      lastReport={reports[0] ?? null}
    />
  );
}
