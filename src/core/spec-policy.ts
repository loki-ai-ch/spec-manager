import { AI_SUMMARY_MAX, PLACEHOLDER_MARKER } from './constants.js';
import { recordAuditHit, type AuditSink } from './audit-events.js';
import { isPlaceholderContent } from './placeholder.js';
import { specFilePath, type ProjectPaths } from './paths.js';
import { assertSpecTransition, isAuthorizedImplementationTransition, type ImplementationAuthority } from './status.js';
import type { SpecLevel } from './validate.js';
import type { SpecFrontmatter, SpecRecord, StepFrontmatter } from './spec-io.js';
import type { HistoryReviewT, ScopePlanT } from '../schemas/spec.js';
import { isKnowledgeGovernedCreatedAt, readKnowledgeGovernanceConfig } from './knowledge-governance-adoption.js';

export type SpecPolicyWarning = string;

export interface CreateSpecPolicyInput {
  paths: ProjectPaths;
  code: string;
  level: SpecLevel;
  title: string;
  topic: string;
  parentCode: string | null;
  parentRecord?: SpecRecord | null;
  milestone?: string;
  auditSink?: AuditSink;
  findSpecByCode: (paths: ProjectPaths, code: string) => SpecRecord | null;
}

export interface CreateSpecPolicyResult {
  record: SpecRecord;
}

export interface SpecUpdatePatch {
  content?: string;
  aiSummary?: string;
  changeSummary?: string;
  status?: SpecFrontmatter['status'];
  appendStep?: StepFrontmatter;
  replaceStep?: { no: number | string; step: StepFrontmatter };
  addRelation?: { type: string; target: string };
  historyReview?: HistoryReviewT;
  scopePlan?: ScopePlanT;
  deliveryLearning?: boolean;
  deliveryLearningReason?: string;
}

export interface UpdateSpecPolicyInput {
  paths: ProjectPaths;
  code: string;
  existing: SpecRecord;
  patch: SpecUpdatePatch;
  auditSink?: AuditSink;
  transitionAuthority?: ImplementationAuthority;
  findSpecByCode: (paths: ProjectPaths, code: string) => SpecRecord | null;
}

export interface UpdateSpecPolicyResult {
  record: SpecRecord;
  warnings: SpecPolicyWarning[];
}

export interface SpecParentPolicyResult {
  parentFilePath: string | null;
}

const EXPECTED_PARENT_LEVELS: Record<SpecLevel, SpecLevel[]> = {
  L0: [],
  L1: [],
  L2: ['L0', 'L1'],
  L3: ['L2'],
};

const SUPPORTED_RELATION_TYPES = ['based_on', 'supersedes', 'implements', 'references'];

export function validateSpecParentPolicy(input: CreateSpecPolicyInput): SpecParentPolicyResult {
  if (input.parentCode) {
    const parent = input.parentRecord ?? input.findSpecByCode(input.paths, input.parentCode);
    if (!parent) {
      throw new Error(`parentCode 指向不存在的 spec: ${input.parentCode}`);
    }
    const expectedParentLevels = EXPECTED_PARENT_LEVELS[input.level];
    if (!expectedParentLevels.includes(parent.fm.level)) {
      recordAuditHit({ paths: input.paths, ruleId: 'R7', specCode: input.code }, input.auditSink);
      throw new Error(
        `R7: ${input.level} 的 parent 必须是 ${expectedParentLevels.join('/')}, ` +
        `实际是 ${parent.fm.level} (${input.parentCode})`,
      );
    }
    if ((input.level === 'L2' || input.level === 'L3') && parent.fm.status === 'draft') {
      recordAuditHit({ paths: input.paths, ruleId: 'R4', specCode: input.code }, input.auditSink);
      throw new Error(
        `R4: 创建 ${input.level} 前父级 ${input.parentCode} 必须先通过独立审核（confirmed/frozen/implemented），` +
        `当前 status=${parent.fm.status}`,
      );
    }
    if ((input.level === 'L2' || input.level === 'L3') && parent.fm.status === 'implemented') {
      throw new Error(`LIFECYCLE_SCOPE_DRIFT: cannot add ${input.code} under implemented ${input.parentCode}`);
    }
    recordAuditHit({ paths: input.paths, ruleId: 'R4', specCode: input.code }, input.auditSink);
    return { parentFilePath: parent.filePath };
  }

  if (input.level === 'L2' || input.level === 'L3') {
    recordAuditHit({ paths: input.paths, ruleId: 'R7', specCode: input.code }, input.auditSink);
    throw new Error(`R7: ${input.level} 必须有 parentCode`);
  }

  return { parentFilePath: null };
}

