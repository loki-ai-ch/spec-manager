import { buildAcceptanceReport } from './acceptance-report.js';
import type { ProjectPaths } from './paths.js';
import { findSpecByCode } from './spec-io.js';
import { findTask } from './task.js';
import type {
  AssistFinding,
  DeliverySummaryReport,
  DeliveryVerificationSummary,
} from './capability-types.js';

export function buildDeliverySummary(paths: ProjectPaths, taskId: string, specCode: string): DeliverySummaryReport {
  const spec = requireSpec(paths, specCode);
  const task = requireTask(paths, specCode, taskId);
  const acceptance = buildAcceptanceReport(paths, taskId, specCode);
  const steps = (task.steps ?? []).map(step => ({
    stepNo: step.stepNo,
    name: step.name,
    status: step.status,
  }));
  const verifications = acceptance.verifications.map(verification => toDeliveryVerificationSummary(verification));
  const artifacts = uniqueStrings([
    ...acceptance.artifacts,
    ...verifications.flatMap(verification => verification.artifacts),
  ]);
  const findings = buildFindings(task.status, verifications, acceptance.humanAcceptance, acceptance.residualRisk, specCode, taskId);

  return {
    schemaVersion: 'delivery-summary.v1',
    taskId,
    specCode,
    headline: `Delivery summary for ${specCode} / ${taskId}`,
    summary: buildSummaryLines(spec, task, verifications, acceptance.humanAcceptance, acceptance.residualRisk),
    taskStatus: task.status,
    spec: {
      code: spec.fm.code,
      level: spec.fm.level,
      status: spec.fm.status,
      title: spec.fm.title,
      topic: spec.fm.topic,
    },
    steps,
    verifications,
    artifacts,
    humanAcceptance: acceptance.humanAcceptance,
    residualRisk: acceptance.residualRisk,
    nextAction: buildNextAction(task.status, verifications, acceptance.humanAcceptance, acceptance.residualRisk, taskId, specCode),
    findings,
  };
}

function requireSpec(paths: ProjectPaths, specCode: string) {
  const spec = findSpecByCode(paths, specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
  return spec;
}

function requireTask(paths: ProjectPaths, specCode: string, taskId: string) {
  const task = findTask(paths, specCode, taskId);
  if (!task) throw new Error(`TASK_NOT_FOUND: ${taskId} (in ${specCode})`);
  return task;
}

function toDeliveryVerificationSummary(verification: {
  id: string;
  command: string;
  exitCode: number;
  summary: string;
  artifacts: string[];
  coversAc: string[];
  layer: DeliveryVerificationSummary['layer'];
}): DeliveryVerificationSummary {
  return {
    id: verification.id,
    status: verification.exitCode === 0 ? 'passed' : 'failed',
    layer: verification.layer,
    command: verification.command,
    summary: verification.summary,
    artifacts: [...verification.artifacts],
    coversAc: [...verification.coversAc],
  };
}

function buildFindings(
  taskStatus: string,
  verifications: DeliveryVerificationSummary[],
  humanAcceptance: AssistFinding[],
  residualRisk: AssistFinding[],
  specCode: string,
  taskId: string,
): AssistFinding[] {
  const findings: AssistFinding[] = [];
  if (verifications.length === 0) {
    findings.push({
      id: 'delivery.verification.missing',
      severity: 'advisory',
      title: 'No verification evidence recorded',
      detail: 'This delivery summary only reflects spec/task metadata because no verification was recorded.',
      sourceRefs: [{ kind: 'task', id: `${specCode}:${taskId}` }],
      nextCommand: `spec-manager task verify ${taskId} --spec ${specCode}`,
    });
  }
  if (verifications.some(verification => verification.status === 'failed')) {
    findings.push({
      id: 'delivery.verification.failed',
      severity: 'warning',
      title: 'Failed verification needs review',
      detail: 'One or more recorded verifications failed. Fix them before treating this as a final handoff.',
      sourceRefs: [{ kind: 'task', id: `${specCode}:${taskId}` }],
    });
  }
  if (taskStatus !== 'completed') {
    findings.push({
      id: 'delivery.task.not-completed',
      severity: 'advisory',
      title: 'Task is not completed',
      detail: `Task status is ${taskStatus}; final handoff should wait until the task is completed or intentionally stopped.`,
      sourceRefs: [{ kind: 'task', id: `${specCode}:${taskId}` }],
      nextCommand: `spec-manager assist next ${taskId} --spec ${specCode}`,
    });
  }
  if (humanAcceptance.some(finding => finding.severity === 'warning' || finding.severity === 'blocking')) {
    findings.push({
      id: 'delivery.human-acceptance.pending',
      severity: 'warning',
      title: 'Human acceptance still needed',
      detail: 'The acceptance report still contains warning or blocking findings.',
      sourceRefs: [{ kind: 'task', id: `${specCode}:${taskId}` }],
    });
  }
  if (residualRisk.length > 0) {
    findings.push({
      id: 'delivery.residual-risk.present',
      severity: 'advisory',
      title: 'Residual risk present',
      detail: 'The acceptance report still carries residual risk findings.',
      sourceRefs: [{ kind: 'task', id: `${specCode}:${taskId}` }],
    });
  }
  return findings;
}

function buildSummaryLines(
  spec: ReturnType<typeof requireSpec>,
  task: ReturnType<typeof requireTask>,
  verifications: DeliveryVerificationSummary[],
  humanAcceptance: AssistFinding[],
  residualRisk: AssistFinding[],
): string[] {
  const passed = verifications.filter(item => item.status === 'passed').length;
  const failed = verifications.filter(item => item.status === 'failed').length;
  return [
    `${spec.fm.title} (${spec.fm.status})`,
    `Task ${task.id} is ${task.status} with ${task.steps?.length ?? 0} step(s)`,
    `${passed} passed verification(s), ${failed} failed verification(s)`,
    `${humanAcceptance.length} human acceptance finding(s), ${residualRisk.length} residual risk finding(s)`,
  ];
}

function buildNextAction(
  taskStatus: string,
  verifications: DeliveryVerificationSummary[],
  humanAcceptance: AssistFinding[],
  residualRisk: AssistFinding[],
  taskId: string,
  specCode: string,
): string {
  if (verifications.length === 0) return `spec-manager task verify ${taskId} --spec ${specCode}`;
  if (verifications.some(verification => verification.status === 'failed')) {
    return 'Fix failed verification and record a new verification before handoff.';
  }
  if (taskStatus !== 'completed') return `spec-manager assist next ${taskId} --spec ${specCode}`;
  if (humanAcceptance.some(finding => finding.severity === 'warning' || finding.severity === 'blocking')) {
    return 'Review acceptance findings with the user before final confirmation.';
  }
  if (residualRisk.length > 0) {
    return 'Review residual risk with the user before final confirmation.';
  }
  return 'Share this delivery summary with the user for final confirmation.';
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
