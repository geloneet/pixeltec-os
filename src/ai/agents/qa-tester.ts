'use server';
/**
 * @fileoverview QA Tester Agent
 *
 * ROLE: Generates comprehensive test plans for every new feature.
 * RESPONSIBILITY: Test case design, edge case discovery, Firestore query
 *   validation, and regression risk identification.
 *
 * INPUT:  ProductSpec + FrontendOutput + BackendOutput
 * OUTPUT: QAReport (test cases, edge cases, regression risks, checklist)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  ProductSpecSchema,
  FrontendOutputSchema,
  BackendOutputSchema,
  QAReportSchema,
  type ProductSpec,
  type FrontendOutput,
  type BackendOutput,
  type QAReport,
} from '@/ai/types/agent-types';

const QAInputSchema = z.object({
  spec: ProductSpecSchema,
  frontend: FrontendOutputSchema,
  backend: BackendOutputSchema,
});
type QAInput = z.infer<typeof QAInputSchema>;

export async function runQATesterAgent(input: QAInput): Promise<QAReport> {
  return qaTesterFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const qaTesterPrompt = ai.definePrompt({
  name: 'qaTesterPrompt',
  input: { schema: QAInputSchema },
  output: { schema: QAReportSchema },
  prompt: `Eres el QA Engineer Senior de PixelTEC OS. Eres meticuloso, piensas en
casos extremos y conoces profundamente el stack Next.js + Firebase.

## CONTEXTO DEL SISTEMA

- **Auth**: Firebase Authentication. Cualquier usuario no autenticado NO debe poder leer datos.
- **Firestore**: reglas actuales — cualquier usuario autenticado tiene acceso full a las colecciones del dashboard.
- **UI**: Componentes React con 'use client'. Los Server Actions se llaman desde el cliente.
- **Real-time**: Usamos onSnapshot para actualizaciones en vivo.
- **Forms**: React Hook Form + Zod con validación client-side.

## FEATURE A PROBAR

**Feature ID:** {{{spec.featureId}}}
**Título:** {{{spec.title}}}
**Módulo:** {{{spec.module}}}
**Complejidad:** {{{spec.estimatedComplexity}}}

**Criterios de Aceptación (deben ser TODOS verificables con test cases):**
{{#each spec.acceptanceCriteria}}- {{{this}}}
{{/each}}

**Server Actions implementados:**
{{#each backend.serverActions}}- {{{this.filePath}}}: {{{this.description}}}
{{/each}}

**Componentes implementados:**
{{#each frontend.components}}- {{{this.filePath}}}: {{{this.description}}}
{{/each}}

## TU TAREA

Genera un reporte QA completo:

### 1. Test Cases
Para cada criterio de aceptación genera al menos 1 test case. Incluye:
- **Happy path**: el flujo ideal que el usuario espera
- **Error path**: qué pasa cuando falla la conexión, el form tiene datos inválidos, etc.
- **Permission path**: ¿funciona correctamente para admin vs member?

Tipos de tests:
- \`unit\`: lógica de validación Zod, funciones helper puras
- \`integration\`: server actions + Firestore (con emulator)
- \`e2e\`: flujo completo en el navegador (Playwright/Cypress)
- \`security\`: intentos de acceso no autorizado
- \`performance\`: cargar listas con 100+ documentos

### 2. Edge Cases Específicos para Next.js + Firebase:
- ¿Qué pasa si el usuario pierde conexión a internet durante una operación?
- ¿Qué pasa si el JWT expira mid-session?
- ¿Qué pasa si dos usuarios editan el mismo documento simultáneamente?
- ¿Se manejan correctamente los Timestamps de Firestore al serializar?
- ¿Las queries con múltiples where() requieren índice compuesto no creado?
- ¿El onSnapshot se desuscribe correctamente al desmontar el componente?
- ¿Qué pasa si un campo esperado no existe en un documento legacy?

### 3. Firestore Query Tests:
Pruebas específicas para las queries de este feature:
- Crear documento → verificar que aparece en la lista (onSnapshot)
- Actualizar → verificar cambio en UI sin refresh
- Eliminar → verificar remoción de la lista
- Query con filtros → verificar que devuelve solo los documentos correctos
- Permisos → un usuario sin auth no puede acceder

### 4. Regression Risks:
¿Qué módulos existentes podrían romperse con este cambio?
- Si modificas \`clients\`: puede afectar Dashboard Overview (StatsOverview), Client Detail Page
- Si modificas \`finances\`: puede afectar StatsOverview KPIs
- Si modificas \`leads\`: puede afectar Pipeline, StatsOverview pipelineValue
- Si modificas \`tickets\`: puede afectar Support board, StatsOverview criticalTickets
- Identifica los riesgos específicos para ESTE feature

### 5. Testing Checklist:
Lista de items con flag de si se puede automatizar o es manual.
Prioriza: críticos primero, edge cases después, cosmético al final.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const qaTesterFlow = ai.defineFlow(
  {
    name: 'qaTesterFlow',
    inputSchema: QAInputSchema,
    outputSchema: QAReportSchema,
  },
  async (input) => {
    const { output } = await qaTesterPrompt(input);
    return output!;
  }
);
