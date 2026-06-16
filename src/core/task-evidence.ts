import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TASK_FILE_EXT } from './constants.js';
import { findSpecByCode } from './spec-io.js';
import { siblingMetaDir, type ProjectPaths } from './paths.js';
import { listTopicMetaFiles } from './repository.js';
import { validateCriticalAcceptanceCriteria } from './spec-sections.js';
import type { TaskRecord, TaskVerificationRecord } from './task.js';
import type { TaskWorkflowProfileSource, WorkflowProfile } from './workflow-profile.js';

export type EvidenceCoverageStatus = 'covered' | 'failed' | 'uncovered' | 'not-required';

export interface TaskEvidenceCriterion {
  id: string;
  text: string;
  status: EvidenceCoverageStatus;
  verificationIds: string[];
}

export interface TaskEvidenceSummary {
  required: number;
  covered: number;
  failed: number;
  uncovered: number;
}

export interface TaskEvidence {
  schemaVersion: 'task-evidence.experimental.v1';
  specCode: string;
  taskId: string;
  profile: WorkflowProfile;
  profileSource: TaskWorkflowProfileSource;
  profileOverrideReason: string | null;
  criticalCriteria: TaskEvidenceCriterion[];
  verifications: TaskVerificationRecord[];
  artifacts: string[];
  summary: TaskEvidenceSummary;
}

export interface EvidenceCoverageEvaluation {
  satisfied: boolean;
  blockingCriteria: string[];
  summary: TaskEvidenceSummary;
}

export function buildTaskEvidence(paths: ProjectPaths, taskId: string, specCode?: string): TaskEvidence {
  const task = findTaskRecord(paths, taskId, specCode);
  const spec = findSpecByCode(paths, task.specCode);
  if (!spec) throw new Error(`SPEC_NOT_FOUND: ${task.specCode}`);

  const critical = validateCriticalAcceptanceCriteria(spec.content);
  if (critical.unknown.length > 0) {
    throw new Error(`UNKNOWN_CRITICAL_AC: ${critical.unknown.join(', ')}`);
  }

  const verifications = task.verifications ?? [];
  const criticalCriteria = critical.criticalCriteria.map(criterion => {
    const related = verifications.filter(v => v.coversAc.includes(criterion.id));
    const successful = related.filter(v => v.exitCode === 0);
    const status: EvidenceCoverageStatus = successful.length > 0
      ? 'covered'
      : related.length > 0 ? 'failed' : 'uncovered';
    return {
      id: criterion.id,
      text: criterion.text,
      status,
      verificationIds: related.map(v => v.id),
    };
  });

  return {
    schemaVersion: 'task-evidence.experimental.v1',
    specCode: task.specCode,
    taskId: task.id,
    profile: task.profile ?? 'legacy',
    profileSource: task.profileSource ?? 'legacy',
    profileOverrideReason: task.profileOverrideReason ?? null,
    criticalCriteria,
    verifications,
    artifacts: uniqueArtifacts(verifications),
    summary: summarizeCriteria(criticalCriteria),
  };
}

export function evaluateEvidenceCoverage(evidence: TaskEvidence): EvidenceCoverageEvaluation {
  if (evidence.profile !== 'governed') {
    return { satisfied: true, blockingCriteria: [], summary: evidence.summary };
  }
  const blockingCriteria = evidence.criticalCriteria
    .filter(item => item.status === 'failed' || item.status === 'uncovered')
    .map(item => item.id);
  return {
    satisfied: blockingCriteria.length === 0,
    blockingCriteria,
    summary: evidence.summary,
  };
}

function findTaskRecord(paths: ProjectPaths, taskId: string, specCode?: string): TaskRecord {
  if (specCode) {
    const spec = findSpecByCode(paths, specCode);
    if (!spec) throw new Error(`SPEC_NOT_FOUND: ${specCode}`);
    const filePath = join(siblingMetaDir(spec.filePath, 'tasks'), `${specCode}-${taskId}${TASK_FILE_EXT}`);
    if (!existsSync(filePath)) throw new Error(`TASK_NOT_FOUND: ${taskId} (in ${specCode})`);
    return readTaskJSON(filePath);
  }

  const task = listTopicMetaFiles(paths, 'tasks', { extension: TASK_FILE_EXT })
    .map(file => readTaskJSON(file.filePath))
    .find(item => item.id === taskId);
  if (!task) throw new Error(`TASK_NOT_FOUND: ${taskId}`);
  return task;
}

function readTaskJSON(filePath: string): TaskRecord {
  return JSON.parse(readFileSync(filePath, 'utf8')) as TaskRecord;
}

function uniqueArtifacts(verifications: TaskVerificationRecord[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const verification of verifications) {
    for (const artifact of verification.artifacts) {
      if (seen.has(artifact)) continue;
      seen.add(artifact);
      out.push(artifact);
    }
  }
  return out;
}

function summarizeCriteria(criteria: TaskEvidenceCriterion[]): TaskEvidenceSummary {
  return {
    required: criteria.length,
    covered: criteria.filter(item => item.status === 'covered').length,
    failed: criteria.filter(item => item.status === 'failed').length,
    uncovered: criteria.filter(item => item.status === 'uncovered').length,
  };
}
