import type { ProjectPaths } from './paths.js';
import { listDecisions } from './decision.js';
import { findSpecByCode, listAllSpecs, type SpecRecord } from './spec-io.js';
import { addTaskVerification, reportStep, showTask, listTasks, VERIFICATION_LAYER_ORDER, type VerificationLayer, type TaskRecord, type TaskVerificationRecord } from './task.js';
import { sectionBody, extractVerificationCommands, truncateWithEllipsis, LAST_FAILED_OUTPUT_MAX_LEN } from './spec-sections.js';
import { validateCriticalAcceptanceCriteria } from './spec-sections.js';
import type { WorkflowProfile } from './workflow-profile.js';
import { buildTaskEvidence, type EvidenceCoverageStatus, type TaskEvidenceSummary } from './task-evidence.js';

export type HarnessContextFormat = 'text' | 'json';

export interface HarnessTaskContext {
  schemaVersion: 'harness-context.experimental.v1';
  specCode: string;
  topic: string;
  title: string;
  statusGate: {
    level: string;
    status: string;
    allowed: boolean;
    reason?: string;
  };
  summary: string;
  objectives: string[];
  nonGoals: string[];
  acceptanceCriteria: string[];
  criticalAcceptanceCriteria?: string[];
  workflowProfile?: WorkflowProfile;
  evidenceCoverage?: {
    summary: TaskEvidenceSummary;
    criteria: Array<{ id: string; status: EvidenceCoverageStatus; verificationIds: string[] }>;
  };
  decisions: Array<{ code?: string; title: string; summary: string }>;
  suggestedVerification: string[];
  nextCommands: string[];
  warnings: string[];
}

export interface HarnessTaskReportPayload {
  summary: string;
  stepNo?: number | string;
  files?: string[];
  tests?: string[];
  risks?: string[];
}

export interface HarnessTaskReportInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  payload: HarnessTaskReportPayload;
}

export interface HarnessTaskReportResult {
  task: TaskRecord;
  stepNo: number | string;
  warnings: string[];
}

export interface HarnessTaskVerificationPayload {
  command: string;
  exitCode: number;
  summary: string;
  artifacts?: string[];
  coversAc?: string[];
  layer?: 'compile' | 'functional' | 'smoke';
}

export interface HarnessTaskVerificationInput {
  paths: ProjectPaths;
  taskId: string;
  specCode?: string;
  payload: HarnessTaskVerificationPayload;
}

export interface HarnessTaskVerificationResult {
  task: TaskRecord;
  verification: TaskVerificationRecord;
}

