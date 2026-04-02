'use server';
/**
 * @fileoverview Fixer Agent
 *
 * ROLE: Resolves blockers found by QA Tester and Security Auditor.
 * RESPONSIBILITY: Root cause analysis, targeted code fixes, prevention strategy.
 *
 * INPUT:  QAReport + SecurityAudit + BackendOutput + FrontendOutput
 * OUTPUT: FixerOutput (fixes per issue, readyForRelease flag)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  QAReportSchema,
  SecurityAuditSchema,
  BackendOutputSchema,
  FrontendOutputSchema,
  FixerOutputSchema,
  type QAReport,
  type SecurityAudit,
  type BackendOutput,
  type FrontendOutput,
  type FixerOutput,
} from '@/ai/types/agent-types';

const FixerInputSchema = z.object({
  featureId: z.string(),
  qaReport: QAReportSchema,
  securityAudit: SecurityAuditSchema,
  backend: BackendOutputSchema,
  frontend: FrontendOutputSchema,
});
type FixerInput = z.infer<typeof FixerInputSchema>;

export async function runFixerAgent(input: FixerInput): Promise<FixerOutput> {
  return fixerFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const fixerPrompt = ai.definePrompt({
  name: 'fixerPrompt',
  input: { schema: FixerInputSchema },
  output: { schema: FixerOutputSchema },
  prompt: `Eres el Fixer Agent de PixelTEC OS — el desarrollador que entra cuando
hay bugs críticos bloqueando el release. Eres metódico: analizas la causa raíz
antes de escribir una sola línea de código.

## FEATURE A REPARAR: {{{featureId}}}

## HALLAZGOS DE SEGURIDAD (BLOQUEANTES PRIMERO):

**Riesgo General:** {{{securityAudit.overallRisk}}}
**Aprobado para deploy:** {{{securityAudit.approvedForDeploy}}}

**Blockers de Seguridad:**
{{#each securityAudit.blockers}}- {{{this}}}
{{/each}}

**Hallazgos detallados:**
{{#each securityAudit.findings}}
[{{{this.severity}}}] {{{this.category}}}: {{{this.description}}}
Ubicación: {{{this.location}}}
Recomendación: {{{this.recommendation}}}
{{/each}}

## HALLAZGOS DE QA:

**Edge Cases críticos:**
{{#each qaReport.edgeCases}}- {{{this}}}
{{/each}}

**Riesgos de Regresión:**
{{#each qaReport.regressionRisks}}- {{{this}}}
{{/each}}

## CÓDIGO IMPLEMENTADO (contexto):

**Server Actions:**
{{#each backend.serverActions}}- {{{this.filePath}}}: {{{this.description}}}
{{/each}}

**Componentes Frontend:**
{{#each frontend.components}}- {{{this.filePath}}}: {{{this.description}}}
{{/each}}

## TU TAREA

Para cada issue encontrado (prioriza critical > high > medium):

1. **Root Cause Analysis**: ¿Por qué ocurre este problema? No patches superficiales.

2. **Fix Completo**: Provee el archivo completo corregido como CodeArtifact.
   - Si el fix es en firestore.rules: provee el archivo completo actualizado.
   - Si el fix es en un Server Action: provee la función completa con el fix.
   - Si el fix es en un componente: provee el componente completo.

3. **Prevention Strategy**: ¿Cómo evitar esta clase de bug en el futuro?
   Ejemplo: "Agregar un middleware de verificación de rol en todas las server actions
   sensibles" o "Crear un custom hook useAuthGuard que verifique rol antes de renderizar".

## CRITERIO DE READINESS

\`readyForRelease = true\` SOLO si:
- Todos los blockers de seguridad tienen fix aplicado
- Los critical y high findings de QA tienen fix
- Los riesgos de regresión identificados han sido mitigados
- Los medium/low pueden quedar en \`remainingIssues\` sin bloquear

## PRINCIPIOS DE FIXING

- Mínimo cambio, máximo impacto — no refactorices código que no está roto
- Cada fix debe ser quirúrgico: toca solo lo necesario
- Si un fix en el backend resuelve múltiples hallazgos de seguridad, úsalo
- Para Firestore rules: proporciona siempre el archivo COMPLETO, no solo el diff
- Para security fixes: prefiere denegar por defecto y permitir explícitamente`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const fixerFlow = ai.defineFlow(
  {
    name: 'fixerFlow',
    inputSchema: FixerInputSchema,
    outputSchema: FixerOutputSchema,
  },
  async (input) => {
    const { output } = await fixerPrompt(input);
    return output!;
  }
);
