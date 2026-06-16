import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { buildCriticalReadinessReport } from '../critical-readiness.js';
import { createSpec, generateSpecCode, updateSpec } from '../spec-io.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-critical-readiness-');
  mkdirSync(project.paths.specsDir, { recursive: true });
});

afterEach(() => {
  project.cleanup();
});

describe('buildCriticalReadinessReport', () => {
  it('reports one item per active L3 and classifies readiness states', () => {
    const ready = createFrozenL3('ready-critical', specContent({ critical: ['AC-1', 'AC-2'] }));
    const missing = createFrozenL3('missing-critical', specContent({ critical: null }));
    const empty = createFrozenL3('empty-critical', specContent({ critical: [] }));
    const unknown = createFrozenL3('unknown-critical', specContent({ critical: ['AC-9'] }));

    const report = buildCriticalReadinessReport(project.paths, {
      now: new Date('2026-06-16T08:00:00.000Z'),
    });

    expect(report.schemaVersion).toBe('critical-readiness.experimental.v1');
    expect(report.generatedAt).toBe('2026-06-16T08:00:00.000Z');
    expect(report.totals).toEqual({
      activeL3: 4,
      ready: 1,
      missing: 1,
      empty: 1,
      unknown: 1,
    });
    expect(report.readinessRatio).toBe(0.25);
    expect(report.items.map(item => item.specCode)).toEqual([empty, missing, ready, unknown].sort());
    expect(itemFor(report, ready)).toMatchObject({
      status: 'ready',
      missingSection: false,
      emptySection: false,
      criticalCount: 2,
    });
    expect(itemFor(report, missing)).toMatchObject({
      status: 'missing',
      missingSection: true,
      emptySection: false,
      criticalCount: 0,
    });
    expect(itemFor(report, empty)).toMatchObject({
      status: 'empty',
      missingSection: false,
      emptySection: true,
      criticalCount: 0,
    });
    expect(itemFor(report, unknown)).toMatchObject({
      status: 'unknown',
      unknownCriticalIds: ['AC-9'],
      criticalCount: 0,
    });
    expect(report.governedUpgrade.readyForGovernedDefault).toBe(false);
    expect(report.recommendations.join('\n')).toContain('do not auto-generate critical AC');
  });

  it('filters by topic', () => {
    const included = createFrozenL3('included-critical', specContent({ critical: ['AC-1'] }));
    createFrozenL3('excluded-critical', specContent({ critical: null }));

    const report = buildCriticalReadinessReport(project.paths, { topic: 'included-critical' });

    expect(report.topic).toBe('included-critical');
    expect(report.totals).toMatchObject({ activeL3: 1, ready: 1, missing: 0 });
    expect(report.items.map(item => item.specCode)).toEqual([included]);
    expect(report.governedUpgrade.readyForGovernedDefault).toBe(false);
    expect(report.governedUpgrade.note).toContain('topic-filtered report only describes scoped readiness');
  });

  it('recommends governed upgrade only when all active L3 specs are ready', () => {
    createFrozenL3('ready-one-critical', specContent({ critical: ['AC-1'] }));
    createFrozenL3('ready-two-critical', specContent({ critical: ['AC-2'] }));

    const report = buildCriticalReadinessReport(project.paths);

    expect(report.totals).toMatchObject({ activeL3: 2, ready: 2 });
    expect(report.readinessRatio).toBe(1);
    expect(report.governedUpgrade).toMatchObject({
      readyForGovernedDefault: true,
    });
    expect(report.governedUpgrade.note).toContain('rerun adoption preview');
  });

  it('returns a stable empty report when there are no active L3 specs', () => {
    const report = buildCriticalReadinessReport(project.paths);

    expect(report.totals).toEqual({
      activeL3: 0,
      ready: 0,
      missing: 0,
      empty: 0,
      unknown: 0,
    });
    expect(report.readinessRatio).toBe(0);
    expect(report.items).toEqual([]);
    expect(report.governedUpgrade.readyForGovernedDefault).toBe(false);
    expect(report.recommendations).toEqual([
      'No active L3 specs were found; create and freeze L3 specs before assessing governed readiness.',
    ]);
  });

  it('rejects unsafe topic filters', () => {
    expect(() => buildCriticalReadinessReport(project.paths, { topic: '../bad' }))
      .toThrow(/INVALID_CRITICAL_READINESS_TOPIC/);
  });
});

function itemFor(report: ReturnType<typeof buildCriticalReadinessReport>, specCode: string) {
  const item = report.items.find(candidate => candidate.specCode === specCode);
  if (!item) throw new Error(`missing report item for ${specCode}`);
  return item;
}

function createFrozenL3(topic: string, content: string): string {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths: project.paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(project.paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths: project.paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(project.paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths: project.paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(project.paths, l3Code, { content, aiSummary: 'Critical readiness fixture' });
  updateSpec(project.paths, l3Code, { status: 'frozen' });
  return l3Code;
}

function specContent(opts: { critical: string[] | null }): string {
  return `# Critical Readiness L3

## 目标

Test critical readiness.

## 实施步骤

- Implement.

## 验收标准

1. **AC-1**: first critical behavior
2. **AC-2**: second critical behavior

${opts.critical === null ? '' : `## 关键验收标准

${opts.critical.map(id => `- ${id}`).join('\n')}
`}
## 验证命令

\`\`\`bash
npm test
\`\`\`

## planJson (final)

\`\`\`json
{"coveredSpecs":["x"],"steps":[{"stepNo":1,"stepType":"mcp_tool","name":"run verify test"}]}
\`\`\`

## 回滚方案

Rollback.
`;
}
