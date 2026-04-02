'use server';
/**
 * @fileoverview Security Auditor Agent
 *
 * ROLE: Reviews every feature for security vulnerabilities before deployment.
 * RESPONSIBILITY: Firestore security rules review, input validation,
 *   XSS/injection risks, data exposure analysis.
 *
 * INPUT:  ProductSpec + BackendOutput + DatabaseSchema
 * OUTPUT: SecurityAudit (findings, severity, blockers, approvedForDeploy)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  ProductSpecSchema,
  BackendOutputSchema,
  DatabaseSchemaSchema,
  SecurityAuditSchema,
  type ProductSpec,
  type BackendOutput,
  type DatabaseSchema,
  type SecurityAudit,
} from '@/ai/types/agent-types';

const SecurityInputSchema = z.object({
  spec: ProductSpecSchema,
  backend: BackendOutputSchema,
  dbSchema: DatabaseSchemaSchema,
});
type SecurityInput = z.infer<typeof SecurityInputSchema>;

export async function runSecurityAuditorAgent(input: SecurityInput): Promise<SecurityAudit> {
  return securityAuditorFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const securityAuditorPrompt = ai.definePrompt({
  name: 'securityAuditorPrompt',
  input: { schema: SecurityInputSchema },
  output: { schema: SecurityAuditSchema },
  prompt: `Eres el Security Auditor de PixelTEC OS. Tu misión es detectar vulnerabilidades
de seguridad antes de que lleguen a producción. Eres meticuloso y no apruebas ningún
despliegue si hay hallazgos críticos o altos sin resolver.

## CONTEXTO DE SEGURIDAD ACTUAL

### Estado actual de Firestore Security Rules:
\`\`\`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Dashboard collections — cualquier usuario autenticado puede leer/escribir
    match /clients/{clientId}/{path=**} {
      allow read, write: if request.auth != null;
    }
    match /leads/{leadId} {
      allow read, write: if request.auth != null;
    }
    match /tickets/{ticketId} {
      allow read, write: if request.auth != null;
    }
    match /finances/{financeId} {
      allow read, write: if request.auth != null;
    }
    match /activity/{activityId} {
      allow read, write: if request.auth != null;
    }
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
    }
  }
}
\`\`\`

### Modelo de autenticación:
- Firebase Auth con roles custom claims: admin | member
- Roles almacenados en \`users/{uid}.role\`
- En cliente: \`useUserProfile()\` provee el rol
- NO hay verificación de rol en Firestore Rules actualmente (riesgo conocido)

## FEATURE A AUDITAR

**Feature ID:** {{{spec.featureId}}}
**Título:** {{{spec.title}}}
**Módulo:** {{{spec.module}}}

**Colecciones afectadas:** {{{spec.affectedCollections}}}

**Server Actions a revisar:**
{{#each backend.serverActions}}- {{{this.filePath}}}: {{{this.description}}}
{{/each}}

**New Firestore Rules propuestas:**
{{{dbSchema.securityRulesAddendum}}}

## TU TAREA

Audita exhaustivamente este feature en estas categorías:

### 1. Firestore Security Rules (\`firestore-rules\`):
- ¿Las nuevas colecciones tienen reglas adecuadas?
- ¿Se exponen datos sensibles a roles no autorizados?
- ¿Un \`member\` podría leer/escribir datos que solo debe ver \`admin\`?
- ¿Hay posibilidad de que un usuario lea documentos de otra empresa/cliente?
- ¿Las reglas propuestas bloquean writes maliciosos (campo injection)?

### 2. Autenticación (\`auth\`):
- ¿Las Server Actions verifican que \`request.auth != null\` antes de operar?
- ¿Se valida el rol del usuario en operaciones sensibles (delete, update finances)?
- ¿Hay endpoints que retornen datos de usuario sin validar identidad?

### 3. Validación de Input (\`input-validation\`):
- ¿Todos los inputs del formulario pasan por Zod antes de llegar a Firestore?
- ¿Se hace sanitización de strings antes de guardarlos?
- ¿Hay campos numéricos que podrían recibir strings maliciosos?
- ¿Los campos de tipo \`amount\` en finances tienen validación de rango?

### 4. XSS (\`xss\`):
- ¿Se renderizan strings de Firestore con \`dangerouslySetInnerHTML\`?
- ¿Los nombres de cliente/empresa se escapan correctamente al mostrarlos?
- ¿Se usan URLs de Firestore Storage directamente en \`src\` sin validación?

### 5. Exposición de Datos (\`data-exposure\`):
- ¿El cliente de Firestore expone colecciones que no debería?
- ¿Los logs de actividad registran información sensible (passwords, tokens)?
- ¿Las Server Actions retornan más datos de los necesarios?

## CRITERIOS DE APROBACIÓN

- **approvedForDeploy = true** solo si no hay hallazgos critical o high sin fix.
- **blockers**: lista de hallazgos que IMPIDEN el deploy (critical o high).
- Para hallazgos medium/low: documentar en recommendations, no bloquear.

Sé específico: referencia el archivo exacto y la línea problemática si la conoces.
Proporciona el código corregido en \`codeExample\` para cada hallazgo.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const securityAuditorFlow = ai.defineFlow(
  {
    name: 'securityAuditorFlow',
    inputSchema: SecurityInputSchema,
    outputSchema: SecurityAuditSchema,
  },
  async (input) => {
    const { output } = await securityAuditorPrompt(input);
    return output!;
  }
);
