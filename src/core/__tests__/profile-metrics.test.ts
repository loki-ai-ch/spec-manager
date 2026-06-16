import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, generateSpecCode, updateSpec } from '../spec-io.js';
import { addTaskVerification, createTask, startTask, type TaskRecord } from '../task.js';
import { buildProfileMetrics } from '../profile-metrics.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-profile-metrics-');
  mkdirSync(project.paths.specsDir, { recursive: true });
});

afterEach(() => {
  project.cleanup();
});

describe('buildProfileMetrics', () => {
  it('summarizes task status by legacy, standard, and governed profile', () => {
    const legacySpec = createFrozenL3('legacy-metrics');
    const { task: legacy } = createTask({
      paths: project.paths,
      specCode: legacySpec,
      planJson: planFor(legacySpec),
      autoConfirm: false,
    });
    writeTask({ ...legacy, status: 'completed', finishedAt: '2026-06-16T00:00:00.000Z' });

    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });
    const standardSpec = createFrozenL3('standard-metrics');
    const { task: standard } = createTask({
      paths: project.paths,
      specCode: standardSpec,
      planJson: planFor(standardSpec),
      autoConfirm: false,
    });
    writeTask({ ...standard, status: 'failed', errorCode: 'TEST', errorMessage: 'fixture' });

    const governedSpec = createFrozenL3('governed-metrics');
    const { task: governed } = createTask({
      paths: project.paths,
      specCode: governedSpec,
      planJson: planFor(governedSpec),
      autoConfirm: false,
      profile: 'governed',
      profileOverrideReason: 'higher risk fixture',
    });

    const report = buildProfileMetrics(project.paths, { now: new Date('2026-06-16T01:02:03.000Z') });

    expect(report.schemaVersion).toBe('profile-metrics.experimental.v1');
    expect(report.generatedAt).toBe('2026-06-16T01:02:03.000Z');
    expect(report.totals).toEqual({ tasks: 3, completed: 1, failed: 1, active: 1 });
    expect(report.byProfile.legacy).toMatchObject({ tasks: 1, completed: 1, failed: 0, active: 0, completionRate: 1 });
    expect(report.byProfile.standard).toMatchObject({ tasks: 1, completed: 0, failed: 1, active: 0, completionRate: 0 });
    expect(report.byProfile.governed).toMatchObject({ tasks: 1, completed: 0, failed: 0, active: 1, completionRate: 0 });
    expect(report.adaptiveWorkflow.note).toContain('adaptive workflow enabled');
  });

  it('aggregates governed coverage gaps and standard warnings without blocking', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });
    const governedSpec = createFrozenL3('coverage-governed');
    const { task: governed } = createTask({
      paths: project.paths,
      specCode: governedSpec,
      planJson: planFor(governedSpec),
      autoConfirm: false,
      profile: 'governed',
      profileOverrideReason: 'coverage fixture',
    });
    startTask(project.paths, governed.id, governedSpec);
    addTaskVerification({
      paths: project.paths,
      specCode: governedSpec,
      taskId: governed.id,
      command: 'npm test',
      exitCode: 0,
      summary: 'covers first',
      coversAc: ['AC-1'],
    });
    writeTask({ ...readTask(governedSpec, governed.id), status: 'completed', finishedAt: '2026-06-16T00:00:00.000Z' });

    const standardSpec = createFrozenL3('coverage-standard');
    const { task: standard } = createTask({
      paths: project.paths,
      specCode: standardSpec,
      planJson: planFor(standardSpec),
      autoConfirm: false,
    });

    const report = buildProfileMetrics(project.paths);

    expect(report.evidence.governed).toMatchObject({
      required: 2,
      covered: 1,
      failed: 0,
      uncovered: 1,
      completedWithGaps: [{ specCode: governedSpec, taskId: governed.id, missing: ['AC-2'] }],
    });
    expect(report.evidence.standard.warnings).toBe(1);
    expect(report.evidence.standard.missing).toEqual([{ specCode: standardSpec, taskId: standard.id, missing: ['AC-1', 'AC-2'] }]);
  });

  it('lists explicit overrides with recorded reasons', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });
    const specCode = createFrozenL3('override-metrics');
    const { task } = createTask({
      paths: project.paths,
      specCode,
      planJson: planFor(specCode),
      autoConfirm: false,
      profile: 'governed',
      profileOverrideReason: 'auth migration risk',
    });

    const report = buildProfileMetrics(project.paths);

    expect(report.overrides).toEqual([{
      specCode,
      taskId: task.id,
      profile: 'governed',
      profileSource: 'explicit',
      reason: 'auth migration risk',
    }]);
  });

  it('filters metrics by topic and reports legacy compatibility when disabled', () => {
    const includedSpec = createFrozenL3('included-topic');
    createTask({ paths: project.paths, specCode: includedSpec, planJson: planFor(includedSpec), autoConfirm: false });
    const excludedSpec = createFrozenL3('excluded-topic');
    createTask({ paths: project.paths, specCode: excludedSpec, planJson: planFor(excludedSpec), autoConfirm: false });

    const report = buildProfileMetrics(project.paths, { topic: 'included-topic' });

    expect(report.topic).toBe('included-topic');
    expect(report.totals.tasks).toBe(1);
    expect(report.byProfile.legacy.tasks).toBe(1);
    expect(report.adaptiveWorkflow.enabled).toBe(false);
    expect(report.adaptiveWorkflow.note).toContain('legacy completion semantics');
  });

  it('rejects unsafe topic values with a stable error', () => {
    expect(() => buildProfileMetrics(project.paths, { topic: '../bad' }))
      .toThrow('INVALID_PROFILE_METRICS_TOPIC');
    expect(() => buildProfileMetrics(project.paths, { topic: '   ' }))
      .toThrow('INVALID_PROFILE_METRICS_TOPIC');
  });

  it('records invalid evidence projections and continues aggregating other tasks', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });
    const invalidSpec = createFrozenL3('invalid-projection', specContent().replace('- AC-2', '- AC-9'));
    const { task: invalidTask } = createTask({
      paths: project.paths,
      specCode: invalidSpec,
      planJson: planFor(invalidSpec),
      autoConfirm: false,
    });
    const validSpec = createFrozenL3('valid-projection');
    createTask({ paths: project.paths, specCode: validSpec, planJson: planFor(validSpec), autoConfirm: false });

    const report = buildProfileMetrics(project.paths);

    expect(report.totals.tasks).toBe(2);
    expect(report.evidence.invalidProjections).toEqual([{
      specCode: invalidSpec,
      taskId: invalidTask.id,
      error: 'UNKNOWN_CRITICAL_AC: AC-9',
    }]);
    expect(report.evidence.standard.warnings).toBe(1);
  });
});

