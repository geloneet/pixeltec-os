'use server';
/**
 * @fileoverview Database Architect Agent
 *
 * ROLE: Designs the Firestore data model for a new feature.
 * RESPONSIBILITY: Collection/document schemas, composite indexes,
 *   security rules addendum, and migration notes.
 *
 * INPUT:  ProductSpec + ProjectPlan (for context)
 * OUTPUT: DatabaseSchema (collections, fields, rules, migration)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  ProductSpecSchema,
  DatabaseSchemaSchema,
  type ProductSpec,
  type DatabaseSchema,
} from '@/ai/types/agent-types';

export async function runDatabaseArchitectAgent(input: ProductSpec): Promise<DatabaseSchema> {
  return dbArchitectFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const dbArchitectPrompt = ai.definePrompt({
  name: 'dbArchitectPrompt',
  input: { schema: ProductSpecSchema },
  output: { schema: DatabaseSchemaSchema },
  prompt: `Eres el Database Architect de PixelTEC OS. Eres experto en modelado NoSQL
con Firebase Firestore. Tu prioridad es diseñar esquemas eficientes, seguros y escalables.

## ESQUEMA FIRESTORE ACTUAL

### Colecciones globales:
- \`clients/{clientId}\`: companyName, status (Lead|Activo), techStack[], contactName,
  contactEmail, contactPhone, plan, startDate, color, logoUrl
- \`clients/{clientId}/tasks/{taskId}\`: title, completed, createdAt
- \`clients/{clientId}/notes/{noteId}\`: content, createdAt, author
- \`clients/{clientId}/documents/{docId}\`: name, url, type, uploadedAt
- \`projects/{projectId}\`: title, description, clientId, status, deadline, columns[]
- \`leads/{leadId}\`: companyName, contactName, stage, estimatedValue, notes, createdAt
- \`tickets/{ticketId}\`: title, description, clientId, estado, prioridad, createdAt, resolvedAt
- \`finances/{financeId}\`: description, amount, type (ingreso|egreso), status (Pagado|Pendiente),
  date, category, clientId
- \`activity/{activityId}\`: type, description, clientId, timestamp, userId
- \`tasks/{taskId}\`: title, completed, clientId, projectId, assignedTo, dueDate (global tasks)
- \`users/{userId}\`: displayName, email, role (admin|member), createdAt

### Reglas actuales:
- Cualquier usuario autenticado puede leer/escribir en todas las colecciones del dashboard.
- Solo el propio usuario puede leer/escribir su documento en \`users/\`.

## FEATURE A MODELAR

**Feature ID:** {{{featureId}}}
**Título:** {{{title}}}
**Colecciones mencionadas:** {{{affectedCollections}}}
**Complejidad:** {{{estimatedComplexity}}}

**User Stories:**
{{#each userStories}}- {{{this}}}
{{/each}}

**Criterios de Aceptación:**
{{#each acceptanceCriteria}}- {{{this}}}
{{/each}}

## TU TAREA

1. **Diseña los nuevos documentos/colecciones** necesarios. Para cada campo incluye:
   - Nombre, tipo exacto de Firestore, si es requerido, descripción, y si necesita índice.

2. **Identifica modificaciones** a colecciones existentes. Justifica cada campo nuevo/eliminado.

3. **Índices compuestos**: Si el feature requiere queries con múltiples where() u orderBy(),
   especifica los índices compuestos necesarios en formato:
   "collection: field1 ASC, field2 DESC"

4. **Security Rules Addendum**: Escribe las reglas nuevas en sintaxis correcta de Firestore.
   Por defecto, usa \`request.auth != null\` pero si hay datos sensibles, sé más restrictivo.
   Ejemplo: para que solo el dueño lea sus datos: \`request.auth.uid == resource.data.userId\`

5. **Migration Notes**: Si modificas campos existentes, especifica los pasos para migrar
   documentos existentes sin romper la app.

### PRINCIPIOS DE DISEÑO FIRESTORE:
- Prefiere sub-colecciones sobre arrays de objetos cuando > 10 items.
- Denormaliza solo si el read es muy frecuente vs el write.
- Evita referencias circulares (documentReference apuntando a otro documentReference).
- Los campos de fecha siempre como Timestamp, nunca string.
- Los campos de dinero siempre como number (centavos o MXN directo, sé consistente).`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const dbArchitectFlow = ai.defineFlow(
  {
    name: 'dbArchitectFlow',
    inputSchema: ProductSpecSchema,
    outputSchema: DatabaseSchemaSchema,
  },
  async (input) => {
    const { output } = await dbArchitectPrompt(input);
    return output!;
  }
);
