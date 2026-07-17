import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../spec-io.js';
import { attachHistorySources, buildHistoryReviewReport, setHistoryDisposition } from '../history-review.js';
import { validateHistoryReviewForConfirmation } from '../spec-policy.js';

let project: TestProject;
beforeEach(() => { project = createTestProject('spec-mgr-history-review-'); });
afterEach(() => project.cleanup());

describe('history review', () => {
  it('attaches, disposes, and reports sources by affected criterion', () => {
    createFixtures();
    attachHistorySources({ paths: project.paths, specCode: 'target-L1', sources: ['spec:source-L1'] });
    setHistoryDisposition({
      paths: project.paths,
      specCode: 'target-L1',
      sourceRef: 'spec:source-L1',
      action: 'change',
      reason: 'The target narrows the old behavior.',
      affectedCriteria: ['AC-1'],
    });
    const report = buildHistoryReviewReport(project.paths, 'target-L1');
    expect(report.unresolved).toEqual([]);
    expect(report.items[0].disposition).toMatchObject({ action: 'change' });
    expect(report.byCriterion['AC-1']).toEqual([{ sourceRef: 'spec:source-L1', action: 'change' }]);
    validateHistoryReviewForConfirmation(findSpecByCode(project.paths, 'target-L1')!);
  });

  it('rejects invalid sources atomically', () => {
    createFixtures();
    expect(() => attachHistorySources({
      paths: project.paths,
      specCode: 'target-L1',
      sources: ['spec:source-L1', 'spec:missing-L1'],
    })).toThrow(/KNOWLEDGE_SOURCE_NOT_FOUND/);
    expect(findSpecByCode(project.paths, 'target-L1')?.fm.historyReview).toBeUndefined();
  });

  it('requires reasons and existing AC IDs', () => {
    createFixtures();
    attachHistorySources({ paths: project.paths, specCode: 'target-L1', sources: ['spec:source-L1'] });
    expect(() => setHistoryDisposition({
      paths: project.paths, specCode: 'target-L1', sourceRef: 'spec:source-L1', action: 'reject',
    })).toThrow(/HISTORY_REASON_REQUIRED/);
    expect(() => setHistoryDisposition({
      paths: project.paths,
      specCode: 'target-L1',
      sourceRef: 'spec:source-L1',
      action: 'reuse',
      affectedCriteria: ['AC-99'],
    })).toThrow(/HISTORY_AC_NOT_FOUND/);
  });

  it('supports an explicit no-history reason', () => {
    createFixtures();
    attachHistorySources({
      paths: project.paths,
      specCode: 'target-L1',
      sources: [],
      noRelevantHistoryReason: 'The local repository has no related history.',
    });
    validateHistoryReviewForConfirmation(findSpecByCode(project.paths, 'target-L1')!);
  });
});

function createFixtures(): void {
  createSpec({ paths: project.paths, code: 'source-L1', level: 'L1', title: 'Source', topic: 'source', parentCode: null });
  createSpec({ paths: project.paths, code: 'target-L1', level: 'L1', title: 'Target', topic: 'target', parentCode: null });
  updateSpec(project.paths, 'target-L1', {
    content: '# Target\n\n## 验收标准\n\n1. **AC-1**: target criterion\n',
    aiSummary: 'target summary',
  });
}
