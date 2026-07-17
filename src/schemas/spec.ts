import { z } from 'zod';
import { PLAN_STEPS_MAX, SPEC_CODE_RE } from '../core/constants.js';

export const SpecLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3']);
export type SpecLevelT = z.infer<typeof SpecLevelSchema>;

export const SpecStatusSchema = z.enum(['draft', 'confirmed', 'frozen', 'implemented', 'archived']);
export type SpecStatusT = z.infer<typeof SpecStatusSchema>;

export const StepStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']);
export type StepStatusT = z.infer<typeof StepStatusSchema>;
export const StepTypeSchema = z.preprocess(
  value => value === 'mcp_tool' ? 'tool_action' : value,
  z.enum(['llm_call', 'tool_action', 'human_gate']),
);

export const HistoryDispositionActionSchema = z.enum(['reuse', 'change', 'reject', 'unknown']);
export const HistoryDispositionSchema = z.object({
  sourceRef: z.string().min(1),
  action: HistoryDispositionActionSchema,
  reason: z.string().trim().min(1).optional(),
  affectedCriteria: z.array(z.string().min(1)).default([]),
}).superRefine((value, context) => {
  if (value.action !== 'reuse' && !value.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `HISTORY_REASON_REQUIRED: ${value.action}` });
  }
});
export const HistoryReviewSchema = z.object({
  sources: z.array(z.string().min(1)).default([]),
  dispositions: z.array(HistoryDispositionSchema).default([]),
  noRelevantHistoryReason: z.string().trim().min(1).optional(),
  reviewedAt: z.string().datetime().optional(),
}).superRefine((value, context) => {
  if (new Set(value.sources).size !== value.sources.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'HISTORY_SOURCE_DUPLICATE' });
  }
  const dispositionSources = value.dispositions.map(item => item.sourceRef);
  if (new Set(dispositionSources).size !== dispositionSources.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'HISTORY_DISPOSITION_DUPLICATE' });
  }
});
export type HistoryDispositionActionT = z.infer<typeof HistoryDispositionActionSchema>;
export type HistoryReviewT = z.infer<typeof HistoryReviewSchema>;

export const ScopePlanSchema = z.object({
  mode: z.enum(['open', 'fixed']),
  plannedChildren: z.array(z.object({
    code: z.string().regex(SPEC_CODE_RE),
    title: z.string().min(1),
    required: z.boolean().default(true),
  })).default([]),
  leaf: z.boolean().default(false),
  reason: z.string().trim().min(1).optional(),
  updatedAt: z.string().datetime(),
}).superRefine((value, context) => {
  if (value.mode === 'open' && !value.reason) context.addIssue({ code: z.ZodIssueCode.custom, message: 'SCOPE_PLAN_REASON_REQUIRED' });
  if (value.mode === 'fixed' && !value.leaf && value.plannedChildren.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: 'SCOPE_PLAN_CHILDREN_REQUIRED' });
  const codes = value.plannedChildren.map(child => child.code);
  if (new Set(codes).size !== codes.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'SCOPE_PLAN_CHILD_DUPLICATE' });
});
export type ScopePlanT = z.infer<typeof ScopePlanSchema>;
export type StepTypeT = z.infer<typeof StepTypeSchema>;

export const StepFrontmatterSchema = z.object({
  stepNo: z.union([z.number(), z.string()]),
  stepType: StepTypeSchema,
  name: z.string().min(1),
  status: StepStatusSchema.default('pending'),
  toolName: z.string().optional(),
  inputJson: z.string().optional(),
  outputJson: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  latencyMs: z.number().optional(),
  reportedAt: z.string().optional(),
});

export const SpecFrontmatterSchema = z.object({
  id: z.string().optional(),
  code: z.string().regex(SPEC_CODE_RE, 'code 必须是 <topic>-L<level>[.<n>...][-desc] 格式'),
  level: SpecLevelSchema,
  title: z.string().min(1),
  topic: z.string().min(1),
  parentCode: z.string().nullable(),
  status: SpecStatusSchema,
  project: z.number().int().positive().default(1),
  milestone: z.string().regex(/^v\d+(\.\d+)*(-[a-z0-9]+)?$/i, 'milestone 格式: v1.0 / v1.0.1 / v2.0-beta').optional(),
  aiSummary: z.string().max(300, 'aiSummary 必须 ≤300 字符').default(''),
  coveredTasks: z.array(z.string()).default([]),
  steps: z.array(StepFrontmatterSchema).optional(),
  relations: z.array(z.object({
    type: z.enum(['based_on', 'supersedes', 'implements', 'references']),
    target: z.string(),
  })).default([]),
  created: z.string().optional(),
  updated: z.string().optional(),
  changeSummary: z.string().optional(),
  historyReview: HistoryReviewSchema.optional(),
  scopePlan: ScopePlanSchema.optional(),
  deliveryLearning: z.boolean().optional(),
  deliveryLearningReason: z.string().trim().min(1).optional(),
});

export const PlanStepSchema = z.object({
  stepNo: z.union([z.number().int().positive(), z.string()]),
  stepType: StepTypeSchema,
  name: z.string().min(1),
});

export const PlanJsonSchema = z.object({
  coveredSpecs: z.array(z.string()).optional(),
  steps: z.array(PlanStepSchema).min(1).max(PLAN_STEPS_MAX, `R11: 步骤数 ≤${PLAN_STEPS_MAX}`),
});

export const DecisionInputSchema = z.object({
  topic: z.string().min(1),
  what: z.string().min(1).max(500),
  why: z.string().max(500).optional(),
  affectedCriteria: z.array(z.string()).optional(),
});