export function buildHarnessTaskContext(paths: ProjectPaths, l3Code: string): HarnessTaskContext {
  const spec = findSpecByCode(paths, l3Code);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${l3Code}`);
  if (spec.fm.level !== 'L3') throw new Error(`SPEC_NOT_L3: ${l3Code}`);
  if (spec.fm.status !== 'frozen' && spec.fm.status !== 'implemented') {
    throw new Error(`L3_NOT_FROZEN: ${l3Code} status=${spec.fm.status}`);
  }

  const warnings: string[] = [];
  collectParentWarnings(paths, spec, warnings);

  const acceptanceCriteria = extractListSection(spec.content, '验收标准');
  if (acceptanceCriteria.length === 0) {
    warnings.push('acceptanceCriteria empty: no items extracted from ## 验收标准');
  }

  const suggestedVerification = extractVerificationCommands(spec.content);
  if (suggestedVerification.length === 0) {
    warnings.push('suggestedVerification empty: no commands extracted from ## 验证命令');
  }

  const decisions = listDecisions(paths, { topic: spec.fm.topic }).map(d => ({
    code: d.id,
    title: d.fm.what,
    summary: d.fm.why ?? d.fm.what,
  }));

  const tasks = listTasks(paths, { specCode: l3Code });
  const latestTask = tasks[tasks.length - 1];
  if (latestTask?.lastFailedOutput) {
    warnings.push(`⚠ 上次 step 失败摘要: ${truncateWithEllipsis(latestTask.lastFailedOutput, LAST_FAILED_OUTPUT_MAX_LEN)}`);
  }
  const evidenceCoverage = latestTask ? buildHarnessEvidenceCoverage(paths, latestTask, warnings) : undefined;

  return {
    schemaVersion: 'harness-context.experimental.v1',
    specCode: spec.fm.code,
    topic: spec.fm.topic,
    title: spec.fm.title,
    statusGate: {
      level: spec.fm.level,
      status: spec.fm.status,
      allowed: true,
    },
    summary: spec.fm.aiSummary?.trim() || spec.fm.title,
    objectives: extractObjectives(spec.content),
    nonGoals: extractNonGoals(spec.content),
    acceptanceCriteria,
    criticalAcceptanceCriteria: validateCriticalAcceptanceCriteria(spec.content).criticalCriteria.map(item => item.text),
    workflowProfile: latestTask?.profile ?? 'legacy',
    evidenceCoverage,
    decisions,
    suggestedVerification,
    nextCommands: [`spec-manager task create ${spec.fm.code} --plan ./plan.json`],
    warnings,
  };
}

export function normalizeHarnessTaskReportPayload(raw: unknown): HarnessTaskReportPayload {
  if (!isRecord(raw)) throw new Error('INVALID_REPORT: payload must be an object');
  const summary = raw.summary;
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    throw new Error('INVALID_REPORT: summary must be a non-empty string');
  }
  const stepNo = raw.stepNo;
  if (stepNo !== undefined && !isValidStepNo(stepNo)) {
    throw new Error('INVALID_REPORT: stepNo must be a non-empty string or number');
  }
  return {
    summary: summary.trim(),
    ...(stepNo !== undefined ? { stepNo } : {}),
    files: normalizeStringArray(raw.files, 'files', 'INVALID_REPORT'),
    tests: normalizeStringArray(raw.tests, 'tests', 'INVALID_REPORT'),
    risks: normalizeStringArray(raw.risks, 'risks', 'INVALID_REPORT'),
  };
}

export function reportHarnessTaskStep(input: HarnessTaskReportInput): HarnessTaskReportResult {
  const shown = showTask(input.paths, input.taskId, { full: true, specCode: input.specCode });
  if (!shown) throw new Error(`TASK_NOT_FOUND: ${input.taskId}`);
  const stepNo = input.payload.stepNo ?? nextReportableStepNo(input.taskId, shown.steps);
  const outputJson = JSON.stringify({
    summary: input.payload.summary,
    files: input.payload.files ?? [],
    tests: input.payload.tests ?? [],
    risks: input.payload.risks ?? [],
  });
  const result = reportStep({
    paths: input.paths,
    taskId: input.taskId,
    specCode: input.specCode,
    stepNo,
    status: 'succeeded',
    outputJson,
  });
  return { task: result.task, stepNo, warnings: result.warnings };
}

export function normalizeHarnessTaskVerificationPayload(raw: unknown): HarnessTaskVerificationPayload {
  if (!isRecord(raw)) throw new Error('INVALID_VERIFICATION: payload must be an object');
  const command = raw.command;
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new Error('INVALID_VERIFICATION: command must be a non-empty string');
  }
  const exitCode = raw.exitCode;
  if (typeof exitCode !== 'number' || !Number.isFinite(exitCode)) {
    throw new Error('INVALID_VERIFICATION: exitCode must be a finite number');
  }
  const summary = raw.summary;
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    throw new Error('INVALID_VERIFICATION: summary must be a non-empty string');
  }
  return {
    command: command.trim(),
    exitCode,
    summary: summary.trim(),
    artifacts: normalizeStringArray(raw.artifacts, 'artifacts', 'INVALID_VERIFICATION'),
    coversAc: normalizeStringArray(raw.coversAc, 'coversAc', 'INVALID_VERIFICATION'),
    layer: typeof raw.layer === 'string' && VERIFICATION_LAYER_ORDER.includes(raw.layer as VerificationLayer)
      ? raw.layer as VerificationLayer
      : undefined,
  };
}

export function recordHarnessTaskVerification(input: HarnessTaskVerificationInput): HarnessTaskVerificationResult {
  const payload = normalizeHarnessTaskVerificationPayload(input.payload);
  return addTaskVerification({
    paths: input.paths,
    taskId: input.taskId,
    specCode: input.specCode,
    command: payload.command,
    exitCode: payload.exitCode,
    summary: payload.summary,
    artifacts: payload.artifacts ?? [],
    coversAc: payload.coversAc ?? [],
    layer: payload.layer,
  });
}

export function renderHarnessTaskContextText(context: HarnessTaskContext): string {
  const lines: string[] = [];
  lines.push(`Task Context: ${context.specCode}`);
  lines.push(`Title: ${context.title}`);
  lines.push('');
  lines.push(`Status Gate: ${context.statusGate.level} ${context.statusGate.status}, implementation ${context.statusGate.allowed ? 'allowed' : 'blocked'}`);
  if (context.statusGate.reason) lines.push(`Reason: ${context.statusGate.reason}`);
  lines.push('');
  lines.push('Summary:');
  lines.push(context.summary || '(none)');
  lines.push('');
  pushList(lines, 'Objectives', context.objectives);
  pushList(lines, 'Non Goals', context.nonGoals);
  pushList(lines, 'Acceptance Criteria', context.acceptanceCriteria);
  if (context.criticalAcceptanceCriteria) pushList(lines, 'Critical Acceptance Criteria', context.criticalAcceptanceCriteria);
  if (context.workflowProfile) {
    lines.push(`Workflow Profile: ${context.workflowProfile}`);
    lines.push('');
  }
  if (context.evidenceCoverage) {
    lines.push(`Evidence Coverage: ${context.evidenceCoverage.summary.covered}/${context.evidenceCoverage.summary.required} critical AC covered`);
    for (const item of context.evidenceCoverage.criteria) {
      const refs = item.verificationIds.length > 0 ? ` (${item.verificationIds.join(', ')})` : '';
      lines.push(`- ${item.id}: ${item.status}${refs}`);
    }
    lines.push('');
  }
  pushList(lines, 'Decisions', context.decisions.map(d => `${d.code ? `${d.code}: ` : ''}${d.title}${d.summary && d.summary !== d.title ? ` — ${d.summary}` : ''}`));
  pushList(lines, 'Suggested Verification', context.suggestedVerification);
  pushList(lines, 'Warnings', context.warnings);
  pushList(lines, 'Next', context.nextCommands);
  return `${lines.join('\n')}\n`;
}

function buildHarnessEvidenceCoverage(
  paths: ProjectPaths,
  task: TaskRecord,
  warnings: string[],
): HarnessTaskContext['evidenceCoverage'] | undefined {
  try {
    const evidence = buildTaskEvidence(paths, task.id, task.specCode);
    return {
      summary: evidence.summary,
      criteria: evidence.criticalCriteria.map(item => ({
        id: item.id,
        status: item.status,
        verificationIds: item.verificationIds,
      })),
    };
  } catch (err) {
    warnings.push(`evidenceCoverage unavailable: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

function nextReportableStepNo(taskId: string, steps: Array<{ stepNo: number | string; status: string }>): number | string {
  const step = steps.find(s => s.status === 'pending' || s.status === 'running');
  if (!step) throw new Error(`NO_REPORTABLE_STEP: ${taskId}`);
  return step.stepNo;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidStepNo(value: unknown): value is number | string {
  return (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim().length > 0);
}

function normalizeStringArray(value: unknown, field: string, errorCode: 'INVALID_REPORT' | 'INVALID_VERIFICATION'): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`${errorCode}: ${field} must be a string array`);
  }
  return value.map(item => item.trim()).filter(Boolean);
}