function planFor(specCode: string) {
  return {
    coveredSpecs: [specCode],
    steps: [{ stepNo: 1, stepType: 'tool_action' as const, name: 'run verify test' }],
  };
}

function createFrozenL3(topic: string, content = specContent()): string {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths: project.paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(project.paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths: project.paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(project.paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths: project.paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(project.paths, l3Code, { content, aiSummary: 'Profile metrics fixture' });
  updateSpec(project.paths, l3Code, { status: 'frozen' });
  return l3Code;
}

function specContent(): string {
  return `# Metrics L3

## 目标

Test profile metrics.

## 实施步骤

- Implement.

## 验收标准

1. **AC-1**: first critical behavior
2. **AC-2**: second critical behavior
3. **AC-3**: non-critical behavior

## 关键验收标准

- AC-1
- AC-2

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

function taskPath(specCode: string, taskId: string): string {
  const topic = specCode.split('-L')[0];
  return join(project.paths.specsDir, topic, 'tasks', `${specCode}-${taskId}.json`);
}

function readTask(specCode: string, taskId: string): TaskRecord {
  return JSON.parse(readFileSync(taskPath(specCode, taskId), 'utf8')) as TaskRecord;
}

function writeTask(task: TaskRecord): void {
  writeFileSync(taskPath(task.specCode, task.id), JSON.stringify(task, null, 2), 'utf8');
}
