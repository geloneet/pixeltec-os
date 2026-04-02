'use server';
/**
 * @fileoverview Backend Developer Agent
 *
 * ROLE: Generates production-ready server-side code for new features.
 * RESPONSIBILITY: Next.js Server Actions, Firestore helpers, Zod validation
 *   schemas, and activity log integration.
 *
 * INPUT:  ProductSpec + DatabaseSchema
 * OUTPUT: BackendOutput (server actions, helpers, zod schemas as code strings)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  ProductSpecSchema,
  DatabaseSchemaSchema,
  BackendOutputSchema,
  type ProductSpec,
  type DatabaseSchema,
  type BackendOutput,
} from '@/ai/types/agent-types';

const BackendInputSchema = z.object({
  spec: ProductSpecSchema,
  dbSchema: DatabaseSchemaSchema,
});
type BackendInput = z.infer<typeof BackendInputSchema>;

export async function runBackendDeveloperAgent(input: BackendInput): Promise<BackendOutput> {
  return backendDeveloperFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const backendDeveloperPrompt = ai.definePrompt({
  name: 'backendDeveloperPrompt',
  input: { schema: BackendInputSchema },
  output: { schema: BackendOutputSchema },
  prompt: `Eres el Backend Developer Senior de PixelTEC OS. Escribes código TypeScript
de producción. Tu código es limpio, tipado, y sigue los patrones exactos del proyecto.

## PATRONES DEL PROYECTO

### Server Actions (src/app/actions.ts pattern):
\`\`\`typescript
'use server';
import { adminDb } from '@/firebase/admin'; // Para server-side
// O para client components que usan server actions:
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
\`\`\`

### Hook de Firestore en cliente:
\`\`\`typescript
import { useFirestore } from '@/firebase';
const firestore = useFirestore();
\`\`\`

### Actividad Log (SIEMPRE al crear/modificar entidades importantes):
\`\`\`typescript
import { createLog } from '@/utils/createLog';
await createLog(firestore, {
  type: 'feature_action',  // descriptivo
  description: 'Mensaje legible por humanos',
  clientId: clientId,  // si aplica
  userId: user.uid,    // si aplica
});
\`\`\`

### Zod schemas con genkit z:
\`\`\`typescript
import { z } from 'zod'; // usa zod estándar para forms, no genkit z
\`\`\`

### Convenciones de naming:
- Server actions: verbNoun (createInvoice, updateTicketStatus, deleteProject)
- Firestore collections: camelCase plural (invoices, clientDocuments)
- Timestamps: siempre serverTimestamp() para createdAt/updatedAt

## FEATURE A IMPLEMENTAR

**Feature ID:** {{{spec.featureId}}}
**Título:** {{{spec.title}}}
**Colecciones afectadas:** {{{spec.affectedCollections}}}

**User Stories:**
{{#each spec.userStories}}- {{{this}}}
{{/each}}

**Criterios de Aceptación:**
{{#each spec.acceptanceCriteria}}- {{{this}}}
{{/each}}

**Esquema de Base de Datos diseñado:**
Nuevas colecciones: {{#each dbSchema.newCollections}}{{{this.path}}}{{/each}}
Colecciones modificadas: {{#each dbSchema.modifiedCollections}}{{{this.path}}}{{/each}}

## TU TAREA

Genera el código completo para:

1. **Server Actions** (\`src/app/actions/[feature].ts\`):
   - Funciones async con 'use server' al inicio del archivo
   - Cada acción: validación con Zod, operación Firestore, log de actividad, manejo de errores
   - Retorna \`{ success: boolean, data?: T, error?: string }\`

2. **Firestore Helpers** (\`src/firebase/firestore/[feature]-helpers.ts\`):
   - Funciones puras para queries complejas
   - Tipos TypeScript para los documentos (interfaces, no clases)
   - onSnapshot subscriptions si el feature necesita real-time

3. **Zod Schemas** (\`src/lib/schemas/[feature].ts\`):
   - Schema de validación para formularios React Hook Form
   - Tipos inferidos con \`z.infer\`
   - Mensajes de error en español

IMPORTANTE:
- NO uses cualquier API key o secreto hardcodeado.
- Cada archivo debe ser completo y ejecutable (no pseudocódigo).
- Manejo de errores con try/catch en todas las server actions.
- Registra actividad en la colección \`activity\` para acciones CRUD importantes.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const backendDeveloperFlow = ai.defineFlow(
  {
    name: 'backendDeveloperFlow',
    inputSchema: BackendInputSchema,
    outputSchema: BackendOutputSchema,
  },
  async (input) => {
    const { output } = await backendDeveloperPrompt(input);
    return output!;
  }
);
