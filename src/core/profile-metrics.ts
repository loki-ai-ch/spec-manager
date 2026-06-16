import type { ProjectPaths } from './paths.js';
import { buildProjectSnapshot } from './project-snapshot.js';
import { buildTaskEvidence } from './task-evidence.js';
import type { TaskRecord } from './task.js';
import { readAdaptiveWorkflowConfig, type TaskWorkflowProfile } from './workflow-profile.js';

export type MetricsProfileBucket = 'legacy' | 'standard' | 'governed';

export interface ProfileMetricsBucket {
  tasks: number;
  completed: number;
  failed: number;
  active: number;
  completionRate: number | null;
}

export interface ProfileMetricsReport {
  schemaVersion: 'profile-metrics.experimental.v1';
  generatedAt: string;
  topic?: string;
  adaptiveWorkflow: {
    enabled: boolean;
    defaultProfile: TaskWorkflowProfile;
    note: string;
  };
  totals: {
    tasks: number;
    completed: number;
    failed: number;
    active: number;
  };
  byProfile: Record<MetricsProfileBucket, ProfileMetricsBucket>;
  evidence: {
    governed: {
      required: number;
      covered: number;
      failed: number;
      uncovered: number;
      completedWithGaps: Array<{ specCode: string; taskId: string; missing: string[] }>;
    };
    standard: {
      warnings: number;
      missing: Array<{ specCode: string; taskId: string; missing: string[] }>;
    };
    invalidProjections: Array<{ specCode: string; taskId: string; error: string }>;
  };
  overrides: Array<{
    specCode: string;
    taskId: string;
    profile: 'standard' | 'governed';
    profileSource: 'explicit';
    reason: string;
  }>;
}

export interface BuildProfileMetricsOptions {
  topic?: string;
  now?: Date;
}

export function buildProfileMetrics(paths: ProjectPaths, opts?: BuildProfileMetricsOptions): ProfileMetricsReport {
  const topic = normalizeTopic(opts?.topic);
  const adaptive = readAdaptiveWorkflowConfig(paths);
  const snapshot = buildProjectSnapshot(paths, { include: ['specs', 'tasks'], topic });
  const byProfile = initialBuckets();
  const totals = { tasks: 0, completed: 0, failed: 0, active: 0 };
  const evidence: ProfileMetricsReport['evidence'] = {
    governed: { required: 0, covered: 0, failed: 0, uncovered: 0, completedWithGaps: [] },
    standard: { warnings: 0, missing: [] },
    invalidProjections: [],
  };
  const overrides: ProfileMetricsReport['overrides'] = [];

  for (const task of snapshot.tasks) {
    const bucket = profileBucket(task);
    countTask(byProfile[bucket], task);
    countTask(totals, task);
    collectOverride(overrides, task);
    collectEvidence(paths, task, evidence);
  }

  finalizeBuckets(byProfile);
  return {
    schemaVersion: 'profile-metrics.experimental.v1',
    generatedAt: (opts?.now ?? new Date()).toISOString(),
    ...(topic ? { topic } : {}),
    adaptiveWorkflow: {
      enabled: adaptive.enabled,
      defaultProfile: adaptive.defaultProfile,
      note: adaptive.enabled
        ? `adaptive workflow enabled; default task profile is ${adaptive.defaultProfile}`
        : 'adaptive workflow disabled; metrics do not change legacy completion semantics',
    },
    totals,
    byProfile,
    evidence,
    overrides,
  };
}

function normalizeTopic(topic: string | undefined): string | undefined {
  if (topic === undefined) return undefined;
  const trimmed = topic.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new Error('INVALID_PROFILE_METRICS_TOPIC: --topic must be a safe topic name');
  }
  return trimmed;
}

function initialBuckets(): Record<MetricsProfileBucket, ProfileMetricsBucket> {
  return {
    legacy: emptyBucket(),
    standard: emptyBucket(),
    governed: emptyBucket(),
  };
}

function emptyBucket(): ProfileMetricsBucket {
  return { tasks: 0, completed: 0, failed: 0, active: 0, completionRate: null };
}

function profileBucket(task: TaskRecord): MetricsProfileBucket {
  if (task.profile === 'standard' || task.profile === 'governed') return task.profile;
  return 'legacy';
}

function countTask(counter: { tasks: number; completed: number; failed: number; active: number }, task: TaskRecord): void {
  counter.tasks += 1;
  if (task.status === 'completed') counter.completed += 1;
  else if (task.status === 'failed') counter.failed += 1;
  else counter.active += 1;
}

function finalizeBuckets(byProfile: Record<MetricsProfileBucket, ProfileMetricsBucket>): void {
  for (const bucket of Object.values(byProfile)) {
    bucket.completionRate = bucket.tasks === 0 ? null : bucket.completed / bucket.tasks;
  }
}

function collectOverride(overrides: ProfileMetricsReport['overrides'], task: TaskRecord): void {
  if (
    task.profileSource !== 'explicit' ||
    (task.profile !== 'standard' && task.profile !== 'governed') ||
    !task.profileOverrideReason
  ) {
    return;
  }
  overrides.push({
    specCode: task.specCode,
    taskId: task.id,
    profile: task.profile,
    profileSource: 'explicit',
    reason: task.profileOverrideReason,
  });
}

function collectEvidence(
  paths: ProjectPaths,
  task: TaskRecord,
  evidence: ProfileMetricsReport['evidence'],
): void {
  if (task.profile !== 'standard' && task.profile !== 'governed') return;

  try {
    const projection = buildTaskEvidence(paths, task.id, task.specCode);
    const missing = projection.criticalCriteria
      .filter(item => item.status === 'failed' || item.status === 'uncovered')
      .map(item => item.id);

    if (task.profile === 'governed') {
      evidence.governed.required += projection.summary.required;
      evidence.governed.covered += projection.summary.covered;
      evidence.governed.failed += projection.summary.failed;
      evidence.governed.uncovered += projection.summary.uncovered;
      if (task.status === 'completed' && missing.length > 0) {
        evidence.governed.completedWithGaps.push({ specCode: task.specCode, taskId: task.id, missing });
      }
      return;
    }

    if (missing.length > 0) {
      evidence.standard.warnings += 1;
      evidence.standard.missing.push({ specCode: task.specCode, taskId: task.id, missing });
    }
  } catch (err) {
    evidence.invalidProjections.push({
      specCode: task.specCode,
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
