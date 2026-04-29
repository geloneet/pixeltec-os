import { notFound, redirect } from 'next/navigation';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getReportByWeekKey } from '@/lib/assistant/queries/reports';
import { getArchivedTasksByWeek } from '@/lib/assistant/queries/archive';
import { WeekDetailClient } from './week-detail-client';

interface Props {
  params: Promise<{ weekKey: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { weekKey } = await params;
  return { title: `${weekKey} — Historial Asistente` };
}

export default async function WeekDetailPage({ params }: Props) {
  const uid = await getSessionUid();
  if (!uid) redirect('/login?redirect=/asistente/historial');

  const { weekKey } = await params;

  const [report, tasks] = await Promise.all([
    getReportByWeekKey(uid, weekKey),
    getArchivedTasksByWeek(uid, weekKey),
  ]);

  if (!report) notFound();

  return <WeekDetailClient report={report} tasks={tasks} />;
}
