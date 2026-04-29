import { redirect } from 'next/navigation';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getTemplates } from '@/lib/assistant/queries/templates';
import { TemplatesClient } from './templates-client';

export default async function TemplatesPage() {
  const uid = await getSessionUid();
  if (!uid) redirect('/login?redirect=/asistente/templates');

  const templates = await getTemplates(uid);
  return <TemplatesClient templates={templates} />;
}
