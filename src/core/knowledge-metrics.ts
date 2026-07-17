import type { ProjectPaths } from './paths.js';
import {
  parseKnowledgeSourceRef,
  readKnowledgeRegistry,
  resolveKnowledge,
  validateKnowledgeSource,
  type KnowledgeState,
  type ParsedKnowledgeSourceRef,
} from './knowledge.js';
import { readDeliveryKnowledge, type DeliveryKnowledgeRecord } from './delivery-knowledge.js';
import { buildScopeReadinessReport } from './scope-readiness.js';
import { buildProfileMetrics } from './profile-metrics.js';
import { buildProjectSnapshot, taskKey } from './project-snapshot.js';

export interface MetricSourceSet extends Record<KnowledgeState, number> {
  eligible: number;
}

export interface CoverageMetric {
  numerator: number;
  denominator: number;
  ratio: number | null;
  unit: 'task' | 'spec' | 'decision' | 'source';
  eligibility: string;
}

export function buildKnowledgeMetrics(paths: ProjectPaths, topic?: string) {
  const snapshot = buildProjectSnapshot(paths, { topic });
  const allSnapshot = topic ? buildProjectSnapshot(paths) : snapshot;
  const registry = readKnowledgeRegistry(paths);
  const allDelivery = readDeliveryKnowledge(paths).records;
  const delivery = allDelivery.filter(item => !topic || item.topic === topic);
  const eligibleSourceRefs = buildEligibleSourceRefs(snapshot, delivery);
  const validity = emptySourceSet(eligibleSourceRefs.size);
  const invalidProjections: Array<{ sourceRef: string; error: string; scope: string }> = [];

  for (const sourceRef of eligibleSourceRefs) {
    try {
      validity[resolveKnowledge(paths, sourceRef, { registry, snapshot: allSnapshot }).state]++;
    } catch (err) {
      invalidProjections.push({ sourceRef, error: errorMessage(err), scope: inferProjectionScope(sourceRef, allSnapshot) });
    }
  }
  for (const sourceRef of Object.keys(registry.annotations)) {
    if (eligibleSourceRefs.has(sourceRef)) continue;
    try {
      validateKnowledgeSource(paths, sourceRef, allSnapshot);
    } catch (err) {
      invalidProjections.push({ sourceRef, error: errorMessage(err), scope: inferProjectionScope(sourceRef, allSnapshot) });
    }
  }

  const dispositions: Record<string, number> = { reuse: 0, change: 0, reject: 0, unknown: 0 };
  let attachedSources = 0;
  for (const spec of snapshot.specs) {
    attachedSources += spec.fm.historyReview?.sources.length ?? 0;
    for (const item of spec.fm.historyReview?.dispositions ?? []) dispositions[item.action]++;
  }
  const disposedSources = Object.values(dispositions).reduce((sum, count) => sum + count, 0);

  const eligibleTasks = snapshot.tasks.filter(task =>
    task.status === 'completed'
    && snapshot.indexes.specByCode.get(task.specCode)?.fm.deliveryLearning === true);
  const recordsByTask = currentDeliveryRecords(delivery);
  const declaredTasks = eligibleTasks.filter(task => recordsByTask.has(taskKey(task.specCode, task.id)));
  const approvedTasks = eligibleTasks.filter(task => recordsByTask.get(taskKey(task.specCode, task.id))?.status === 'approved');
  const profile = buildProfileMetrics(paths, { topic });
  const required = profile.evidence.governed.required;
  const covered = profile.evidence.governed.covered;

  return {
    schemaVersion: 'knowledge-metrics.v2', ...(topic ? { topic } : {}), validity,
    dispositions,
    dispositionCoverage: coverage(disposedSources, attachedSources, 'source', 'historyReview sources attached to scoped Specs'),
    scope: buildScopeReadinessReport(paths, topic).summary,
    delivery: {
      total: delivery.length, draft: delivery.filter(item => item.status === 'draft').length,
      approved: delivery.filter(item => item.status === 'approved').length,
      rejected: delivery.filter(item => item.status === 'rejected').length,
      none: delivery.filter(item => item.conclusion === 'none').length,
      declarationCoverage: coverage(declaredTasks.length, eligibleTasks.length, 'task', 'completed Tasks whose L3 enables delivery learning'),
      approvalCoverage: coverage(approvedTasks.length, eligibleTasks.length, 'task', 'completed learning-enabled Tasks with approved Delivery Knowledge'),
    },
    retrieval: {
      approvedAvailable: delivery.filter(item => item.status === 'approved').length,
      coverage: coverage(approvedTasks.length, eligibleTasks.length, 'task', 'completed learning-enabled Tasks with approved retrievable knowledge'),
    },
    evidence: {
      criticalRequired: required,
      criticalCovered: covered,
      coverage: coverage(covered, required, 'source', 'critical AC evidence required by governed Tasks'),
    },
    invalidProjections: [
      ...invalidProjections,
      ...profile.evidence.invalidProjections.map(item => ({
        sourceRef: `task:${item.specCode}:${item.taskId}`,
        error: item.error,
        scope: topic ?? snapshot.indexes.specByCode.get(item.specCode)?.fm.topic ?? 'unscoped',
      })),
    ],
  };
}

