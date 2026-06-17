import { inferTopic } from './capability-brief.js';
import { defaultGitChangedFilesReader, type GitChangedFilesReader } from './drift-check.js';
import type { ProjectPaths } from './paths.js';
import { findSpecByCode, listAllSpecs, type SpecRecord } from './spec-io.js';
import { findTask, listTasks, type TaskRecord } from './task.js';
import type {
  AssistFinding,
  AssistSourceRef,
  DriftFile,
  GuidedAssistAlternative,
  GuidedAssistReport,
  GuidedAssistStage,
} from './capability-types.js';

export interface BuildGuidedAssistInput {
  paths: ProjectPaths;
  request: string;
  topic?: string;
  specCode?: string;
  taskId?: string;
  gitReader?: GitChangedFilesReader;
}

interface ResolvedContext {
  request: string;
  topic: string | null;
  spec: SpecRecord | null;
  task: TaskRecord | null;
  changedFiles: DriftFile[];
  findings: AssistFinding[];
}

export function buildGuidedAssistReport(input: BuildGuidedAssistInput): GuidedAssistReport {
  const request = input.request.trim();
  const findings: AssistFinding[] = [];
  if (!request) {
    return needsInputReport(request, normalizeOptional(input.topic), normalizeOptional(input.specCode), normalizeOptional(input.taskId), [
      {
        id: 'guided-assist.request.required',
        severity: 'blocking',
        title: 'Request is required',
        detail: 'Pass --request so guided assist can recommend the next command.',
        sourceRefs: [],
        nextCommand: 'spec-manager assist guide --request "<work>"',
      },
    ]);
  }

  const specCode = normalizeOptional(input.specCode);
  const taskId = normalizeOptional(input.taskId);
  if (taskId && !specCode) {
    return needsInputReport(request, normalizeOptional(input.topic), null, taskId, [
      {
        id: 'guided-assist.task.spec-required',
        severity: 'blocking',
        title: 'Task requires spec',
        detail: 'Pass --spec with --task to avoid ambiguous task ids such as T-001 across specs.',
        sourceRefs: [{ kind: 'task', id: taskId }],
        nextCommand: `spec-manager assist guide --request "${escapeForDoubleQuotes(request)}" --task ${taskId} --spec <specCode>`,
      },
    ]);
  }

  const spec = specCode ? requireSpec(input.paths, specCode) : null;
  const task = taskId && specCode ? requireTask(input.paths, specCode, taskId) : null;
  const explicitTopic = normalizeOptional(input.topic);
  const inferredTopic = explicitTopic ?? spec?.fm.topic ?? inferTopicFromLocalHistory(input.paths, request) ?? inferTopic(request);
  const changedFiles = safeChangedFiles(input.paths, input.gitReader ?? defaultGitChangedFilesReader, findings, specCode, taskId);
  const ctx: ResolvedContext = { request, topic: inferredTopic, spec, task, changedFiles, findings };
  return buildReportForContext(ctx);
}

function buildReportForContext(ctx: ResolvedContext): GuidedAssistReport {
  if (ctx.task && isDriftIntent(ctx.request)) {
    return report(ctx, 'drift', driftCommand(ctx.task.id, ctx.task.specCode), 'The request asks about drift, scope, or changed files for a bound task.');
  }
  if (ctx.task && ['draft', 'running', 'waiting', 'failed'].includes(ctx.task.status)) {
    return report(ctx, 'task-next', nextCommand(ctx.task.id, ctx.task.specCode), `The bound task is ${ctx.task.status}; use task-next to resume or recover.`);
  }
  if (ctx.task?.status === 'completed') {
    if (isAcceptanceIntent(ctx.request)) {
      return report(ctx, 'acceptance', acceptanceCommand(ctx.task.id, ctx.task.specCode), 'The request asks for acceptance evidence or coverage for a completed task.');
    }
    if (isDeliveryIntent(ctx.request)) {
      return report(ctx, 'delivery', deliveryCommand(ctx.task.id, ctx.task.specCode), 'The request asks for a final handoff or delivery summary for a completed task.');
    }
    return report(ctx, 'acceptance', acceptanceCommand(ctx.task.id, ctx.task.specCode), 'The bound task is completed, so the useful next view is the acceptance summary.');
  }
  if (ctx.spec && isSpecGuidanceIntent(ctx.request, ctx.spec)) {
    return report(ctx, 'critique', `spec-manager assist critique ${ctx.spec.fm.code}`, `The request is about spec ${ctx.spec.fm.code}; critique checks it before approval or implementation.`);
  }
  if (ctx.topic && hasTopicHistory(ctx)) {
    return report(ctx, 'flow', `spec-manager flow status --topic ${ctx.topic}`, `Topic ${ctx.topic} has local history; flow status shows the current workflow position.`);
  }
  if (ctx.topic) {
    return report(ctx, 'brief', briefCommand(ctx.request, ctx.topic), `No specific spec or task is bound; brief gathers local context for topic ${ctx.topic}.`);
  }
  return needsInputReport(ctx.request, null, null, null, [
    {
      id: 'guided-assist.topic.unresolved',
      severity: 'advisory',
      title: 'Topic was not resolved',
      detail: 'Pass --topic or use a request containing the project topic so guided assist can choose between brief and flow.',
      sourceRefs: [],
      nextCommand: `spec-manager assist guide --request "${escapeForDoubleQuotes(ctx.request)}" --topic <topic>`,
    },
  ]);
}

