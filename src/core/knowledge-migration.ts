import type { ProjectPaths } from './paths.js';
import { readKnowledgeRegistry, resolveKnowledge } from './knowledge.js';
import { buildProjectSnapshot } from './project-snapshot.js';
import type { GovernanceCandidate, GovernanceCandidateType } from './capability-types.js';
import { buildCriticalReadinessReport } from './critical-readiness.js';
import { buildKnowledgeMetrics } from './knowledge-metrics.js';

export interface KnowledgeMigrationPreview {
  schemaVersion: 'knowledge-migration-preview.v2';
  topic: string | null;
  writes: false;
  readOnly: true;
  batches: Record<GovernanceCandidateType, GovernanceCandidate[]>;
  simulatedMetricsDelta: Record<string, number>;
  items: Array<{ sourceRef: string; topic: string; score: number; missing: string[]; suggestedCommand: string; batch: number }>;
}

export function previewKnowledgeMigration(paths: ProjectPaths, opts?: { topic?: string; limit?: number }): KnowledgeMigrationPreview {
  const limit = Math.max(1, opts?.limit ?? 20);
  const snapshot = buildProjectSnapshot(paths, { topic: opts?.topic });
  const annotations = readKnowledgeRegistry(paths).annotations;
  const validity = snapshot.specs
    .filter(spec => !annotations[`spec:${spec.fm.code}`])
    .map(spec => {
      const relationCount = spec.fm.relations?.length ?? 0;
      const risk = spec.fm.level === 'L1' ? 3 : spec.fm.level === 'L2' ? 2 : 1;
      return {
        candidateType: 'spec-validity' as const,
        subjectRef: `spec:${spec.fm.code}`,
        sourceRefs: [`spec:${spec.fm.code}`], reasonCodes: ['missing-validity-review'],
        confidence: Math.min(0.95, 0.45 + (risk + relationCount) * 0.05), knowledgeState: 'unknown' as const,
        suggestedAction: `spec-manager knowledge set spec:${spec.fm.code} --state current --reason "<human review>"`,
        topic: spec.fm.topic, score: risk + relationCount,
      };
    })
    .sort((a, b) => b.score - a.score || a.subjectRef.localeCompare(b.subjectRef))
    .slice(0, limit);
  const lifecycle = buildLifecycleCandidates(paths, opts?.topic);
  const relationCandidates = lifecycle
    .filter(item => item.reasonCodes.includes('declared-supersedes-relation'))
    .map(item => ({ ...item, candidateType: 'supersedes-relation' as const }));
  const readiness = buildCriticalReadinessReport(paths, { topic: opts?.topic, now: new Date(0) });
  const readinessCandidates: GovernanceCandidate[] = readiness.items
    .filter(item => item.status !== 'ready')
    .slice(0, limit)
    .map(item => ({
      candidateType: 'critical-ac-readiness', subjectRef: `spec:${item.specCode}`,
      sourceRefs: [`spec:${item.specCode}`], reasonCodes: [`critical-ac-${item.status}`],
      confidence: 1, knowledgeState: 'unknown', suggestedAction: item.suggestion,
    }));
  const batches: KnowledgeMigrationPreview['batches'] = {
    'spec-validity': validity.map(({ topic: _topic, score: _score, ...item }) => item),
    'decision-lifecycle': lifecycle.filter(item => item.candidateType === 'decision-lifecycle').slice(0, limit),
    'supersedes-relation': relationCandidates.slice(0, limit),
    'history-disposition': lifecycle.filter(item => item.candidateType === 'history-disposition').slice(0, limit),
    'critical-ac-readiness': readinessCandidates,
  };
  const baselineMetrics = buildKnowledgeMetrics(paths, opts?.topic);
  const items = validity.map((item, index) => ({
    sourceRef: item.subjectRef, topic: item.topic, score: item.score, missing: ['validity'],
    suggestedCommand: item.suggestedAction, batch: Math.floor(index / 5) + 1,
  }));
  return {
    schemaVersion: 'knowledge-migration-preview.v2', topic: opts?.topic ?? null,
    writes: false, readOnly: true, batches,
    simulatedMetricsDelta: {
      validityUnknown: -Math.min(baselineMetrics.validity.unknown, batches['spec-validity'].length),
      decisionLifecycleReviewed: batches['decision-lifecycle'].length,
      supersedesRelationsReviewed: batches['supersedes-relation'].length,
      historyDispositionsReviewed: batches['history-disposition'].length,
      criticalAcReady: batches['critical-ac-readiness'].length,
    },
    items,
  };
}

export function buildLifecycleCandidates(paths: ProjectPaths, topic?: string): GovernanceCandidate[] {
  const snapshot = buildProjectSnapshot(paths, { topic });
  const registry = readKnowledgeRegistry(paths);
  const candidates: GovernanceCandidate[] = [];
  for (const spec of snapshot.specs) {
    for (const relation of spec.fm.relations ?? []) {
      if (relation.type !== 'supersedes') continue;
      candidates.push({
        candidateType: 'spec-validity', subjectRef: `spec:${relation.target}`,
        sourceRefs: [`spec:${spec.fm.code}`, `spec:${relation.target}`], reasonCodes: ['declared-supersedes-relation'],
        confidence: 0.95, knowledgeState: 'superseded',
        suggestedAction: `Review and mark spec:${relation.target} superseded by spec:${spec.fm.code}.`,
      });
    }
    for (const disposition of spec.fm.historyReview?.dispositions ?? []) {
      if (disposition.action !== 'change' && disposition.action !== 'reject') continue;
      candidates.push({
        candidateType: 'history-disposition', subjectRef: disposition.sourceRef,
        sourceRefs: [`spec:${spec.fm.code}`, disposition.sourceRef], reasonCodes: [`history-${disposition.action}`],
        confidence: disposition.action === 'reject' ? 0.85 : 0.65, knowledgeState: 'unknown',
        suggestedAction: `Review whether ${disposition.sourceRef} remains current after ${spec.fm.code}.`,
      });
    }
  }
  for (const decision of snapshot.decisions.filter(item => item.fm.status === 'active')) {
    const owner = snapshot.indexes.specByCode.get(decision.fm.docCode);
    if (!owner) continue;
    const ownerKnowledge = resolveKnowledge(paths, `spec:${owner.fm.code}`, { registry, snapshot });
    if (!['historical', 'superseded', 'invalidated'].includes(ownerKnowledge.state)) continue;
    candidates.push({
      candidateType: 'decision-lifecycle', subjectRef: `decision:${decision.fm.topic}:${decision.id}`,
      sourceRefs: [`decision:${decision.fm.topic}:${decision.id}`, `spec:${owner.fm.code}`],
      reasonCodes: [`owner-spec-${ownerKnowledge.state}`], confidence: 0.85,
      knowledgeState: ownerKnowledge.state,
      suggestedAction: `Review active Decision ${decision.id} because its owner Spec is ${ownerKnowledge.state}.`,
    });
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || a.subjectRef.localeCompare(b.subjectRef));
}