function inferProjectionScope(sourceRef: string, snapshot: ReturnType<typeof buildProjectSnapshot>): string {
  let parsed: ParsedKnowledgeSourceRef;
  try {
    parsed = parseKnowledgeSourceRef(sourceRef);
  } catch {
    return 'unscoped';
  }
  if (parsed.kind === 'spec') return snapshot.indexes.specByCode.get(parsed.specCode)?.fm.topic ?? 'unscoped';
  if (parsed.kind === 'ac') return snapshot.indexes.specByCode.get(parsed.specCode)?.fm.topic ?? 'unscoped';
  if (parsed.kind === 'task') return snapshot.indexes.specByCode.get(parsed.specCode)?.fm.topic ?? 'unscoped';
  if (parsed.kind === 'decision') return parsed.topic;
  if (parsed.kind === 'lesson' && parsed.sourceKind === 'task') {
    const match = parsed.sourceIdentity.match(/^([^:]+):/);
    return match ? snapshot.indexes.specByCode.get(match[1])?.fm.topic ?? 'unscoped' : 'unscoped';
  }
  if (parsed.kind === 'lesson' && parsed.sourceKind === 'decision') {
    const match = parsed.sourceIdentity.match(/^([^:]+):/);
    return match?.[1] ?? 'unscoped';
  }
  return 'unscoped';
}

function buildEligibleSourceRefs(
  snapshot: ReturnType<typeof buildProjectSnapshot>,
  delivery: DeliveryKnowledgeRecord[],
): Set<string> {
  return new Set([
    ...snapshot.specs.map(spec => `spec:${spec.fm.code}`),
    ...snapshot.decisions.map(decision => `decision:${decision.fm.topic}:${decision.id}`),
    ...snapshot.tasks.map(task => `task:${task.specCode}:${task.id}`),
    ...delivery.filter(item => item.status === 'approved').map(item => `lesson:delivery:${item.id}`),
  ]);
}

function emptySourceSet(eligible: number): MetricSourceSet {
  return { eligible, current: 0, historical: 0, superseded: 0, invalidated: 0, unknown: 0 };
}

function currentDeliveryRecords(records: DeliveryKnowledgeRecord[]): Map<string, DeliveryKnowledgeRecord> {
  return new Map(records
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map(record => [taskKey(record.specCode, record.taskId), record]));
}

function coverage(
  numerator: number,
  denominator: number,
  unit: CoverageMetric['unit'],
  eligibility: string,
): CoverageMetric {
  const safeDenominator = Math.max(0, denominator);
  const safeNumerator = safeDenominator === 0 ? 0 : Math.min(Math.max(0, numerator), safeDenominator);
  return {
    numerator: safeNumerator,
    denominator: safeDenominator,
    ratio: safeDenominator === 0 ? null : safeNumerator / safeDenominator,
    unit,
    eligibility,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
