# PixelTEC OS — Multi-Agent AI System

## Stack del Sistema

- **Runtime**: Genkit 1.16 + Google AI (Gemini 2.5 Flash)
- **Lenguaje**: TypeScript (100% compatible con el proyecto Next.js existente)
- **Patrones**: Server Actions + Flows + Tools
- **No requiere**: Python, CrewAI, servicios externos adicionales

---

## Diagrama del Pipeline: Feature Request → Deploy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FEATURE REQUEST (entrada)                           │
│  { title, description, module, requestedBy, priority }                  │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 1 — Product Owner Agent                                          │
│  IN:  FeatureRequest                                                    │
│  OUT: ProductSpec { featureId, userStories, acceptanceCriteria,         │
│                     estimatedComplexity, affectedCollections }           │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 2 — Project Planner Agent                                        │
│  IN:  ProductSpec                                                       │
│  OUT: ProjectPlan { tasks[], dependencies, criticalPath, milestones }   │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 3 — Database Architect Agent                                     │
│  IN:  ProductSpec                                                       │
│  OUT: DatabaseSchema { newCollections, modifiedCollections,             │
│                        securityRulesAddendum, migrationNotes }          │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 4 — Backend Developer Agent                                      │
│  IN:  ProductSpec + DatabaseSchema                                      │
│  OUT: BackendOutput { serverActions[], firestoreHelpers[], zodSchemas[] }│
└──────────────┬──────────────────────────────────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐  ┌──────────────┐   ← PARALLEL
│  STAGE 5     │  │  STAGE 6     │
│  Frontend    │  │  QA Tester   │
│  Developer   │  │              │
│              │  │              │
│  OUT:        │  │  OUT:        │
│  components[]│  │  testCases[] │
│  pageUpdates │  │  edgeCases[] │
└──────┬───────┘  └──────┬───────┘
       └────────┬─────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 7 — Security Auditor Agent                                       │
│  IN:  ProductSpec + BackendOutput + DatabaseSchema                      │
│  OUT: SecurityAudit { findings[], overallRisk, approvedForDeploy,       │
│                        blockers[] }                                     │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
               ┌──────────┴──────────┐
               │ blockers.length > 0? │
               └──────────┬──────────┘
                    YES    │    NO
                     ┌─────┘     └──────────┐
                     ▼                      ▼
           ┌──────────────────┐    ┌────────────────┐
           │  STAGE 8         │    │  SKIP Fixer     │
           │  Fixer Agent     │    │                 │
           │                  │    └────────┬────────┘
           │  OUT: fixes[],   │             │
           │  readyForRelease │             │
           └─────────┬────────┘             │
                     │                      │
              ┌──────┴──────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 9 — DevOps Agent                                                 │
│  IN:  ProductSpec + FixerOutput + DatabaseSchema                        │
│  OUT: configFiles[], deploymentChecklist[], rollbackPlan[]              │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
                ┌─────────────────┐
                │ status: approved │
                │    🚀 DEPLOY     │
                └─────────────────┘
```

---

## Estructura de Archivos

```
src/ai/
├── genkit.ts                          # Configuración Genkit + Gemini
├── dev.ts                             # Entry point dev server
│
├── types/
│   └── agent-types.ts                 # Contratos TypeScript entre agentes
│                                      # (Zod schemas + types inferidos)
│
├── agents/                            # Agentes individuales
│   ├── product-owner.ts               # Spec de producto (user stories, AC)
│   ├── project-planner.ts             # Plan de tareas + dependencias
│   ├── db-architect.ts                # Schema Firestore + security rules
│   ├── backend-developer.ts           # Server Actions + Zod schemas
│   ├── frontend-developer.ts          # Componentes React + Tailwind
│   ├── qa-tester.ts                   # Test cases + edge cases
│   ├── security-auditor.ts            # Vulnerabilidades + blockers
│   ├── fixer.ts                       # Corrección de bugs bloqueantes
│   └── devops.ts                      # Deploy config + checklist
│
├── orchestrators/
│   └── feature-pipeline.ts            # Pipeline completo (9 stages)
│
├── tools/
│   └── firestore-context.ts           # Genkit tools: get_system_snapshot,
│                                      # get_collection_schema
│
└── flows/                             # Flows especializados (existentes)
    ├── strategic-advisor.ts           # Asesor por cliente (existente)
    ├── global-strategic-advisor.ts    # Asesor global (existente)
    └── content-enhancement-suggestions.ts  (existente)

