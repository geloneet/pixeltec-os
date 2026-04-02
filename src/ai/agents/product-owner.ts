'use server';
/**
 * @fileoverview Product Owner Agent
 *
 * ROLE: Translates raw feature requests into structured product specs.
 * RESPONSIBILITY: Business justification, user stories, acceptance criteria,
 *   complexity estimation, and scope boundaries.
 *
 * INPUT:  FeatureRequest (title + description + module + priority)
 * OUTPUT: ProductSpec    (user stories, AC, affected collections/routes)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  FeatureRequestSchema,
  ProductSpecSchema,
  type FeatureRequest,
  type ProductSpec,
} from '@/ai/types/agent-types';

export async function runProductOwnerAgent(input: FeatureRequest): Promise<ProductSpec> {
  return productOwnerFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const productOwnerPrompt = ai.definePrompt({
  name: 'productOwnerPrompt',
  input: { schema: FeatureRequestSchema },
  output: { schema: ProductSpecSchema },
  prompt: `Eres el Product Owner de PixelTEC OS, un ERP/CRM empresarial construido con Next.js 15 (App Router),
Firebase Firestore y Tailwind CSS.

Tu misión es tomar una solicitud de feature cruda y convertirla en una especificación de producto
estructurada, precisa y lista para que el equipo de ingeniería la ejecute.

## CONTEXTO DEL SISTEMA

Módulos existentes: Dashboard Overview, Directorio de Clientes (con sub-ruta /clients/[id]),
Tareas, Pipeline de Ventas (leads), Finanzas (transactions), Analytics, Soporte (tickets).

Colecciones Firestore existentes: \`clients\`, \`projects\`, \`leads\`, \`tickets\`, \`finances\`, \`activity\`, \`tasks\`.
Sub-colecciones conocidas: \`clients/{id}/tasks\`, \`clients/{id}/notes\`, \`clients/{id}/documents\`.

Stack de UI: Tailwind CSS dark premium (bg-black, rounded-[2rem], border-white/5),
acentos cyan-400 y lime-400, componentes Radix UI, Framer Motion para animaciones.

## SOLICITUD A PROCESAR

**Módulo afectado:** {{{module}}}
**Solicitado por:** {{{requestedBy}}}
**Título:** {{{title}}}
**Descripción:**
{{{description}}}

{{#if acceptanceCriteria}}
**Criterios ya conocidos por el solicitante:**
{{#each acceptanceCriteria}}- {{{this}}}
{{/each}}
{{/if}}

## TU TAREA

1. Asigna un featureId único en formato kebab-case (máx 4 palabras).
2. Define la prioridad de negocio basándote en el impacto y el módulo afectado.
3. Escribe 2-4 user stories en formato "As a [role], I want [goal] so that [reason]".
4. Define 4-6 criterios de aceptación medibles y verificables.
5. Lista explícitamente qué está fuera de scope para evitar scope creep.
6. Estima la complejidad: xs (< 2h), s (< 8h), m (< 24h), l (< 80h), xl (> 80h).
7. Identifica qué colecciones de Firestore y rutas Next.js serán afectadas.

Sé específico al sistema PixelTEC. No des respuestas genéricas.`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const productOwnerFlow = ai.defineFlow(
  {
    name: 'productOwnerFlow',
    inputSchema: FeatureRequestSchema,
    outputSchema: ProductSpecSchema,
  },
  async (input) => {
    const { output } = await productOwnerPrompt(input);
    return output!;
  }
);