export function buildInitialSpecRecord(
  input: CreateSpecPolicyInput,
  parentPolicy: SpecParentPolicyResult,
  now = new Date().toISOString(),
): CreateSpecPolicyResult {
  const filePath = specFilePath(input.paths, parentPolicy.parentFilePath, input.code, input.topic);
  const fm: SpecFrontmatter = {
    code: input.code,
    level: input.level,
    title: input.title,
    topic: input.topic,
    parentCode: input.parentCode,
    status: 'draft',
    milestone: input.milestone,
    created: now,
    updated: now,
  };
  return {
    record: {
      fm,
      content: `# ${input.title}\n\n${PLACEHOLDER_MARKER}\n`,
      filePath,
    },
  };
}

export function applySpecContentPolicy(input: UpdateSpecPolicyInput, content: string): string {
  if (input.patch.aiSummary === undefined || input.patch.aiSummary.trim().length === 0) {
    recordAuditHit({ paths: input.paths, ruleId: 'R13', specCode: input.code }, input.auditSink);
    throw new Error(`R13: spec update --content 必须同时提供 aiSummary，禁止写正文后没有 AI 摘要`);
  }
  if (isPlaceholderContent(content)) {
    recordAuditHit({ paths: input.paths, ruleId: 'R22', specCode: input.code }, input.auditSink);
    throw new Error(`R22: contentTemplate 仍是占位内容，spec 创建后必须立即写正文`);
  }
  return content;
}

export function applySpecSummaryPolicy(
  input: UpdateSpecPolicyInput,
  fm: SpecFrontmatter,
  warnings: SpecPolicyWarning[],
): void {
  const summary = input.patch.aiSummary;
  if (summary === undefined) return;
  if (summary.length > AI_SUMMARY_MAX) {
    recordAuditHit({ paths: input.paths, ruleId: 'R21', specCode: input.code }, input.auditSink);
    warnings.push(`aiSummary 超过 ${AI_SUMMARY_MAX} 字符，已自动截断（原长 ${summary.length}）`);
    fm.aiSummary = summary.slice(0, AI_SUMMARY_MAX);
    return;
  }
  fm.aiSummary = summary;
}

export function applySpecStatusPolicy(
  input: UpdateSpecPolicyInput,
  fm: SpecFrontmatter,
  warnings: SpecPolicyWarning[],
): void {
  const nextStatus = input.patch.status;
  if (nextStatus === undefined) return;
  if (fm.level === 'L3' && nextStatus === 'confirmed' && fm.status === 'draft') {
    warnings.push(`L3_STATUS_WARN: L3 spec ${input.code} 推荐直接 draft → frozen，confirmed 是中间态。建议使用: spec-manager spec confirm ${input.code}`);
  }
  if (!isAuthorizedImplementationTransition(fm.level, fm.status, nextStatus, input.transitionAuthority)) {
    assertSpecTransition(fm.status, nextStatus);
  }
  fm.status = nextStatus;
}

export function applySpecStepPatchPolicy(input: UpdateSpecPolicyInput, fm: SpecFrontmatter): void {
  if (input.patch.appendStep) {
    fm.steps = [...(fm.steps ?? []), input.patch.appendStep];
  }
  if (input.patch.replaceStep) {
    const steps = [...(fm.steps ?? [])];
    const idx = steps.findIndex(s => String(s.stepNo) === String(input.patch.replaceStep!.no));
    if (idx >= 0) steps[idx] = input.patch.replaceStep.step;
    else steps.push(input.patch.replaceStep.step);
    fm.steps = steps;
  }
}

export function applySpecRelationPolicy(input: UpdateSpecPolicyInput, fm: SpecFrontmatter): void {
  const relation = input.patch.addRelation;
  if (!relation) return;
  if (!SUPPORTED_RELATION_TYPES.includes(relation.type)) {
    throw new Error(`RELATION_INVALID: unsupported relation type ${relation.type}`);
  }
  if (!input.findSpecByCode(input.paths, relation.target)) {
    throw new Error(`RELATION_TARGET_NOT_FOUND: ${relation.target}`);
  }
  fm.relations = [...(fm.relations ?? []), relation];
}

