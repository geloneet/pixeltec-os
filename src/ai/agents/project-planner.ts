'use server';
/**
 * @fileoverview Project Planner Agent
 *
 * ROLE: Decomposes a ProductSpec into an executable project plan.
 * RESPONSIBILITY: Task breakdown, agent assignments, dependency graph,
 *   critical path analysis, risk identification, and milestone definition.
 *
 * INPUT:  ProductSpec
 * OUTPUT: ProjectPlan (tasks with dependencies, estimates, milestones)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  ProductSpecSchema,
  ProjectPlanSchema,
  type ProductSpec,
  type ProjectPlan,
} from '@/ai/types/agent-types';

export async function runProjectPlannerAgent(input: ProductSpec): Promise<ProjectPlan> {
  return projectPlannerFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const projectPlannerPrompt = ai.definePrompt({
  name: 'projectPlannerPrompt',
  input: { schema: ProductSpecSchema },
  output: { schema: ProjectPlanSchema },
  prompt: `Eres el Tech Lead / Project Manager de PixelTEC OS. Tu nombre es Miguel Robles.
Recibes una especificación de producto ya validada y debes generar un plan de ejecución
técnico, detallado y ordenado por dependencias.

## EQUIPO DISPONIBLE (agentes)

- **ProductOwner**: Clarificación de requisitos, redefinición de scope.
- **DatabaseArchitect**: Diseño de colecciones Firestore, índices, security rules.
- **BackendDeveloper**: Server Actions de Next.js, lógica de Firebase, Zod schemas.
- **FrontendDeveloper**: Componentes React/Tailwind, páginas, animaciones Framer Motion.
- **QATester**: Casos de prueba, edge cases, validación de reglas de Firestore.
- **SecurityAuditor**: Revisión de security rules, XSS, exposición de datos.
- **FixerAgent**: Corrección de bugs encontrados por QA o Security.
- **DevOpsAgent**: Firebase deployment, environment variables, apphosting.yaml.

## ESPECIFICACIÓN A PLANIFICAR

**Feature ID:** {{{featureId}}}
**Título:** {{{title}}}
**Complejidad estimada:** {{{estimatedComplexity}}}
**Prioridad:** {{{priority}}}
**Colecciones afectadas:** {{{affectedCollections}}}
**Rutas afectadas:** {{{affectedRoutes}}}

**User Stories:**
{{#each userStories}}- {{{this}}}
{{/each}}

**Criterios de Aceptación:**
{{#each acceptanceCriteria}}- {{{this}}}
{{/each}}

**Fuera de Scope:**
{{#each outOfScope}}- {{{this}}}
{{/each}}

## TU TAREA

1. Descompón el feature en tareas atómicas (máx 8h por tarea).
2. Asigna cada tarea al agente correcto usando EXACTAMENTE los nombres del enum.
3. Define dependencias realistas — la mayoría del frontend depende del backend.
4. La DatabaseArchitect SIEMPRE va antes del BackendDeveloper.
5. El SecurityAuditor SIEMPRE revisa antes del DevOpsAgent.
6. El QATester va después de Frontend Y Backend.
7. Identifica el camino crítico (las tareas que si se retrasan, retrasan todo).
8. Define milestones lógicos (DB Ready, API Ready, UI Ready, QA Passed, Deployed).
9. Lista riesgos técnicos específicos al stack Next.js + Firebase.

Los IDs de tarea deben seguir el formato: {{{featureId}}}-T01, {{{featureId}}}-T02, etc.
El outputArtifact debe ser la ruta exacta del archivo que producirá esa tarea.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const projectPlannerFlow = ai.defineFlow(
  {
    name: 'projectPlannerFlow',
    inputSchema: ProductSpecSchema,
    outputSchema: ProjectPlanSchema,
  },
  async (input) => {
    const { output } = await projectPlannerPrompt(input);
    return output!;
  }
);
