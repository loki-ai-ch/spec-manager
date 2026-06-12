import type { ProjectPaths } from './paths.js';
import type { TaskRecord } from './task.js';
import { isActiveDecision } from './decision.js';
import { exemptionTaskKey, readIntegrityExemptions } from './integrity-exemptions.js';
import { buildProjectSnapshot, isFullProjectSnapshot, taskKey, type ProjectSnapshot } from './project-snapshot.js';

export type IntegrityIssueKind =
  | 'dangling-reference'
  | 'conflicting-active-task'
  | 'missing-verification'
  | 'missing-decision'
  | 'immutable-history-violation'
  | 'invalid-exemption'
  | 'stale-confirmed-parent';

export interface IntegrityIssue {
  kind: IntegrityIssueKind;
  sourceFile: string;
  sourceId: string;
  targetId?: string;
  message: string;
  remediation?: string;
}

const ACTIVE_TASK_STATUSES = new Set(['draft', 'running', 'waiting']);

export function inspectProjectIntegrity(paths: ProjectPaths, opts?: { snapshot?: ProjectSnapshot }): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const snapshot = opts?.snapshot && isFullProjectSnapshot(opts.snapshot)
    ? opts.snapshot
    : buildProjectSnapshot(paths);
  const { specs, tasks, decisions, incidents, changes } = snapshot;
  const exemptionResult = readIntegrityExemptions(paths);
  const specCodes = snapshot.indexes.specByCode;
  const taskByKey = snapshot.indexes.taskByKey;
  const decisionIds = snapshot.indexes.decisionById;
  const validExemptionTaskKeys = new Set<string>();

  for (const problem of exemptionResult.problems) {
    issues.push({
      kind: 'invalid-exemption',
      sourceFile: paths.integrityExemptionsFile,
      sourceId: problem.sourceId,
      message: problem.message,
      remediation: 'Repair or remove the invalid integrity exemption entry.',
    });
  }
  for (const exemption of exemptionResult.registry.exemptions) {
    const key = exemptionTaskKey(exemption);
    const task = taskByKey.get(key);
    if (!task) {
      issues.push(invalidExemption(paths, exemption.id, `integrity exemption references missing task ${key}`));
    } else if (task.status !== 'completed') {
      issues.push(invalidExemption(paths, exemption.id, `integrity exemption references non-completed task ${key}`));
    } else if ((task.verifications ?? []).some(v => v.exitCode === 0)) {
      issues.push(invalidExemption(paths, exemption.id, `integrity exemption references task with successful verification ${key}`));
    } else {
      validExemptionTaskKeys.add(key);
    }
  }

  for (const spec of specs) {
    if (spec.fm.parentCode && !specCodes.has(spec.fm.parentCode)) {
      issues.push(dangling(spec.filePath, spec.fm.code, spec.fm.parentCode, 'parentCode'));
    }
    for (const relation of spec.fm.relations ?? []) {
      if (!specCodes.has(relation.target)) {
        issues.push(dangling(spec.filePath, spec.fm.code, relation.target, `relation ${relation.type}`));
      }
    }
    const specDecisions = snapshot.indexes.decisionsByDocCode.get(spec.fm.code) ?? [];
    if (spec.fm.level === 'L1' && spec.fm.status === 'implemented' && !specDecisions.some(isActiveDecision)) {
      issues.push({
        kind: 'missing-decision',
        sourceFile: spec.filePath,
        sourceId: spec.fm.code,
        message: `implemented L1 ${spec.fm.code} has no active decision card`,
        remediation: `spec-manager decision create ${spec.fm.code} --topic ${spec.fm.topic} --what "..."`,
      });
    }
    if ((spec.fm.level === 'L1' || spec.fm.level === 'L2') && spec.fm.status === 'confirmed') {
      const children = snapshot.indexes.childrenByParent.get(spec.fm.code) ?? [];
      if (children.length > 0 && children.every(child => child.fm.status === 'implemented')) {
        issues.push({
          kind: 'stale-confirmed-parent',
          sourceFile: spec.filePath,
          sourceId: spec.fm.code,
          message: `confirmed ${spec.fm.level} ${spec.fm.code} has only implemented direct children`,
          remediation: 'spec-manager project reconcile --dry-run',
        });
      }
    }
  }

  for (const task of tasks) {
    if (!specCodes.has(task.specCode)) {
      issues.push(dangling(taskFileHint(paths, snapshot, task), task.id, task.specCode, 'task specCode'));
    }
    const key = taskKey(task.specCode, task.id);
    if (task.status === 'completed' && !(task.verifications ?? []).some(v => v.exitCode === 0) && !validExemptionTaskKeys.has(key)) {
      issues.push({
        kind: 'missing-verification',
        sourceFile: taskFileHint(paths, snapshot, task),
        sourceId: key,
        message: `completed task ${task.id} (${task.specCode}) has no successful verification`,
        remediation: 'Create a follow-up task; completed task history is immutable.',
      });
    }
    if ((task.status === 'completed' || task.status === 'failed') && (task.steps ?? []).some(step => step.status !== 'succeeded')) {
      issues.push({
        kind: 'immutable-history-violation',
        sourceFile: taskFileHint(paths, snapshot, task),
        sourceId: taskKey(task.specCode, task.id),
        message: `terminal task ${task.id} contains non-succeeded steps`,
      });
    }
  }

  const activeBySpec = new Map<string, TaskRecord[]>();
  for (const task of tasks.filter(task => ACTIVE_TASK_STATUSES.has(task.status))) {
    activeBySpec.set(task.specCode, [...(activeBySpec.get(task.specCode) ?? []), task]);
  }
  for (const [specCode, active] of activeBySpec) {
    if (active.length > 1) {
      issues.push({
        kind: 'conflicting-active-task',
        sourceFile: taskFileHint(paths, snapshot, active[0]),
        sourceId: specCode,
        message: `${specCode} has ${active.length} active tasks: ${active.map(task => task.id).join(', ')}`,
      });
    }
  }

  for (const decision of decisions) {
    if (!specCodes.has(decision.fm.docCode)) {
      issues.push(dangling(decision.filePath, decision.id, decision.fm.docCode, 'decision docCode'));
    }
  }
  for (const incident of incidents) {
    if (incident.fm.specCode && !specCodes.has(incident.fm.specCode)) {
      issues.push(dangling(incident.filePath, incident.id, incident.fm.specCode, 'incident specCode'));
    }
    if (incident.fm.taskCode && incident.fm.specCode && !taskByKey.has(taskKey(incident.fm.specCode, incident.fm.taskCode))) {
      issues.push(dangling(incident.filePath, incident.id, incident.fm.taskCode, 'incident taskCode'));
    }
    for (const id of incident.fm.relatedDecisions ?? []) {
      if (!decisionIds.has(id)) issues.push(dangling(incident.filePath, incident.id, id, 'incident relatedDecision'));
    }
  }
  for (const change of changes) {
    if (!specCodes.has(change.specCode)) {
      issues.push(dangling(change.proposalFile, change.name, change.specCode, 'change specCode'));
    }
    if (!taskByKey.has(taskKey(change.specCode, change.taskCode))) {
      issues.push(dangling(change.proposalFile, change.name, change.taskCode, 'change taskCode'));
    }
  }
  return issues;
}

function invalidExemption(paths: ProjectPaths, sourceId: string, message: string): IntegrityIssue {
  return {
    kind: 'invalid-exemption',
    sourceFile: paths.integrityExemptionsFile,
    sourceId,
    message,
    remediation: 'Repair or remove the invalid integrity exemption entry.',
  };
}

function dangling(sourceFile: string, sourceId: string, targetId: string, field: string): IntegrityIssue {
  return {
    kind: 'dangling-reference',
    sourceFile,
    sourceId,
    targetId,
    message: `${sourceId} has dangling ${field}: ${targetId}`,
  };
}

function taskFileHint(paths: ProjectPaths, snapshot: ProjectSnapshot, task: TaskRecord): string {
  const topic = snapshot.indexes.specByCode.get(task.specCode)?.fm.topic ?? '?';
  return `${paths.specsDir}/${topic}/tasks/${task.specCode}-${task.id}.json`;
}
