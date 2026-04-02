/**
 * @fileoverview Shared type contracts for the PixelTEC OS multi-agent system.
 * All agents communicate through these typed interfaces — never raw strings.
 */

import { z } from 'genkit';

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const PriorityEnum = z.enum(['critical', 'high', 'medium', 'low']);
export const ModuleEnum = z.enum([
  'clients', 'projects', 'tasks', 'pipeline',
  'finance', 'support', 'analytics', 'auth', 'global',
]);
export const AgentNameEnum = z.enum([
  'ProductOwner', 'ProjectPlanner', 'DatabaseArchitect',
  'BackendDeveloper', 'FrontendDeveloper', 'QATester',
  'SecurityAuditor', 'FixerAgent', 'DevOpsAgent',
]);

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE REQUEST  (entrada principal al sistema)
// ─────────────────────────────────────────────────────────────────────────────

export const FeatureRequestSchema = z.object({
  title: z.string().describe('Short feature title, e.g. "Bulk invoice export"'),
  description: z.string().describe('Full feature description from the user/client'),
  module: ModuleEnum.describe('Affected ERP module'),
  requestedBy: z.string().describe('Role of requester: admin | developer | client'),
  priority: PriorityEnum.optional(),
  acceptanceCriteria: z.array(z.string()).optional()
    .describe('Optional list of acceptance criteria already known'),
});
export type FeatureRequest = z.infer<typeof FeatureRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT OWNER OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export const ProductSpecSchema = z.object({
  featureId: z.string().describe('Unique slug ID for this feature, e.g. bulk-invoice-export'),
  title: z.string(),
  priority: PriorityEnum,
  businessJustification: z.string().describe('Why this matters to the business'),
  userStories: z.array(z.string()).describe('Array of "As a [role], I want [goal] so that [reason]" stories'),
  acceptanceCriteria: z.array(z.string()).describe('Measurable done criteria'),
  outOfScope: z.array(z.string()).describe('Explicit list of what is NOT included'),
  estimatedComplexity: z.enum(['xs', 's', 'm', 'l', 'xl']),
  affectedCollections: z.array(z.string()).describe('Firestore collections likely affected'),
  affectedRoutes: z.array(z.string()).describe('Next.js routes/pages likely affected'),
});
export type ProductSpec = z.infer<typeof ProductSpecSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT PLANNER OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export const TaskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  agent: AgentNameEnum.describe('Which agent/role executes this task'),
  dependsOn: z.array(z.string()).describe('IDs of tasks that must complete first'),
  estimatedHours: z.number(),
  outputArtifact: z.string().describe('What file/document this task produces'),
});

export const ProjectPlanSchema = z.object({
  featureId: z.string(),
  totalEstimatedHours: z.number(),
  criticalPath: z.array(z.string()).describe('Ordered task IDs forming the critical path'),
  tasks: z.array(TaskItemSchema),
  risks: z.array(z.string()).describe('Identified technical or business risks'),
  milestones: z.array(z.object({
    name: z.string(),
    taskIds: z.array(z.string()),
  })),
});
export type ProjectPlan = z.infer<typeof ProjectPlanSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE ARCHITECT OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export const FirestoreFieldSchema = z.object({
  name: z.string(),
  type: z.string().describe('string | number | boolean | Timestamp | DocumentReference | map | array'),
  required: z.boolean(),
  description: z.string(),
  indexed: z.boolean().optional(),
});

export const FirestoreCollectionSchema = z.object({
  path: z.string().describe('Full collection path, e.g. "clients/{clientId}/invoices"'),
  fields: z.array(FirestoreFieldSchema),
  subcollections: z.array(z.string()).optional(),
  compositeIndexes: z.array(z.string()).optional()
    .describe('Composite index definitions needed for queries'),
});

export const DatabaseSchemaSchema = z.object({
  featureId: z.string(),
  newCollections: z.array(FirestoreCollectionSchema),
  modifiedCollections: z.array(z.object({
    path: z.string(),
    addedFields: z.array(FirestoreFieldSchema),
    removedFields: z.array(z.string()),
    rationale: z.string(),
  })),
  securityRulesAddendum: z.string()
    .describe('New Firestore security rules to append to firestore.rules'),
  migrationNotes: z.array(z.string())
    .describe('Steps needed to migrate existing data if any'),
});
export type DatabaseSchema = z.infer<typeof DatabaseSchemaSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND DEVELOPER OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export const CodeArtifactSchema = z.object({
  filePath: z.string().describe('Relative path from src/, e.g. app/actions/invoices.ts'),
  content: z.string().describe('Full file content as a string'),
  isNew: z.boolean().describe('true = new file, false = modification of existing'),
  description: z.string().describe('What this file does'),
});