function report(ctx: ResolvedContext, stage: GuidedAssistStage, next: string, reason: string): GuidedAssistReport {
  return {
    schemaVersion: 'guided-assist.v1',
    request: ctx.request,
    topic: ctx.topic,
    specCode: ctx.spec?.fm.code ?? ctx.task?.specCode ?? null,
    taskId: ctx.task?.id ?? null,
    stage,
    nextCommand: next,
    reason,
    alternatives: alternativesFor(ctx, stage),
    findings: ctx.findings,
    sourceRefs: sourceRefsFor(ctx),
  };
}

function needsInputReport(
  request: string,
  topic: string | null,
  specCode: string | null,
  taskId: string | null,
  findings: AssistFinding[],
): GuidedAssistReport {
  return {
    schemaVersion: 'guided-assist.v1',
    request,
    topic,
    specCode,
    taskId,
    stage: 'needs-input',
    nextCommand: findings[0]?.nextCommand ?? 'spec-manager assist guide --request "<work>"',
    reason: 'Guided assist needs more input before it can recommend a stable workflow command.',
    alternatives: [],
    findings,
    sourceRefs: [],
  };
}

function alternativesFor(ctx: ResolvedContext, stage: GuidedAssistStage): GuidedAssistAlternative[] {
  const out: GuidedAssistAlternative[] = [];
  if (stage === 'brief') {
    out.push({ command: `spec-manager guide "${escapeForDoubleQuotes(ctx.request)}"`, reason: 'Use the general spec workflow guide instead of assist-specific guidance.' });
    if (ctx.topic) out.push({ command: `spec-manager new feature --topic ${ctx.topic} "..."`, reason: 'Start a new L1 directly when this is clearly a new feature.' });
  }
  if (stage === 'critique' && ctx.spec) {
    out.push({ command: `spec-manager spec show ${ctx.spec.fm.code} --include-content`, reason: 'Read the full spec before editing or approving it.' });
  }
  if (stage === 'task-next' && ctx.task) {
    if (ctx.changedFiles.length > 0) out.push({ command: driftCommand(ctx.task.id, ctx.task.specCode), reason: 'Changed files exist; check whether they drift from the declared scope.' });
    if ((ctx.task.verifications ?? []).length > 0) out.push({ command: acceptanceCommand(ctx.task.id, ctx.task.specCode), reason: 'Verification evidence exists; summarize it before handoff if needed.' });
  }
  if (stage === 'drift' && ctx.task) {
    out.push({ command: nextCommand(ctx.task.id, ctx.task.specCode), reason: 'Return to task navigation after checking drift.' });
  }
  if (stage === 'acceptance' && ctx.task) {
    out.push({ command: `spec-manager task evidence ${ctx.task.id} --spec ${ctx.task.specCode}`, reason: 'Inspect raw task evidence behind the acceptance summary.' });
    out.push({ command: `spec-manager task show ${ctx.task.id} --spec ${ctx.task.specCode}`, reason: 'Inspect task status, steps, and recorded verifications.' });
  }
  if (stage === 'delivery' && ctx.task) {
    out.push({ command: acceptanceCommand(ctx.task.id, ctx.task.specCode), reason: 'Inspect acceptance evidence before sending the delivery summary.' });
    out.push({ command: `spec-manager task show ${ctx.task.id} --spec ${ctx.task.specCode}`, reason: 'Inspect task status, steps, and recorded verifications.' });
  }
  if (stage === 'flow' && ctx.topic) {
    out.push({ command: briefCommand(ctx.request, ctx.topic), reason: 'Generate a context package before starting or resuming work.' });
  }
  return out.slice(0, 3);
}

