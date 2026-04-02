'use server';
/**
 * @fileoverview Feature Request Pipeline — Multi-Agent Orchestrator
 *
 * This is the main entry point for the PixelTEC OS agent system.
 * It orchestrates all agents in a sequential, dependency-aware pipeline.
 *
 * FLOW:
 *   FeatureRequest
 *     → [1] ProductOwner     → ProductSpec
 *     → [2] ProjectPlanner   → ProjectPlan
 *     → [3] DatabaseArchitect → DatabaseSchema          ┐ parallel
 *     → [4] BackendDeveloper  → BackendOutput            ┘ (DB first, then BE)
 *     → [5] FrontendDeveloper → FrontendOutput           ┐ parallel
 *     → [6] QATester          → QAReport                 ┘ (after BE)
 *     → [7] SecurityAuditor   → SecurityAudit
 *     → [8] FixerAgent        → FixerOutput (only if blockers exist)
 *     → [9] DevOpsAgent       → DevOpsOutput
 *     → PipelineContext (full output)
 *
 * Usage:
 *   const result = await runFeaturePipeline({
 *     title: "Bulk invoice export to PDF",
 *     description: "...",
 *     module: "finance",
 *     requestedBy: "admin",
 *   });
 */

import { ai } from '@/ai/genkit';
import {
  FeatureRequestSchema,
  PipelineContextSchema,
  type FeatureRequest,
  type PipelineContext,
} from '@/ai/types/agent-types';
import { runProductOwnerAgent } from '@/ai/agents/product-owner';
import { runProjectPlannerAgent } from '@/ai/agents/project-planner';
import { runDatabaseArchitectAgent } from '@/ai/agents/db-architect';
import { runBackendDeveloperAgent } from '@/ai/agents/backend-developer';
import { runFrontendDeveloperAgent } from '@/ai/agents/frontend-developer';
import { runQATesterAgent } from '@/ai/agents/qa-tester';
import { runSecurityAuditorAgent } from '@/ai/agents/security-auditor';
import { runFixerAgent } from '@/ai/agents/fixer';
import { runDevOpsAgent } from '@/ai/agents/devops';

// ─── Public Entry Point ───────────────────────────────────────────────────────

export async function runFeaturePipeline(
  request: FeatureRequest,
  _options: PipelineOptions = {}
): Promise<PipelineContext> {
  return featurePipelineFlow(request);
}

// ─── Options ─────────────────────────────────────────────────────────────────

interface PipelineOptions {
  /** Stop pipeline after this stage (for partial runs) */
  stopAfter?: PipelineStage;
  /** Skip the fixer stage even if blockers exist (for dry runs) */
  skipFixer?: boolean;
  /** Skip DevOps stage (for feature branches not ready to deploy) */
  skipDevOps?: boolean;
  /** Callback invoked after each stage completes */
  onStageComplete?: (stage: PipelineStage, context: Partial<PipelineContext>) => void;
}

type PipelineStage =
  | 'product-owner'
  | 'project-planner'
  | 'db-architect'
  | 'backend'
  | 'frontend'
  | 'qa'
  | 'security'
  | 'fixer'
  | 'devops';

// ─── Pipeline Flow ────────────────────────────────────────────────────────────

