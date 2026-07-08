'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `ia_templates` vía
// client SDK. `extractVariables` se movió a ./template-vars (es síncrona y la
// usa también el cliente).
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { iaTemplates } from "@/lib/db/schema";
import type { IATemplate, IATemplateType } from "@/types/documents";
import { extractVariables } from "./template-vars";
import { requireOwner, resolveIATemplateRow, serializeIATemplate } from "./pg";

export async function getTemplates(_uid: string, type?: IATemplateType): Promise<IATemplate[]> {
  const { uid, ownerId } = await requireOwner();
  const conds = [eq(iaTemplates.ownerId, ownerId)];
  if (type) conds.push(eq(iaTemplates.type, type));
  const rows = await db
    .select()
    .from(iaTemplates)
    .where(and(...conds))
    .orderBy(desc(iaTemplates.createdAt));
  return rows.map((row) => serializeIATemplate(row, uid));
}

export async function createTemplate(
  _uid: string,
  data: Omit<IATemplate, "id" | "uid" | "createdAt" | "updatedAt">,
): Promise<string> {
  const { ownerId } = await requireOwner();
  const [row] = await db
    .insert(iaTemplates)
    .values({
      ownerId,
      type: data.type,
      name: data.name,
      description: data.description ?? "",
      content: data.content,
      variables: extractVariables(data.content),
      industry: data.industry ?? null,
      isDefault: data.isDefault ?? false,
      aiSystemPrompt: data.aiSystemPrompt ?? null,
      version: data.version ?? 1,
    })
    .returning({ id: iaTemplates.id });
  return row.id;
}

export async function updateTemplate(
  id: string,
  data: Partial<Omit<IATemplate, "id" | "uid" | "createdAt">>,
): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveIATemplateRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Plantilla no encontrada");

  const set: Partial<typeof iaTemplates.$inferInsert> = { updatedAt: new Date() };
  if (data.type !== undefined) set.type = data.type;
  if (data.name !== undefined) set.name = data.name;
  if (data.description !== undefined) set.description = data.description;
  if (data.industry !== undefined) set.industry = data.industry;
  if (data.isDefault !== undefined) set.isDefault = data.isDefault;
  if (data.aiSystemPrompt !== undefined) set.aiSystemPrompt = data.aiSystemPrompt;
  if (data.version !== undefined) set.version = data.version;
  if (data.variables !== undefined) set.variables = data.variables;
  if (data.content !== undefined) {
    set.content = data.content;
    set.variables = extractVariables(data.content);
  }

  await db.update(iaTemplates).set(set).where(eq(iaTemplates.id, row.id));
}

export async function deleteTemplate(id: string): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveIATemplateRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Plantilla no encontrada");
  await db.delete(iaTemplates).where(eq(iaTemplates.id, row.id));
}
