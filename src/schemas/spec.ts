import { z } from 'zod';
import { PLAN_STEPS_MAX, SPEC_CODE_RE } from '../core/constants.js';

export const SpecLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3']);
export type SpecLevelT = z.infer<typeof SpecLevelSchema>;

export const SpecStatusSchema = z.enum(['draft', 'confirmed', 'frozen', 'implemented', 'archived']);
export type SpecStatusT = z.infer<typeof SpecStatusSchema>;

export const StepStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']);
export type StepStatusT = z.infer<typeof StepStatusSchema>;
export const StepTypeSchema = z.enum(['llm_call', 'mcp_tool', 'human_gate']);
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
