'use server';
/**
 * @fileoverview DevOps Agent  [NEW AGENT]
 *
 * ROLE: Generates deployment configuration and release checklists.
 * RESPONSIBILITY: apphosting.yaml, environment variables, Firebase indexes,
 *   deployment checklist, rollback plan.
 *
 * INPUT:  FixerOutput + DatabaseSchema (for indexes)
 * OUTPUT: CodeArtifact[] (config files) + deployment checklist
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  FixerOutputSchema,
  DatabaseSchemaSchema,
  ProductSpecSchema,
  CodeArtifactSchema,
  type FixerOutput,
  type DatabaseSchema,
  type ProductSpec,
} from '@/ai/types/agent-types';

const DevOpsInputSchema = z.object({
  spec: ProductSpecSchema,
  fixes: FixerOutputSchema,
  dbSchema: DatabaseSchemaSchema,
});

const DevOpsOutputSchema = z.object({
  featureId: z.string(),
  configFiles: z.array(CodeArtifactSchema)
    .describe('Updated config files: apphosting.yaml, firestore.indexes.json, etc.'),
  deploymentChecklist: z.array(z.object({
    step: z.number(),
    action: z.string(),
    command: z.string().optional(),
    verification: z.string(),
    rollbackCommand: z.string().optional(),
  })),
  environmentVariables: z.array(z.object({
    key: z.string(),
    description: z.string(),
    required: z.boolean(),
    example: z.string(),
  })),
  rollbackPlan: z.array(z.string()),
  estimatedDowntime: z.string(),
});

export type DevOpsOutput = z.infer<typeof DevOpsOutputSchema>;

export async function runDevOpsAgent(
  input: z.infer<typeof DevOpsInputSchema>
): Promise<DevOpsOutput> {
  return devOpsFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const devOpsPrompt = ai.definePrompt({
  name: 'devOpsPrompt',
  input: { schema: DevOpsInputSchema },
  output: { schema: DevOpsOutputSchema },
  prompt: `Eres el DevOps Engineer de PixelTEC OS. Tu misión es asegurar que
cada feature llegue a producción de forma controlada, segura y reversible.

## INFRAESTRUCTURA ACTUAL

- **Hosting**: Firebase App Hosting (apphosting.yaml)
- **Base de datos**: Firebase Firestore (North America - us-central1)
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage (firebasestorage.googleapis.com)
- **Framework**: Next.js 15 con Turbopack
- **CI/CD**: Firebase App Hosting auto-deploys desde GitHub main branch
- **AI**: Genkit con Google AI (Gemini 2.5 Flash)

## apphosting.yaml actual:
\`\`\`yaml
# Firebase App Hosting configuration
runConfig:
  cpu: 1
  memoryMiB: 512
  maxInstances: 10
  concurrency: 80
\`\`\`

## FEATURE A DESPLEGAR: {{{spec.featureId}}} — {{{spec.title}}}

**¿Listo para release?** {{{fixes.readyForRelease}}}

**Issues pendientes:**
{{#each fixes.remainingIssues}}- {{{this}}}
{{/each}}

**Nuevos índices Firestore requeridos:**
{{#each dbSchema.newCollections}}
{{#if this.compositeIndexes}}
Colección {{{this.path}}}: {{#each this.compositeIndexes}}{{{this}}}{{/each}}
{{/if}}
{{/each}}

**Variables de entorno posiblemente nuevas:**
Analiza el feature y determina si requiere nuevas env vars.

## TU TAREA

1. **Config Files**:
   - Si hay nuevos índices compuestos, genera \`firestore.indexes.json\` completo
   - Si hay cambios en runtime (más memoria, etc.), actualiza \`apphosting.yaml\`
   - Si hay nuevas variables de entorno, documéntalas

2. **Deployment Checklist** (en orden estricto):
   - Pre-deploy: Firestore backup, index creation, env vars set
   - Deploy: comandos exactos con \`firebase\` CLI
   - Post-deploy: verificaciones smoke test
   - Cada paso con: acción, comando CLI exacto, cómo verificar éxito

3. **Rollback Plan**:
   - Pasos para revertir si el deploy falla
   - Cómo restaurar Firestore si hay datos corruptos
   - Cómo hacer un hotfix rápido

4. **Environment Variables**:
   - Lista todas las env vars que necesita el feature
   - NEXT_PUBLIC_* para client-side
   - Sin NEXT_PUBLIC_* para server-only
   - Ejemplo de valor (nunca el valor real)

Formato de comandos: usa Firebase CLI v13+ y Next.js build commands del package.json.
\`\`\`
npm run build     → next build
npm run start     → next start
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
\`\`\`

El deploy a App Hosting es automático via git push a main.
Tu checklist debe incluir el PR merge como paso de deploy.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const devOpsFlow = ai.defineFlow(
  {
    name: 'devOpsFlow',
    inputSchema: DevOpsInputSchema,
    outputSchema: DevOpsOutputSchema,
  },
  async (input) => {
    const { output } = await devOpsPrompt(input);
    return output!;
  }
);
