'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { performWeeklyRollover } from '../rollover';
import type { ActionResult } from '../schemas';

export async function forceRollover(): Promise<ActionResult<{
  reportId:              string;
  archivedCount:         number;
  generatedCount:        number;
  skippedGenerationCount: number;
}>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const result = await performWeeklyRollover({ uid, trigger: 'manual' });

  if (!result.ok) {
    return { ok: false, error: result.errors[0] ?? 'Error en rollover' };
  }

  revalidatePath('/asistente');
  revalidatePath('/asistente/templates');

  return {
    ok: true,
    data: {
      reportId:              result.reportId ?? '',
      archivedCount:         result.archivedCount,
      generatedCount:        result.generatedCount,
      skippedGenerationCount: result.skippedGenerationCount,
    },
  };
}
