import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createTestProject } from './project-fixture.js';
import { buildKnowledgeMetrics } from '../knowledge-metrics.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { createTask } from '../task.js';
import { declareDeliveryKnowledge, reviewDeliveryKnowledge } from '../delivery-knowledge.js';

describe('knowledge metrics', () => {
  it('is read-only for an empty project and exposes v2 coverage', () => {
    const project = createTestProject('metrics-');
    try {
      expect(buildKnowledgeMetrics(project.paths)).toMatchObject({
        schemaVersion: 'knowledge-metrics.v2',
        validity: { eligible: 0, unknown: 0 },
        delivery: {
          total: 0,
          declarationCoverage: { numerator: 0, denominator: 0, ratio: null, unit: 'task' },
        },
        invalidProjections: [],
      });
    } finally {
      project.cleanup();
    }
  });

  it('counts unannotated eligible sources as unknown', () => {
    const project = createTestProject('metrics-unknown-');
    try {
      createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
      const report = buildKnowledgeMetrics(project.paths);
      expect(report.validity).toEqual({
        eligible: 1, current: 0, historical: 0, superseded: 0, invalidated: 0, unknown: 1,
      });
      expect(Object.values(report.validity).slice(1).reduce((sum, value) => sum + value, 0)).toBe(report.validity.eligible);
    } finally {
      project.cleanup();
    }
  });

  it('uses completed learning-enabled Tasks as the delivery denominator', () => {
    const project = createTestProject('metrics-delivery-');
    try {
      createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
      updateSpec(project.paths, 'auth-L1', { status: 'confirmed', content: '# Auth\n', aiSummary: 'auth' });
      createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Design', topic: 'auth', parentCode: 'auth-L1' });
      updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed', content: '# Design\n', aiSummary: 'design' });
      createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Impl', topic: 'auth', parentCode: 'auth-L2.1' });
      updateSpec(project.paths, 'auth-L3.1.1', {
        status: 'frozen', deliveryLearning: true,
        content: '# Impl\n\n## 验收标准\n1. **AC-1**: works\n', aiSummary: 'impl',
      });
      const { task, taskFile } = createTask({
        paths: project.paths, specCode: 'auth-L3.1.1', autoConfirm: false,
        planJson: { coveredSpecs: ['auth-L3.1.1'], steps: [{ stepNo: 1, stepType: 'tool_action', name: 'verify metrics' }] },
      });
      const completed = {
        ...task, status: 'completed' as const,
        verifications: [{ id: 'V-001', command: 'npm test', exitCode: 0, summary: 'passed', layer: 'functional' as const, artifacts: [], coversAc: ['AC-1'], createdAt: new Date().toISOString() }],
      };
      writeFileSync(taskFile, JSON.stringify(completed, null, 2) + '\n');
      const draft = declareDeliveryKnowledge({
        paths: project.paths, specCode: 'auth-L3.1.1', taskId: task.id,
        conclusion: 'validated', summary: 'validated metrics', evidenceRefs: ['V-001'], affectedCriteria: ['AC-1'],
      });

      let report = buildKnowledgeMetrics(project.paths, 'auth');
      expect(report.delivery.declarationCoverage).toMatchObject({ numerator: 1, denominator: 1, ratio: 1 });
      expect(report.delivery.approvalCoverage).toMatchObject({ numerator: 0, denominator: 1, ratio: 0 });

      reviewDeliveryKnowledge(project.paths, draft.id, 'approve');
      report = buildKnowledgeMetrics(project.paths, 'auth');
      expect(report.delivery.approvalCoverage).toMatchObject({ numerator: 1, denominator: 1, ratio: 1 });
      expect(report.validity.eligible).toBe(5);
      expect(report.validity.current).toBe(0);
      expect(report.validity.unknown).toBe(5);
    } finally {
      project.cleanup();
    }
  });

  it('reports validly formatted stale annotations with scoped and unscoped projections', () => {
    const project = createTestProject('metrics-stale-');
    try {
      createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
      updateSpec(project.paths, 'auth-L1', {
        status: 'confirmed',
        content: '# Auth\n\n## 验收标准\n1. **AC-1**: auth works\n',
        aiSummary: 'auth',
      });
      writeFileSync(project.paths.knowledgeFile, JSON.stringify({
        schemaVersion: 'knowledge-registry.v1',
        annotations: {
          'spec:missing-L1': staleAnnotation(),
          'ac:auth-L1:AC-9': staleAnnotation(),
          'broken:ref': staleAnnotation(),
        },
      }, null, 2) + '\n');

      const report = buildKnowledgeMetrics(project.paths, 'auth');

      expect(report.invalidProjections).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceRef: 'spec:missing-L1', error: expect.stringContaining('KNOWLEDGE_SOURCE_NOT_FOUND'), scope: 'unscoped' }),
        expect.objectContaining({ sourceRef: 'ac:auth-L1:AC-9', error: expect.stringContaining('KNOWLEDGE_SOURCE_NOT_FOUND'), scope: 'auth' }),
        expect.objectContaining({ sourceRef: 'broken:ref', error: expect.stringContaining('KNOWLEDGE_SOURCE_REF_INVALID'), scope: 'unscoped' }),
      ]));
    } finally {
      project.cleanup();
    }
  });
});

function staleAnnotation() {
  return {
    state: 'current',
    reason: 'legacy annotation',
    reviewedAt: '2026-07-17T00:00:00.000Z',
    reviewedBy: 'human',
  };
}