function pushList(lines: string[], title: string, items: string[]): void {
  lines.push(`${title}:`);
  if (items.length === 0) {
    lines.push('- (none)');
  } else {
    for (const item of items) lines.push(`- ${item}`);
  }
  lines.push('');
}

function collectParentWarnings(paths: ProjectPaths, spec: SpecRecord, warnings: string[]): void {
  const all = listAllSpecs(paths);
  let parentCode = spec.fm.parentCode;
  while (parentCode) {
    const parent = all.find(s => s.fm.code === parentCode);
    if (!parent) {
      warnings.push(`parent missing: ${parentCode}`);
      return;
    }
    parentCode = parent.fm.parentCode;
  }
}

function extractObjectives(content: string): string[] {
  const section = sectionBody(content, '目标');
  const bullets = extractBullets(section).filter(line => !line.startsWith('前置依赖'));
  if (bullets.length > 0) return bullets;
  const paragraph = firstParagraph(section);
  return paragraph ? [paragraph] : [];
}

function extractNonGoals(content: string): string[] {
  const section = sectionBody(content, '范围边界');
  if (!section) return [];
  const lines = section.split('\n');
  const out: string[] = [];
  let inNonGoals = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/不做|显式排除/.test(line)) {
      inNonGoals = true;
      continue;
    }
    if (inNonGoals && /^-\s+\*\*/.test(line)) break;
    if (inNonGoals) {
      const item = normalizeListItem(line);
      if (item) out.push(item);
    }
  }
  return out;
}

function extractListSection(content: string, heading: string): string[] {
  return extractBullets(sectionBody(content, heading));
}

function extractBullets(section: string): string[] {
  const out: string[] = [];
  for (const raw of section.split('\n')) {
    const item = normalizeListItem(raw.trim());
    if (item) out.push(item);
  }
  return out;
}

function normalizeListItem(line: string): string | null {
  const match = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
  if (!match) return null;
  return match[1].trim();
}

function firstParagraph(section: string): string | null {
  const lines = section
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('```') && !line.startsWith('**'));
  return lines[0] ?? null;
}
