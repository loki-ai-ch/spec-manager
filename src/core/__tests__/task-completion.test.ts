import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, findSpecByCode, generateSpecCode, updateSpec, writeSpec } from '../spec-io.js';
import { addTaskVerification, completeTask, createTask, findTask, reportStep, startTask } from '../task.js';
import { runTaskCompletion } from '../task-completion.js';
import { readAudit } from '../audit.js';
import { CollectingAuditSink } from '../audit-events.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-task-completion-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function createFrozenHierarchy(topic = 'task-completion', content = l3Content()): { l1Code: string; l2Code: string; l3Code: string } {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(paths, l3Code, { status: 'frozen', content, aiSummary: 'task completion fixture' });
  return { l1Code, l2Code, l3Code };
}

function l3Content(extraAcceptance = ''): string {
  return `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. AC-1
${extraAcceptance}

## 代码调查
\`src/core/task-completion.ts\`
`;
}

function l3ContentWithCriticalAc(): string {
  return `# L3

## 目标
goal

## 实施步骤
steps

## 验证命令
\`\`\`bash
echo ok
\`\`\`

## 验收标准
1. **AC-1**: critical behavior

## 关键验收标准
- AC-1

## 代码调查
\`src/core/task-completion.ts\`
`;
}

function planFor(specCode: string, steps = [
  { stepNo: 1, stepType: 'mcp_tool' as const, name: 'edit task completion module' },
  { stepNo: 2, stepType: 'mcp_tool' as const, name: 'run task completion test' },
]) {
  return { coveredSpecs: [specCode], steps };
}

function createRunningTask(specCode: string, opts?: { markSteps?: boolean; verification?: boolean }) {
  const planJson = planFor(specCode);
  const { task } = createTask({ paths, specCode, autoConfirm: false, planJson });
  startTask(paths, task.id, specCode);
  if (opts?.markSteps) {
    for (const step of planJson.steps) {
      reportStep({ paths, taskId: task.id, specCode, stepNo: step.stepNo, status: 'succeeded', outputJson: '{"summary":"done"}' });
    }
  }
  if (opts?.verification) {
    addTaskVerification({ paths, taskId: task.id, specCode, command: 'npm test', exitCode: 0, summary: 'passed' });
  }
  return task;
}