export function applySpecUpdatePolicy(input: UpdateSpecPolicyInput): UpdateSpecPolicyResult {
  const warnings: SpecPolicyWarning[] = [];
  const fm = { ...input.existing.fm };
  let content = input.existing.content;

  if (input.patch.content !== undefined) {
    content = applySpecContentPolicy(input, input.patch.content);
  }
  applySpecSummaryPolicy(input, fm, warnings);
  if (input.patch.changeSummary !== undefined) fm.changeSummary = input.patch.changeSummary;
  applySpecStatusPolicy(input, fm, warnings);
  applySpecStepPatchPolicy(input, fm);
  applySpecRelationPolicy(input, fm);
  if (input.patch.historyReview !== undefined) fm.historyReview = input.patch.historyReview;
  if (input.patch.scopePlan !== undefined) fm.scopePlan = input.patch.scopePlan;
  if (input.patch.deliveryLearning !== undefined) fm.deliveryLearning = input.patch.deliveryLearning;
  if (input.patch.deliveryLearningReason !== undefined) fm.deliveryLearningReason = input.patch.deliveryLearningReason;
  fm.updated = new Date().toISOString();

  return {
    record: { fm, content, filePath: input.existing.filePath },
    warnings,
  };
}

export function validateHistoryReviewForConfirmation(record: SpecRecord): void {
  if (record.fm.level !== 'L1' && record.fm.level !== 'L2') return;
  const review = record.fm.historyReview;
  if (!review) return;
  if (review.sources.length === 0) {
    if (!review.noRelevantHistoryReason?.trim()) {
      throw new Error('HISTORY_REVIEW_INCOMPLETE: no history sources require noRelevantHistoryReason');
    }
    return;
  }
  const disposed = new Set(review.dispositions.map(item => item.sourceRef));
  const missing = review.sources.filter(sourceRef => !disposed.has(sourceRef));
  if (missing.length > 0) {
    throw new Error(`HISTORY_REVIEW_INCOMPLETE: missing dispositions for ${missing.join(', ')}`);
  }
}

export function validateKnowledgeGovernanceTransition(
  paths: ProjectPaths,
  record: SpecRecord,
  target: 'confirmed' | 'frozen',
): void {
  if (!isKnowledgeGovernedCreatedAt(paths, record.fm.created)) return;
  const config = readKnowledgeGovernanceConfig(paths);
  if (target === 'confirmed' && (record.fm.level === 'L1' || record.fm.level === 'L2')) {
    if (config.requireHistoryReview && !record.fm.historyReview) throw new Error('HISTORY_REVIEW_REQUIRED');
    if (config.requireScopePlan && !record.fm.scopePlan) throw new Error('SCOPE_PLAN_REQUIRED');
    validateHistoryReviewForConfirmation(record);
  }
  if (target === 'frozen' && record.fm.level === 'L3' && config.requireLearningPolicy) {
    if (record.fm.deliveryLearning === undefined) throw new Error('DELIVERY_LEARNING_POLICY_REQUIRED');
    if (record.fm.deliveryLearning === false && !record.fm.deliveryLearningReason?.trim()) {
      throw new Error('DELIVERY_LEARNING_REASON_REQUIRED');
    }
  }
}

export function recordCreateSpecAudit(input: CreateSpecPolicyInput): void {
  if (input.level === 'L0' || input.level === 'L1') {
    recordAuditHit({ paths: input.paths, ruleId: 'R4', specCode: input.code }, input.auditSink);
  }
}

export function recordUpdatedSpecAudit(input: UpdateSpecPolicyInput): void {
  if (input.patch.content !== undefined) {
    recordAuditHit({ paths: input.paths, ruleId: 'R1', specCode: input.code }, input.auditSink);
    recordAuditHit({ paths: input.paths, ruleId: 'R13', specCode: input.code }, input.auditSink);
    recordAuditHit({ paths: input.paths, ruleId: 'R22', specCode: input.code }, input.auditSink);
  }
}
