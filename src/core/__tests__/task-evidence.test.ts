import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, generateSpecCode, updateSpec } from '../spec-io.js';
import { addTaskVerification, createTask, startTask } from '../task.js';
import { buildTaskEvidence, evaluateEvidenceCoverage } from '../task-evidence.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-task-evidence-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function planFor(specCode: string) {
  return {
    coveredSpecs: [specCode],
    steps: [{ stepNo: 1, stepType: 'mcp_tool' as const, name: 'run verify test' }],
  };
}

function createFrozenL3(topic: string, content = specContent()): string {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(paths, l3Code, { content, aiSummary: 'Evidence projection fixture' });
  updateSpec(paths, l3Code, { status: 'frozen' });
  return l3Code;
}

function specContent(): string {
  return `# Evidence L3

## 目标

Test evidence projection.

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
{"coveredSpecs":["x"],"steps":[{"stepNo":1,"stepType":"mcp_tool","name":"run verify test"}]}
\`\`\`

## 回滚方案

Rollback.
`;
}

describe('buildTaskEvidence', () => {
  it('projects critical AC coverage from task verification records', () => {
    writeAdaptiveWorkflowConfig(paths, { enabled: true, defaultProfile: 'governed' });
    const specCode = createFrozenL3('evidence-projection');
    const { task } = createTask({ paths, specCode, planJson: planFor(specCode), autoConfirm: false });
    startTask(paths, task.id, specCode);
    addTaskVerification({
      paths,
      specCode,
      taskId: task.id,
      command: 'npm test',
      exitCode: 1,
      summary: 'failed first',
      artifacts: ['coverage/index.html'],
      coversAc: ['AC-1'],
    });
    addTaskVerification({
      paths,
      specCode,
      taskId: task.id,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed first',
      artifacts: ['coverage/index.html', 'reports/evidence.json'],
      coversAc: ['AC-1', 'AC-3'],
    });

    const evidence = buildTaskEvidence(paths, task.id, specCode);

    expect(evidence.schemaVersion).toBe('task-evidence.experimental.v1');
    expect(evidence.profile).toBe('governed');
    expect(evidence.criticalCriteria.map(item => [item.id, item.status, item.verificationIds])).toEqual([
      ['AC-1', 'covered', ['V-001', 'V-002']],
      ['AC-2', 'uncovered', []],
    ]);
    expect(evidence.summary).toEqual({ required: 2, covered: 1, failed: 0, uncovered: 1 });
    expect(evidence.artifacts).toEqual(['coverage/index.html', 'reports/evidence.json']);
  });

  it('treats old tasks without profile as legacy and non-blocking', () => {
    const specCode = createFrozenL3('legacy-evidence');
    const { task } = createTask({ paths, specCode, planJson: planFor(specCode), autoConfirm: false });
    const evidence = buildTaskEvidence(paths, task.id, specCode);

    expect(evidence.profile).toBe('legacy');
    expect(evaluateEvidenceCoverage(evidence)).toEqual({
      satisfied: true,
      blockingCriteria: [],
      summary: { required: 2, covered: 0, failed: 0, uncovered: 2 },
    });
  });

  it('reports failed criteria when only failing verification covers the AC', () => {
    writeAdaptiveWorkflowConfig(paths, { enabled: true, defaultProfile: 'governed' });
    const specCode = createFrozenL3('failed-evidence');
    const { task } = createTask({ paths, specCode, planJson: planFor(specCode), autoConfirm: false });
    startTask(paths, task.id, specCode);
    addTaskVerification({
      paths,
      specCode,
      taskId: task.id,
      command: 'npm test',
      exitCode: 1,
      summary: 'failed',
      coversAc: ['AC-2'],
    });

    const evidence = buildTaskEvidence(paths, task.id, specCode);

    expect(evidence.criticalCriteria.map(item => [item.id, item.status])).toEqual([
      ['AC-1', 'uncovered'],
      ['AC-2', 'failed'],
    ]);
    expect(evaluateEvidenceCoverage(evidence)).toMatchObject({
      satisfied: false,
      blockingCriteria: ['AC-1', 'AC-2'],
    });
  });

  it('throws stable errors for missing task, missing spec, and unknown critical AC', () => {
    expect(() => buildTaskEvidence(paths, 'T-404')).toThrow(/TASK_NOT_FOUND: T-404/);

    expect(() => buildTaskEvidence(paths, 'T-001', 'missing-L3')).toThrow(/SPEC_NOT_FOUND: missing-L3/);

    writeAdaptiveWorkflowConfig(paths, { enabled: true, defaultProfile: 'standard' });
    const specCode = createFrozenL3('unknown-critical', specContent().replace('- AC-2', '- AC-9'));
    const { task } = createTask({ paths, specCode, planJson: planFor(specCode), autoConfirm: false });
    expect(() => buildTaskEvidence(paths, task.id, specCode)).toThrow(/UNKNOWN_CRITICAL_AC: AC-9/);
  });
});