export const BackendOutputSchema = z.object({
  featureId: z.string(),
  serverActions: z.array(CodeArtifactSchema),
  firestoreHelpers: z.array(CodeArtifactSchema),
  zodSchemas: z.array(CodeArtifactSchema),
  implementationNotes: z.array(z.string()),
});
export type BackendOutput = z.infer<typeof BackendOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND DEVELOPER OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export const FrontendOutputSchema = z.object({
  featureId: z.string(),
  components: z.array(CodeArtifactSchema),
  pageUpdates: z.array(CodeArtifactSchema),
  designTokensUsed: z.array(z.string())
    .describe('Tailwind classes and design tokens used, e.g. bg-black, rounded-[2rem]'),
  accessibilityNotes: z.array(z.string()),
});
export type FrontendOutput = z.infer<typeof FrontendOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// QA TESTER OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export const TestCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['unit', 'integration', 'e2e', 'security', 'performance']),
  preconditions: z.array(z.string()),
  steps: z.array(z.string()),
  expectedResult: z.string(),
  priority: PriorityEnum,
});

export const QAReportSchema = z.object({
  featureId: z.string(),
  testCases: z.array(TestCaseSchema),
  edgeCases: z.array(z.string()),
  firestoreQueryTests: z.array(z.string())
    .describe('Specific Firestore read/write scenarios to validate'),
  regressionRisks: z.array(z.string())
    .describe('Existing features that could break with this change'),
  testingChecklist: z.array(z.object({
    item: z.string(),
    automated: z.boolean(),
  })),
});
export type QAReport = z.infer<typeof QAReportSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY AUDITOR OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export const SecurityFindingSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.enum([
    'firestore-rules', 'auth', 'input-validation',
    'xss', 'data-exposure', 'cors', 'dependency',
  ]),
  description: z.string(),
  location: z.string().describe('File path or Firestore path where issue exists'),
  recommendation: z.string(),
  codeExample: z.string().optional(),
});

export const SecurityAuditSchema = z.object({
  featureId: z.string(),
  overallRisk: z.enum(['critical', 'high', 'medium', 'low']),
  findings: z.array(SecurityFindingSchema),
  approvedForDeploy: z.boolean(),
  blockers: z.array(z.string()).describe('Issues that MUST be fixed before deploying'),
  recommendations: z.array(z.string()),
});
export type SecurityAudit = z.infer<typeof SecurityAuditSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// FIXER AGENT OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export const FixSchema = z.object({
  issueId: z.string(),
  severity: PriorityEnum,
  rootCause: z.string(),
  fix: CodeArtifactSchema,
  preventionStrategy: z.string()
    .describe('How to prevent this class of bug in the future'),
});

export const FixerOutputSchema = z.object({
  featureId: z.string(),
  fixesApplied: z.array(FixSchema),
  remainingIssues: z.array(z.string()),
  readyForRelease: z.boolean(),
});
export type FixerOutput = z.infer<typeof FixerOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE CONTEXT  (passed through the full orchestrator)
// ─────────────────────────────────────────────────────────────────────────────

export const PipelineContextSchema = z.object({
  request: FeatureRequestSchema,
  spec: ProductSpecSchema.optional(),
  plan: ProjectPlanSchema.optional(),
  schema: DatabaseSchemaSchema.optional(),
  backend: BackendOutputSchema.optional(),
  frontend: FrontendOutputSchema.optional(),
  qa: QAReportSchema.optional(),
  security: SecurityAuditSchema.optional(),
  fixes: FixerOutputSchema.optional(),
  status: z.enum([
    'intake', 'planning', 'db-design', 'backend', 'frontend',
    'qa', 'security', 'fixing', 'approved', 'blocked',
  ]),
  blockers: z.array(z.string()).optional(),
});
export type PipelineContext = z.infer<typeof PipelineContextSchema>;
