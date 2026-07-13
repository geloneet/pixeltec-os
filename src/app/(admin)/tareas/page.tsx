import { redirect } from 'next/navigation';
import { getSessionUid } from '@/lib/auth/session';
import { getCurrentWeekTasks } from '@/lib/assistant/queries/tasks';
import { getCurrentWeekKey } from '@/lib/assistant/week-helpers';
import { getRecentReports } from '@/lib/assistant/queries/reports';
import { TareasClient } from './tareas-client';

export default async function TareasPage() {
  const uid = await getSessionUid();
  if (!uid) redirect('/login?redirect=/tareas');

  const weekKey = getCurrentWeekKey();
  const [tasks, reports] = await Promise.all([
    getCurrentWeekTasks(uid),
    getRecentReports(uid, 1),
  ]);

  return (
    <TareasClient
      initialTasks={tasks}
      weekKey={weekKey}
      lastReport={reports[0] ?? null}
    />
  );
}
