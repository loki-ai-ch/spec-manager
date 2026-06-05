import { z } from 'zod';

/**
 * Delta spec 中每个 change 段的 schema。
 * 必填字段：op（操作类型）、code（spec code）。
 * 其它字段根据 op 不同而不同：
 *   ADDED:    needs [parentCode, level, title, content]
 *   MODIFIED: needs [content] 或 [frontmatter patch]
 *   REMOVED:  无额外必填
 *   RENAMED:  needs [newCode]
 */

export const ChangeOpSchema = z.enum(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED']);
export type ChangeOpT = z.infer<typeof ChangeOpSchema>;

export const ChangeEntrySchema = z.object({
  op: ChangeOpSchema,
  code: z.string().min(1),
  parentCode: z.string().nullable().optional(),
  level: z.enum(['L0', 'L1', 'L2', 'L3']).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  newCode: z.string().optional(),
  changeSummary: z.string().optional(),
  affectedCriteria: z.array(z.string()).optional(),
});

export const DeltaSpecSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'change name 必须小写字母/数字/短横线'),
  created: z.string().optional(),
  description: z.string().optional(),
  changes: z.array(ChangeEntrySchema).min(1),
});

export const ProposalSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  why: z.string().min(1, 'proposal.why 必填（说明动机）'),
  scope: z.string().min(1, 'proposal.scope 必填（说明影响范围）'),
  risk: z.string().optional(),
  rollback: z.string().optional(),
  affectedCriteria: z.array(z.string()).optional(),
  created: z.string().optional(),
});

export type ChangeEntry = z.infer<typeof ChangeEntrySchema>;
export type DeltaSpec = z.infer<typeof DeltaSpecSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