function sourceRefsFor(ctx: ResolvedContext): AssistSourceRef[] {
  const refs: AssistSourceRef[] = [];
  if (ctx.topic) refs.push({ kind: 'config', id: `topic:${ctx.topic}` });
  if (ctx.spec) refs.push({ kind: 'spec', id: ctx.spec.fm.code, path: ctx.spec.filePath, summary: ctx.spec.fm.aiSummary ?? ctx.spec.fm.title });
  if (ctx.task) refs.push({ kind: 'task', id: `${ctx.task.specCode}:${ctx.task.id}`, summary: `${ctx.task.status} task for ${ctx.task.specCode}` });
  if (ctx.changedFiles.length > 0) refs.push({ kind: 'git', id: 'worktree', summary: `${ctx.changedFiles.length} changed file(s)` });
  return refs;
}

function requireSpec(paths: ProjectPaths, specCode: string): SpecRecord {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
  return spec;
}

function requireTask(paths: ProjectPaths, specCode: string, taskId: string): TaskRecord {
  const task = findTask(paths, specCode, taskId);
  if (!task) throw new Error(`TASK_NOT_FOUND: ${taskId} (in ${specCode})`);
  return task;
}

function safeChangedFiles(
  paths: ProjectPaths,
  reader: GitChangedFilesReader,
  findings: AssistFinding[],
  specCode: string | null,
  taskId: string | null,
): DriftFile[] {
  try {
    return reader(paths);
  } catch (err) {
    findings.push({
      id: 'guided-assist.git.unavailable',
      severity: 'advisory',
      title: 'Git changed files unavailable',
      detail: err instanceof Error ? err.message : String(err),
      sourceRefs: [
        ...(specCode ? [{ kind: 'spec' as const, id: specCode }] : []),
        ...(taskId ? [{ kind: 'task' as const, id: taskId }] : []),
      ],
    });
    return [];
  }
}

function inferTopicFromLocalHistory(paths: ProjectPaths, request: string): string | null {
  const normalized = request.toLowerCase();
  const topics = new Set([
    ...listAllSpecs(paths).map(spec => spec.fm.topic),
    ...listTasks(paths).map(task => task.specCode.replace(/-L\d.*$/, '')),
  ]);
  const matches = [...topics].filter(topic => normalized.includes(topic.toLowerCase()));
  return matches.length === 1 ? matches[0] : null;
}

function hasTopicHistory(ctx: ResolvedContext): boolean {
  if (!ctx.topic) return false;
  return Boolean(ctx.spec || ctx.task);
}

function isAcceptanceIntent(request: string): boolean {
  return /acceptance|evidence|coverage|验收|证据|覆盖|ac\b/.test(request.toLowerCase());
}

function isDeliveryIntent(request: string): boolean {
  return /handoff|deliver|delivery|final|summary|交付|总结|最终回复/.test(request.toLowerCase());
}

function isDriftIntent(request: string): boolean {
  return /drift|scope|changed|diff|偏差|范围|改动|改了什么/.test(request.toLowerCase());
}

function isSpecGuidanceIntent(request: string, spec: SpecRecord): boolean {
  if (spec.fm.status === 'draft') return true;
  return /critique|review|confirm|freeze|design|impl|spec|审查|确认|冻结|设计|实现|规格/.test(request.toLowerCase());
}

function briefCommand(request: string, topic: string): string {
  return `spec-manager assist brief --request "${escapeForDoubleQuotes(request)}" --topic ${topic}`;
}

function nextCommand(taskId: string, specCode: string): string {
  return `spec-manager assist next ${taskId} --spec ${specCode}`;
}

function driftCommand(taskId: string, specCode: string): string {
  return `spec-manager assist drift ${taskId} --spec ${specCode}`;
}

function acceptanceCommand(taskId: string, specCode: string): string {
  return `spec-manager assist acceptance ${taskId} --spec ${specCode}`;
}

function deliveryCommand(taskId: string, specCode: string): string {
  return `spec-manager assist delivery ${taskId} --spec ${specCode}`;
}

function normalizeOptional(input: string | undefined): string | null {
  const trimmed = input?.trim();
  return trimmed ? trimmed : null;
}

function escapeForDoubleQuotes(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
