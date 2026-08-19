/**
 * smilemore_qa_responses repository.
 *
 * Cuestionario de levantamiento de Smile More (/smilemoreqa). Igual que en
 * leads-repo: la escritura ocurre ANTES de cualquier notificación, para que
 * una falla de WhatsApp/email jamás pierda una respuesta del cliente.
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { smilemoreQaResponses, type SmilemoreQaResponse } from '@/lib/db/schema';
import type { SmilemoreQaAnswers } from '@/lib/smilemore-qa/definition';

export interface CreateSmilemoreQaResponseInput {
  respondentName: string;
  respondentRole?: string;
  branch?: string;
  systemUsage?: string;
  answers: SmilemoreQaAnswers;
  /** Raw UA string. Not classified as PII on its own under our retention policy. */
  userAgent?: string;
  /** Salted sha256 of the caller IP (`hashIp()` de `@/lib/privacy`) — never the raw address. */
  ipHash?: string;
}

/** Persist a new questionnaire response. Returns the generated row id. */
export async function createSmilemoreQaResponse(
  input: CreateSmilemoreQaResponseInput
): Promise<string> {
  const [row] = await db
    .insert(smilemoreQaResponses)
    .values({
      respondentName: input.respondentName,
      respondentRole: input.respondentRole ?? null,
      branch: input.branch ?? null,
      systemUsage: input.systemUsage ?? null,
      answers: input.answers,
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
    })
    .returning({ id: smilemoreQaResponses.id });
  return row.id;
}

/** Newest first — la vista admin lista todas (volumen esperado: unidades). */
export async function listSmilemoreQaResponses(): Promise<SmilemoreQaResponse[]> {
  return db
    .select()
    .from(smilemoreQaResponses)
    .orderBy(desc(smilemoreQaResponses.createdAt));
}

export async function getSmilemoreQaResponse(id: string): Promise<SmilemoreQaResponse | null> {
  const [row] = await db
    .select()
    .from(smilemoreQaResponses)
    .where(eq(smilemoreQaResponses.id, id))
    .limit(1);
  return row ?? null;
}