src/app/dashboard/
└── agents/
    └── page.tsx                       # UI para ejecutar el pipeline
```

---

## Resumen de Agentes

| # | Agente | Input | Output | Herramientas |
|---|--------|-------|--------|--------------|
| 1 | **Product Owner** | FeatureRequest | ProductSpec | — |
| 2 | **Project Planner** | ProductSpec | ProjectPlan | get_system_snapshot |
| 3 | **DB Architect** | ProductSpec | DatabaseSchema | get_collection_schema |
| 4 | **Backend Developer** | Spec + Schema | BackendOutput | — |
| 5 | **Frontend Developer** | Spec + Backend | FrontendOutput | — |
| 6 | **QA Tester** | Spec + FE + BE | QAReport | — |
| 7 | **Security Auditor** | Spec + BE + Schema | SecurityAudit | — |
| 8 | **Fixer Agent** | QA + Security + code | FixerOutput | — |
| 9 | **DevOps Agent** | Spec + Fixes + Schema | DevOpsOutput | — |

---

## Cómo usar el pipeline

### Opción A — Desde la UI del dashboard
Navega a `/dashboard/agents` y llena el formulario.

### Opción B — Desde código (Server Action / API route)

```typescript
import { runFeaturePipeline } from '@/ai/orchestrators/feature-pipeline';

const result = await runFeaturePipeline({
  title: "Exportar facturas en bulk a PDF",
  description: "El administrador necesita seleccionar múltiples transacciones y exportarlas como un solo PDF para enviar al contador.",
  module: "finance",
  requestedBy: "admin",
  priority: "high",
});

console.log(result.spec?.featureId);     // "bulk-invoice-export"
console.log(result.status);              // "approved" | "blocked"
console.log(result.security?.approvedForDeploy); // true | false
```

### Opción C — Agente individual (re-run parcial)

```typescript
import { runSecurityAuditorAgent } from '@/ai/orchestrators/feature-pipeline';

// Re-auditar solo security después de aplicar un fix manual
const audit = await runSecurityAuditorAgent({
  spec: existingSpec,
  backend: updatedBackend,
  dbSchema: existingSchema,
});
```

---

## Recomendaciones de Mejora del Sistema

### Prioridad Alta

1. **Roles en Firestore Rules**: El Security Auditor detectará que las reglas actuales
   no diferencian entre admin y member. Implementa custom claims:
   ```javascript
   allow write: if request.auth.token.role == 'admin';
   ```

2. **Firestore Admin SDK**: Los agentes actualmente usan el cliente Firebase.
   Para Server Actions sensibles, usa `firebase-admin` con service account.

3. **Streaming del pipeline**: Implementa SSE (Server-Sent Events) para que la UI
   muestre el progreso en tiempo real stage-by-stage.

### Prioridad Media

4. **Persistir resultados del pipeline**: Guarda los outputs en Firestore
   (`/ai_runs/{runId}`) para auditoría y reutilización.

5. **Genkit Traces**: Activa el Genkit Dev UI para tracing completo de cada agente.
   Corre: `npm run genkit:dev` y visita `http://localhost:4000`.

6. **Caching inteligente**: Si el mismo featureId se re-procesa, cachea el ProductSpec
   para no re-generar desde cero.

### Prioridad Baja

7. **Webhooks de GitHub**: Conecta un webhook para que cuando se haga PR con
   "feat:" prefix, el pipeline corra automáticamente.

8. **Múltiples modelos**: Usa Gemini 2.5 Pro para agents críticos (Security, DB Architect)
   y Flash para agents rápidos (QA, DevOps).
