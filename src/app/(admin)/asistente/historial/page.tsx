import { redirect } from 'next/navigation';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getReportsRange } from '@/lib/assistant/queries/reports';
import { reportToCell, computeStats } from '@/lib/assistant/history-stats';
import { HistorialClient } from './historial-client';

export const metadata = { title: 'Historial — Asistente' };

export default async function HistorialPage() {
  const uid = await getSessionUid();
  if (!uid) redirect('/login?redirect=/asistente/historial');

  const { reports, nextCursor } = await getReportsRange(uid, { limit: 12 });

  const recent4 = reports.slice(0, 4);
  const prev4   = reports.slice(4, 8);
  const stats   = computeStats(recent4, prev4);
  const initialCells = reports.map(reportToCell);

  return (
    <HistorialClient
      initialCells={initialCells}
      initialCursor={nextCursor}
      initialStats={stats}
    />
  );
}
