import type { ProjectPaths } from './paths.js';
import { buildTaskEvidence } from './task-evidence.js';
import type { AcceptanceReport, AssistFinding } from './capability-types.js';

export function buildAcceptanceReport(paths: ProjectPaths, taskId: string, specCode: string): AcceptanceReport {
  const evidence = buildTaskEvidence(paths, taskId, specCode);
  const criteria = evidence.criticalCriteria.map(item => ({
    id: item.id,
    text: item.text,
    status: item.status,
    verificationIds: item.verificationIds,
  }));

  return {
    schemaVersion: 'acceptance-report.v1',
    taskId: evidence.taskId,
    specCode: evidence.specCode,
    profile: evidence.profile,
    criteria,
    verifications: evidence.verifications,
    artifacts: evidence.artifacts,
    humanAcceptance: buildHumanAcceptanceFindings(evidence),
    residualRisk: buildResidualRiskFindings(evidence),
    summary: evidence.summary,
  };
}

function buildHumanAcceptanceFindings(evidence: ReturnType<typeof buildTaskEvidence>): AssistFinding[] {
  const findings: AssistFinding[] = [];
  if (evidence.criticalCriteria.length === 0) {
    findings.push({
      id: 'acceptance.no-critical-ac',
      severity: 'advisory',
      title: 'No critical AC declared',
      detail: 'This task has no critical acceptance criteria. Machine evidence cannot replace explicit human acceptance.',
      sourceRefs: [{ kind: 'spec', id: evidence.specCode }],
    });
  }

  const failed = evidence.criticalCriteria.filter(item => item.status === 'failed');
  if (failed.length > 0) {
    findings.push({
      id: 'acceptance.failed-criteria',
      severity: 'warning',
      title: 'Failed criteria need review',
      detail: `Critical AC with only failing verification: ${failed.map(item => item.id).join(', ')}.`,
      sourceRefs: [
        { kind: 'spec', id: evidence.specCode },
        { kind: 'task', id: evidence.taskId },
      ],
      nextCommand: `spec-manager task evidence ${evidence.taskId} --spec ${evidence.specCode}`,
    });
  }

  const uncovered = evidence.criticalCriteria.filter(item => item.status === 'uncovered');
  if (uncovered.length > 0) {
    findings.push({
      id: 'acceptance.uncovered-criteria',
      severity: 'warning',
      title: 'Uncovered criteria need human acceptance',
      detail: `Critical AC without verification evidence: ${uncovered.map(item => item.id).join(', ')}.`,
      sourceRefs: [
        { kind: 'spec', id: evidence.specCode },
        { kind: 'task', id: evidence.taskId },
      ],
      nextCommand: `spec-manager task verify ${evidence.taskId} --spec ${evidence.specCode}`,
    });
  }

  return findings;
}

function buildResidualRiskFindings(evidence: ReturnType<typeof buildTaskEvidence>): AssistFinding[] {
  const findings: AssistFinding[] = [];
  const failedOrUncovered = evidence.criticalCriteria.filter(item => item.status === 'failed' || item.status === 'uncovered');
  if (failedOrUncovered.length > 0) {
    findings.push({
      id: 'acceptance.residual-risk.criteria-gap',
      severity: 'warning',
      title: 'Residual criteria coverage gap',
      detail: `Acceptance evidence is incomplete for: ${failedOrUncovered.map(item => `${item.id}=${item.status}`).join(', ')}.`,
      sourceRefs: [
        { kind: 'spec', id: evidence.specCode },
        { kind: 'task', id: evidence.taskId },
      ],
    });
  }

  if (evidence.verifications.length === 0) {
    findings.push({
      id: 'acceptance.residual-risk.no-verification',
      severity: 'advisory',
      title: 'No verification records',
      detail: 'The task has no recorded verification command, so the report only reflects spec/task metadata.',
      sourceRefs: [{ kind: 'task', id: evidence.taskId }],
      nextCommand: `spec-manager task verify ${evidence.taskId} --spec ${evidence.specCode}`,
    });
  }

  if (evidence.artifacts.length === 0) {
    findings.push({
      id: 'acceptance.residual-risk.no-artifacts',
      severity: 'advisory',
      title: 'No verification artifacts',
      detail: 'No artifacts were recorded with task verification. Keep external evidence in the final handoff if needed.',
      sourceRefs: [{ kind: 'task', id: evidence.taskId }],
    });
  }

  return findings;
}