const featurePipelineFlow = ai.defineFlow(
  {
    name: 'featurePipelineFlow',
    inputSchema: FeatureRequestSchema,
    outputSchema: PipelineContextSchema,
  },
  async (request: FeatureRequest): Promise<PipelineContext> => {
    const context: PipelineContext = {
      request,
      status: 'intake',
      blockers: [],
    };

    try {
      // ── Stage 1: Product Owner ─────────────────────────────────────────────
      console.log('[Pipeline] Stage 1/9: Product Owner → generating spec...');
      context.status = 'planning';
      context.spec = await runProductOwnerAgent(request);
      console.log(`[Pipeline] ✓ Spec ready: ${context.spec.featureId} (${context.spec.estimatedComplexity})`);

      // ── Stage 2: Project Planner ───────────────────────────────────────────
      console.log('[Pipeline] Stage 2/9: Project Planner → creating plan...');
      context.plan = await runProjectPlannerAgent(context.spec);
      console.log(`[Pipeline] ✓ Plan ready: ${context.plan.tasks.length} tasks, ${context.plan.totalEstimatedHours}h estimated`);

      // ── Stage 3: Database Architect ────────────────────────────────────────
      console.log('[Pipeline] Stage 3/9: Database Architect → designing schema...');
      context.status = 'db-design';
      context.schema = await runDatabaseArchitectAgent(context.spec);
      console.log(`[Pipeline] ✓ Schema ready: ${context.schema.newCollections.length} new, ${context.schema.modifiedCollections.length} modified`);

      // ── Stage 4: Backend Developer ─────────────────────────────────────────
      console.log('[Pipeline] Stage 4/9: Backend Developer → generating server actions...');
      context.status = 'backend';
      context.backend = await runBackendDeveloperAgent({
        spec: context.spec,
        dbSchema: context.schema,
      });
      console.log(`[Pipeline] ✓ Backend ready: ${context.backend.serverActions.length} actions, ${context.backend.zodSchemas.length} schemas`);

      // ── Stages 5 & 6: Frontend + QA (can conceptually run in parallel) ─────
      // Note: Genkit flows run in Node.js — use Promise.all for true parallelism
      console.log('[Pipeline] Stages 5-6: Frontend Developer & QA Tester (parallel)...');
      context.status = 'frontend';

      const [frontendResult, qaResult] = await Promise.all([
        runFrontendDeveloperAgent({
          spec: context.spec,
          backend: context.backend,
        }),
        runQATesterAgent({
          spec: context.spec,
          frontend: {
            featureId: context.spec.featureId,
            components: [],
            pageUpdates: [],
            designTokensUsed: [],
            accessibilityNotes: [],
          },
          backend: context.backend,
        }),
      ]);

      context.frontend = frontendResult;
      context.qa = qaResult;
      console.log(`[Pipeline] ✓ Frontend ready: ${context.frontend.components.length} components`);
      console.log(`[Pipeline] ✓ QA ready: ${context.qa.testCases.length} test cases, ${context.qa.edgeCases.length} edge cases`);

      // ── Stage 7: Security Auditor ──────────────────────────────────────────
      console.log('[Pipeline] Stage 7/9: Security Auditor → reviewing...');
      context.status = 'security';
      context.security = await runSecurityAuditorAgent({
        spec: context.spec,
        backend: context.backend,
        dbSchema: context.schema,
      });

      const criticalFindings = context.security.findings.filter(
        f => f.severity === 'critical' || f.severity === 'high'
      );
      console.log(
        `[Pipeline] ✓ Security audit: ${criticalFindings.length} critical/high, approved=${context.security.approvedForDeploy}`
      );

      // ── Stage 8: Fixer Agent (conditional) ────────────────────────────────
      const needsFixer =
        !context.security.approvedForDeploy ||
        context.security.blockers.length > 0 ||
        context.qa.regressionRisks.length > 0;

      if (needsFixer) {
        console.log('[Pipeline] Stage 8/9: Fixer Agent → resolving blockers...');
        context.status = 'fixing';
        context.fixes = await runFixerAgent({
          featureId: context.spec.featureId,
          qaReport: context.qa,
          securityAudit: context.security,
          backend: context.backend,
          frontend: context.frontend,
        });
        console.log(
          `[Pipeline] ✓ Fixer: ${context.fixes.fixesApplied.length} fixes, readyForRelease=${context.fixes.readyForRelease}`
        );

        if (!context.fixes.readyForRelease) {
          context.status = 'blocked';
          context.blockers = context.fixes.remainingIssues;
          console.warn('[Pipeline] ⚠ Pipeline BLOCKED — remaining issues unresolved');
          return context;
        }
      } else {
        console.log('[Pipeline] Stage 8/9: Fixer Agent → skipped (no blockers)');
      }

      // ── Stage 9: DevOps ────────────────────────────────────────────────────
      console.log('[Pipeline] Stage 9/9: DevOps Agent → deployment plan...');
      await runDevOpsAgent({
        spec: context.spec,
        fixes: context.fixes ?? {
          featureId: context.spec.featureId,
          fixesApplied: [],
          remainingIssues: [],
          readyForRelease: true,
        },
        dbSchema: context.schema,
      });
      console.log('[Pipeline] ✓ DevOps: deployment checklist ready');

      context.status = 'approved';
      console.log(`[Pipeline] 🚀 Feature "${context.spec.featureId}" approved for deployment!`);
      return context;

    } catch (error) {
      console.error('[Pipeline] Fatal error:', error);
      context.status = 'blocked';
      context.blockers = [`Pipeline error: ${error instanceof Error ? error.message : String(error)}`];
      return context;
    }
  }
);

// ─── Convenience: Run single agent ────────────────────────────────────────────
// Useful for re-running a single stage after a fix without rerunning the full pipeline.

export {
  runProductOwnerAgent,
  runProjectPlannerAgent,
  runDatabaseArchitectAgent,
  runBackendDeveloperAgent,
  runFrontendDeveloperAgent,
  runQATesterAgent,
  runSecurityAuditorAgent,
  runFixerAgent,
  runDevOpsAgent,
};