describe('runTaskCompletion', () => {
  it('completes task when gates pass and R18 is skipped with reason', () => {
    const { l3Code } = createFrozenHierarchy('completion-success');
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    const result = runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    });

    expect(result.task.status).toBe('completed');
    expect(Object.keys(result).sort()).toEqual([
      'cascadedL1Specs',
      'cascadedSpecs',
      'gateResults',
      'skippedSpecs',
      'task',
    ]);
    expect(result.cascadedSpecs.map(spec => spec.code)).toContain(l3Code);
    expect(result.gateResults.some(gate => gate.gate === 'verification-commands' && gate.status === 'passed')).toBe(true);
    expect(findSpecByCode(paths, l3Code)?.fm.status).toBe('implemented');
  });

  it('keeps completeTask facade result limited to the legacy fields', () => {
    const { l3Code } = createFrozenHierarchy('completion-facade');
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    const result = completeTask({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    });

    expect(Object.keys(result).sort()).toEqual([
      'cascadedL1Specs',
      'cascadedSpecs',
      'skippedSpecs',
      'task',
    ]);
    expect('gateResults' in result).toBe(false);
  });

  it('requires bypass reason when any completion gate is skipped', () => {
    const { l3Code } = createFrozenHierarchy('completion-bypass');
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    expect(() => runTaskCompletion({ paths, taskId: task.id, specCode: l3Code, skipR18Check: true }))
      .toThrow(/BYPASS_REASON_REQUIRED/);
    expect(findTask(paths, l3Code, task.id)?.status).toBe('running');
  });

  it('rejects pending steps and leaves task running', () => {
    const { l3Code } = createFrozenHierarchy('completion-r5');
    const task = createRunningTask(l3Code, { verification: true });

    expect(() => runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    })).toThrow(/R5/);
    expect(findTask(paths, l3Code, task.id)?.status).toBe('running');
    expect(readAudit(paths).rules.R5).toBe(1);
  });

  it('records R5 once in a collecting sink when completion rolls back', () => {
    const { l3Code } = createFrozenHierarchy('completion-r5-sink');
    const task = createRunningTask(l3Code, { verification: true });
    const auditSink = new CollectingAuditSink();

    expect(() => runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
      auditSink,
    })).toThrow(/R5/);

    expect(auditSink.events.filter(event => event.ruleId === 'R5')).toHaveLength(1);
    expect(readAudit(paths).rules.R5).toBe(0);
  });

  it('persists R6 audit after non-frozen L3 completion failure', () => {
    const { l3Code } = createFrozenHierarchy('completion-r6');
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });
    const l3 = findSpecByCode(paths, l3Code)!;
    writeSpec({ ...l3, fm: { ...l3.fm, status: 'confirmed' } });

    expect(() => runTaskCompletion({ paths, taskId: task.id, specCode: l3Code })).toThrow(/R6/);

    expect(findTask(paths, l3Code, task.id)?.status).toBe('running');
    expect(readAudit(paths).rules.R6).toBe(1);
  });

  it('persists R18 audit after decision gate rolls back the cascade', () => {
    const { l1Code, l2Code, l3Code } = createFrozenHierarchy('completion-r18');
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    expect(() => runTaskCompletion({ paths, taskId: task.id, specCode: l3Code })).toThrow(/R18/);

    expect(findTask(paths, l3Code, task.id)?.status).toBe('running');
    expect(findSpecByCode(paths, l3Code)?.fm.status).toBe('frozen');
    expect(findSpecByCode(paths, l2Code)?.fm.status).toBe('confirmed');
    expect(findSpecByCode(paths, l1Code)?.fm.status).toBe('confirmed');
    expect(readAudit(paths).rules.R18).toBe(1);
  });

  it('requires successful verification evidence', () => {
    const { l3Code } = createFrozenHierarchy('completion-verification');
    const task = createRunningTask(l3Code, { markSteps: true });

    expect(() => runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    })).toThrow(/VERIFICATION_REQUIRED/);
    expect(readAudit(paths).rules.R5).toBe(0);
    expect(readAudit(paths).rules.R6).toBe(0);
    expect(readAudit(paths).rules.R18).toBe(0);
  });

  it('rejects failed @verify rules', () => {
    const { l3Code } = createFrozenHierarchy(
      'completion-verify-rule',
      l3Content('2. @verify: file-exists(missing-task-completion-fixture.ts)'),
    );
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    expect(() => runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    })).toThrow(/@verify 规则失败/);
  });

  it('executes passing @verify rules', () => {
    writeFileSync(join(root, 'exists.ts'), 'export const marker = true;');
    const { l3Code } = createFrozenHierarchy(
      'completion-verify-pass',
      l3Content('2. @verify: file-exists(exists.ts)'),
    );
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    const result = runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    });

    expect(result.task.status).toBe('completed');
    expect(result.gateResults.some(gate => gate.gate === 'verify-rules' && gate.status === 'passed')).toBe(true);
  });

  it('keeps legacy task completion compatible with evidence coverage gate', () => {
    const { l3Code } = createFrozenHierarchy('completion-evidence-legacy', l3ContentWithCriticalAc());
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    const result = runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    });

    const evidenceGate = result.gateResults.find(gate => gate.gate === 'evidence-coverage');
    expect(result.task.status).toBe('completed');
    expect(evidenceGate).toMatchObject({
      status: 'passed',
      metadata: { profile: 'legacy', required: 1, covered: 0, uncovered: 1 },
    });
  });

  it('allows standard task completion with evidence warning', () => {
    writeAdaptiveWorkflowConfig(paths, { enabled: true, defaultProfile: 'standard' });
    const { l3Code } = createFrozenHierarchy('completion-evidence-standard', l3ContentWithCriticalAc());
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    const result = runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    });

    const evidenceGate = result.gateResults.find(gate => gate.gate === 'evidence-coverage');
    expect(result.task.status).toBe('completed');
    expect(evidenceGate).toMatchObject({
      status: 'passed',
      metadata: { profile: 'standard', warning: true, blockingCriteria: ['AC-1'] },
    });
  });

  it('blocks governed task completion when critical AC evidence is missing and rolls back state', () => {
    writeAdaptiveWorkflowConfig(paths, { enabled: true, defaultProfile: 'governed' });
    const { l3Code } = createFrozenHierarchy('completion-evidence-governed-block', l3ContentWithCriticalAc());
    const task = createRunningTask(l3Code, { markSteps: true, verification: true });

    expect(() => runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    })).toThrow(/EVIDENCE_COVERAGE_REQUIRED.*AC-1/);

    expect(findTask(paths, l3Code, task.id)?.status).toBe('running');
    expect(findSpecByCode(paths, l3Code)?.fm.status).toBe('frozen');
  });

  it('allows governed task completion when every critical AC has successful evidence', () => {
    writeAdaptiveWorkflowConfig(paths, { enabled: true, defaultProfile: 'governed' });
    const { l3Code } = createFrozenHierarchy('completion-evidence-governed-pass', l3ContentWithCriticalAc());
    const planJson = planFor(l3Code);
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id, l3Code);
    for (const step of planJson.steps) {
      reportStep({ paths, taskId: task.id, specCode: l3Code, stepNo: step.stepNo, status: 'succeeded', outputJson: '{"summary":"done"}' });
    }
    addTaskVerification({ paths, taskId: task.id, specCode: l3Code, command: 'npm test', exitCode: 0, summary: 'passed', coversAc: ['AC-1'] });

    const result = runTaskCompletion({
      paths,
      taskId: task.id,
      specCode: l3Code,
      skipR18Check: true,
      bypassReason: 'test fixture',
    });

    expect(result.task.status).toBe('completed');
    expect(result.gateResults.find(gate => gate.gate === 'evidence-coverage')).toMatchObject({
      status: 'passed',
      metadata: { profile: 'governed', required: 1, covered: 1, blockingCriteria: [] },
    });
  });
});
