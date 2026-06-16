import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { buildAdaptiveWorkflowAdoptionPreview } from '../adaptive-workflow-adoption.js';
import { createSpec, generateSpecCode, updateSpec } from '../spec-io.js';
import { createTask } from '../task.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-workflow-adoption-');
  mkdirSync(project.paths.specsDir, { recursive: true });
});

afterEach(() => {
  project.cleanup();
});

describe('buildAdaptiveWorkflowAdoptionPreview', () => {
  it('reports disabled workflow, legacy task history, and standard recommendation when readiness has gaps', () => {
    const readySpec = createFrozenL3('ready-adoption', specContent({ critical: true }));
    createTask({ paths: project.paths, specCode: readySpec, planJson: planFor(readySpec), autoConfirm: false });
    createFrozenL3('missing-critical-adoption', specContent({ critical: false }));

    const preview = buildAdaptiveWorkflowAdoptionPreview(project.paths, {
      now: new Date('2026-06-16T01:02:03.000Z'),
    });

    expect(preview.schemaVersion).toBe('adaptive-workflow-adoption-preview.experimental.v1');
    expect(preview.generatedAt).toBe('2026-06-16T01:02:03.000Z');
    expect(preview.adaptiveWorkflow).toMatchObject({
      enabled: false,
      defaultProfile: 'standard',
    });
    expect(preview.adaptiveWorkflow.note).toContain('read-only');
    expect(preview.taskProfileMetrics).toEqual({
      totalTasks: 1,
      legacyTasks: 1,
      standardTasks: 0,
      governedTasks: 0,
    });
    expect(preview.governedReadiness).toMatchObject({
      activeL3Specs: 2,
      withCriticalAcceptanceCriteria: 1,
      withoutCriticalAcceptanceCriteria: 1,
      readyForGovernedDefault: false,
    });
    expect(preview.governedReadiness.examplesWithoutCriticalAcceptanceCriteria)
      .toEqual(['missing-critical-adoption-L3.1.1']);
    expect(preview.recommendation.recommendedDefaultProfile).toBe('standard');
    expect(preview.recommendation.warnings).toEqual(['1 active L3 spec(s) lack valid critical acceptance criteria.']);
    expect(preview.historyPolicy.mutatesHistoricalTasks).toBe(false);
    expect(preview.historyPolicy.note).toContain('legacy tasks remain historical facts');
  });

  it('recommends governed when all active L3 specs declare valid critical AC', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });
    createFrozenL3('ready-one', specContent({ critical: true }));
    createFrozenL3('ready-two', specContent({ critical: true }));

    const preview = buildAdaptiveWorkflowAdoptionPreview(project.paths);

    expect(preview.adaptiveWorkflow.enabled).toBe(true);
    expect(preview.governedReadiness).toMatchObject({
      activeL3Specs: 2,
      withCriticalAcceptanceCriteria: 2,
      withoutCriticalAcceptanceCriteria: 0,
      readyForGovernedDefault: true,
    });
    expect(preview.governedReadiness.examplesWithoutCriticalAcceptanceCriteria).toEqual([]);
    expect(preview.recommendation.recommendedDefaultProfile).toBe('governed');
    expect(preview.recommendation.reasons).toContain(
      'All active L3 specs declare valid critical acceptance criteria, so governed default is available.',
    );
  });

  it('treats unknown critical AC references as readiness gaps', () => {
    createFrozenL3('unknown-critical-adoption', specContent({ critical: true }).replace('- AC-2', '- AC-9'));

    const preview = buildAdaptiveWorkflowAdoptionPreview(project.paths);

    expect(preview.governedReadiness).toMatchObject({
      activeL3Specs: 1,
      withCriticalAcceptanceCriteria: 0,
      withoutCriticalAcceptanceCriteria: 1,
      examplesWithoutCriticalAcceptanceCriteria: ['unknown-critical-adoption-L3.1.1'],
      readyForGovernedDefault: false,
    });
    expect(preview.recommendation.recommendedDefaultProfile).toBe('standard');
  });

  it('warns when no active L3 specs exist', () => {
    const preview = buildAdaptiveWorkflowAdoptionPreview(project.paths);

    expect(preview.governedReadiness).toMatchObject({
      activeL3Specs: 0,
      withCriticalAcceptanceCriteria: 0,
      withoutCriticalAcceptanceCriteria: 0,
      readyForGovernedDefault: false,
    });
    expect(preview.recommendation.recommendedDefaultProfile).toBe('standard');
    expect(preview.recommendation.warnings).toEqual([
      'No active L3 specs were found; governed readiness cannot be assessed yet.',
    ]);
  });
});

function planFor(specCode: string) {
  return {
    coveredSpecs: [specCode],
    steps: [{ stepNo: 1, stepType: 'tool_action' as const, name: 'run verify test' }],
  };
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
  updateSpec(project.paths, l3Code, { content, aiSummary: 'Adaptive workflow adoption fixture' });
  updateSpec(project.paths, l3Code, { status: 'frozen' });
  return l3Code;
}

function specContent(opts: { critical: boolean }): string {
  return `# Adoption L3

## 目标

Test adoption preview.

## 实施步骤

- Implement.

## 验收标准

1. **AC-1**: first critical behavior
2. **AC-2**: second critical behavior

${opts.critical ? `## 关键验收标准

- AC-1
- AC-2
` : ''}
## 验证命令

\`\`\`bash
npm test
\`\`\`

## planJson (final)

\`\`\`json
{"coveredSpecs":["x"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"验证 test"}]}
\`\`\`

## 回滚方案

Rollback.
`;
}
