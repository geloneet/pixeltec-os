import { notFound, redirect } from 'next/navigation';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getTemplateById } from '@/lib/assistant/queries/templates';
import { TemplateFormClient } from '../../_components/template-form-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarTemplatePage({ params }: Props) {
  const { id } = await params;
  const uid = await getSessionUid();
  if (!uid) redirect('/login?redirect=/asistente/templates');

  const template = await getTemplateById(uid, id);
  if (!template) notFound();

  return <TemplateFormClient mode="edit" template={template} />;
}
