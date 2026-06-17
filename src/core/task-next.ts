import { findSpecByCode } from './spec-io.js';
import { buildTaskEvidence } from './task-evidence.js';
import { findTask } from './task.js';
import type { ProjectPaths } from './paths.js';
import type { AssistFinding, AssistSourceRef, TaskNextReport, TaskStepSummary } from './capability-types.js';

const INCOMPLETE_STATUSES = new Set(['pending', 'running', 'failed']);

export function buildTaskNextReport(paths: ProjectPaths, taskId: string, specCode: string): TaskNextReport {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
  const task = findTask(paths, specCode, taskId);
  if (!task) throw new Error(`TASK_NOT_FOUND: ${taskId} (in ${specCode})`);

  const steps = task.steps ?? [];
  const incompleteSteps = steps
    .filter(step => INCOMPLETE_STATUSES.has(step.status))
    .map(step => ({ stepNo: step.stepNo, name: step.name, status: step.status }));
  const current = incompleteSteps[0] ?? null;
  const sourceRefs = taskSourceRefs(specCode, taskId, spec.filePath);
  const evidence = safeEvidence(paths, taskId, specCode);
  const lastFailure = summarizeFailure(task.lastFailedOutput ?? latestFailedOutput(steps));
  const findings = buildFindings(task.status, incompleteSteps, lastFailure, Boolean(evidence?.verifications.length), sourceRefs);

  return {
    schemaVersion: 'task-next.v1',
    taskId,
    specCode,
    taskStatus: task.status,
    currentStep: current?.stepNo ?? null,
    nextAction: nextActionFor(task.status, current, specCode, taskId),
    incompleteSteps,
    lastFailure,
    evidenceSummary: evidence?.summary ?? null,
    findings,
  };
}

function nextActionFor(status: string, current: TaskStepSummary | null, specCode: string, taskId: string): string {
  if (status === 'draft') return `spec-manager task start ${taskId} --spec ${specCode}`;
  if (status === 'waiting') return `resolve wait reason, then spec-manager task start ${taskId} --spec ${specCode}`;
  if (status === 'completed') return 'Task is completed; create a new Task for further changes.';
  if (status === 'failed') return 'Task is failed; create a new Task or inspect failure before continuing.';
  if (status !== 'running') return `Inspect task status with spec-manager task show ${taskId} --spec ${specCode}`;
  if (!current) return `All planned steps are reported; run spec-manager task complete ${taskId} --spec ${specCode}`;
  return `Report step ${current.stepNo}: spec-manager task step ${taskId} --spec ${specCode} --no ${current.stepNo} --status succeeded --output-json '{"summary":"..."}'`;
}

function buildFindings(
  status: string,
  incompleteSteps: TaskStepSummary[],
  lastFailure: string | null,
  hasVerification: boolean,
  sourceRefs: AssistSourceRef[],
): AssistFinding[] {
  const findings: AssistFinding[] = [];
  if (status !== 'running') {
    findings.push({
      id: 'task-next.not-running',
      severity: 'advisory',
      title: 'Task is not running',
      detail: `Task status is ${status}; next action depends on whether work should resume or a new task should be created.`,
      sourceRefs,
    });
  }
  if (incompleteSteps.some(step => step.status === 'failed')) {
    findings.push({
      id: 'task-next.failed-step',
      severity: 'warning',
      title: 'Task has failed steps',
      detail: 'Fix the failed step and report it again before completing the task.',
      sourceRefs,
    });
  }
  if (lastFailure) {
    findings.push({
      id: 'task-next.last-failure',
      severity: 'warning',
      title: 'Last failure is available',
      detail: lastFailure,
      sourceRefs,
    });
  }
  if (!hasVerification) {
    findings.push({
      id: 'task-next.verification.missing',
      severity: 'advisory',
      title: 'No verification evidence recorded',
      detail: 'Record at least one successful task verification before completion.',
      sourceRefs,
    });
  }
  return findings;
}

function safeEvidence(paths: ProjectPaths, taskId: string, specCode: string) {
  try {
    return buildTaskEvidence(paths, taskId, specCode);
  } catch {
    return null;
  }
}

function latestFailedOutput(steps: Array<{ status: string; outputJson?: string }>): string | null {
  return [...steps].reverse().find(step => step.status === 'failed' && step.outputJson)?.outputJson ?? null;
}

function summarizeFailure(input: string | null): string | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input) as { summary?: unknown; error?: unknown };
    if (typeof parsed.summary === 'string') return parsed.summary;
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    // fall through
  }
  return input.length > 260 ? `${input.slice(0, 259)}…` : input;
}

function taskSourceRefs(specCode: string, taskId: string, specPath: string): AssistSourceRef[] {
  return [
    { kind: 'task', id: `${specCode}:${taskId}`, summary: `Task ${taskId} for ${specCode}` },
    { kind: 'spec', id: specCode, path: specPath },
  ];
}
