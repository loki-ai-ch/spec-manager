import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, updateSpec, generateSpecCode } from '../spec-io.js';
import { createTask, startTask, reportStep, completeTask, findTask, listTasks, failTask, waitTask, showTask } from '../task.js';
import { hit as auditHit, readAudit } from '../audit.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-task-cascade-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/**
 * 把 plan 的所有步骤标记为 succeeded（R5: completeTask 前必须先逐个 reportStep）。
 */
function markPlanSucceeded(paths: ProjectPaths, specCode: string, planJson: { steps: Array<{ stepNo: number | string }> }, taskId: string): void {
  for (const s of planJson.steps) {
    reportStep({ paths, taskId, stepNo: s.stepNo, status: 'succeeded', outputJson: '{"summary":"ok"}' });
  }
}

/**
 * 完整 task cascade 到 L1 → cascadedL1Specs 应含 L1 code(R18 提示用)。
 */
describe('completeTask cascade → cascadedL1Specs', () => {
  it('cascadedL1Specs 正确收集 L1', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    const l3Code = generateSpecCode('auth', 'L3', l2Code);
    createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'auth', parentCode: l2Code });

    updateSpec(paths, l1Code, { status: 'confirmed' });
    updateSpec(paths, l1Code, { status: 'frozen' });
    updateSpec(paths, l2Code, { status: 'confirmed' });
    updateSpec(paths, l2Code, { status: 'frozen' });
    updateSpec(paths, l3Code, { status: 'confirmed' });
    updateSpec(paths, l3Code, { status: 'frozen' });

    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: { steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'do it' }] },
    });
    startTask(paths, task.id);
    markPlanSucceeded(paths, l3Code, { steps: [{ stepNo: 1 }] }, task.id);
    const result = completeTask({ paths, taskId: task.id });
    expect(result.cascadedL1Specs).toEqual([l1Code]);
    expect(result.cascadedSpecs.map(c => c.level)).toEqual(['L3', 'L2', 'L1']);
  });

  it('多个 L3 共享 L1 时,部分 L3 完成的 L1 不进 cascadedL1Specs', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    const l3a = generateSpecCode('auth', 'L3', l2Code, 0);
    createSpec({ paths, code: l3a, level: 'L3', title: 'L3a', topic: 'auth', parentCode: l2Code });
    const l3b = generateSpecCode('auth', 'L3', l2Code, 1);
    createSpec({ paths, code: l3b, level: 'L3', title: 'L3b', topic: 'auth', parentCode: l2Code });

    updateSpec(paths, l1Code, { status: 'confirmed' });
    updateSpec(paths, l1Code, { status: 'frozen' });
    updateSpec(paths, l2Code, { status: 'confirmed' });
    updateSpec(paths, l2Code, { status: 'frozen' });
    updateSpec(paths, l3a, { status: 'confirmed' });
    updateSpec(paths, l3a, { status: 'frozen' });
    updateSpec(paths, l3b, { status: 'confirmed' });
    updateSpec(paths, l3b, { status: 'frozen' });

    const { task: taskA } = createTask({
      paths,
      specCode: l3a,
      autoConfirm: false,
      planJson: { steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'do it' }] },
    });
    startTask(paths, taskA.id);
    markPlanSucceeded(paths, l3a, { steps: [{ stepNo: 1 }] }, taskA.id);
    const result = completeTask({ paths, taskId: taskA.id });
    expect(result.cascadedL1Specs).toEqual([]);
    expect(result.skippedSpecs.some(s => s.code === l2Code)).toBe(true);
    expect(result.skippedSpecs.some(s => s.code === l1Code)).toBe(false);
  });
});

describe('audit hit R18 联动 (P0 闭环)', () => {
  it('task complete 后手动 audit hit R18 落库', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    const l3Code = generateSpecCode('auth', 'L3', l2Code);
    createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'auth', parentCode: l2Code });

    updateSpec(paths, l1Code, { status: 'confirmed' });
    updateSpec(paths, l1Code, { status: 'frozen' });
    updateSpec(paths, l2Code, { status: 'confirmed' });
    updateSpec(paths, l2Code, { status: 'frozen' });
    updateSpec(paths, l3Code, { status: 'confirmed' });
    updateSpec(paths, l3Code, { status: 'frozen' });

    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: { steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'do it' }] },
    });
    startTask(paths, task.id);
    markPlanSucceeded(paths, l3Code, { steps: [{ stepNo: 1 }] }, task.id);
    completeTask({ paths, taskId: task.id });

    auditHit({ paths, ruleId: 'R18', specCode: l1Code });
    const audit = readAudit(paths);
    expect(audit.rules.R18).toBe(1);
    expect(audit.pending.some(p => p.ruleId === 'R18' && p.specCode === l1Code)).toBe(true);
  });
});

describe('R5 跳步检测 (P1 修复)', () => {
  it('有 pending 步骤时 completeTask 拒绝', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    const l3Code = generateSpecCode('auth', 'L3', l2Code);
    createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'auth', parentCode: l2Code });
    updateSpec(paths, l3Code, { status: 'frozen' });

    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: { steps: [
        { stepNo: 1, stepType: 'mcp_tool', name: 'do A' },
        { stepNo: 2, stepType: 'mcp_tool', name: 'do B' },
      ] },
    });
    startTask(paths, task.id);
    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"a"}' });
    expect(() => completeTask({ paths, taskId: task.id })).toThrow(/R5.*1 个步骤未完成/);
  });

  it('skipped 步视为完成,允许 completeTask', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    const l3Code = generateSpecCode('auth', 'L3', l2Code);
    createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'auth', parentCode: l2Code });
    updateSpec(paths, l3Code, { status: 'frozen' });

    const { task } = createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: { steps: [
        { stepNo: 1, stepType: 'mcp_tool', name: 'do A' },
        { stepNo: 2, stepType: 'mcp_tool', name: 'do B' },
      ] },
    });
    startTask(paths, task.id);
    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"a"}' });
    reportStep({ paths, taskId: task.id, stepNo: 2, status: 'skipped' });
    expect(() => completeTask({ paths, taskId: task.id })).not.toThrow();
  });
});

describe('R3 / R7 audit hit (P1 修复)', () => {
  it('非 frozen L3 建 task 触发 R3 audit hit', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const l2Code = generateSpecCode('auth', 'L2', l1Code);
    createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'auth', parentCode: l1Code });
    const l3Code = generateSpecCode('auth', 'L3', l2Code);
    createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'auth', parentCode: l2Code });
    expect(() => createTask({
      paths,
      specCode: l3Code,
      autoConfirm: false,
      planJson: { steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'do' }] },
    })).toThrow(/R3/);
    const audit = readAudit(paths);
    expect(audit.rules.R3).toBe(1);
    expect(audit.pending.some(p => p.ruleId === 'R3' && p.specCode === l3Code)).toBe(true);
  });

  it('L2 无 parent 触发 R7 audit hit', () => {
    const code = generateSpecCode('auth', 'L2');
    expect(() => createSpec({
      paths, code, level: 'L2', title: 'bad', topic: 'auth', parentCode: null,
    })).toThrow(/R7/);
    const audit = readAudit(paths);
    expect(audit.rules.R7).toBe(1);
  });

  it('L3 parent 是 L1 触发 R7 audit hit', () => {
    const l1Code = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'auth', parentCode: null });
    const code = generateSpecCode('auth', 'L3', l1Code);
    expect(() => createSpec({
      paths, code, level: 'L3', title: 'bad', topic: 'auth', parentCode: l1Code,
    })).toThrow(/R7.*L3.*L2/);
    const audit = readAudit(paths);
    expect(audit.rules.R7).toBe(1);
  });
});

describe('T-001 跨 spec 冲突修复 (specCode scoped lookup)', () => {
  /**
   * 两个不同 L3 spec 各建一个 T-001，验证:
   * - findTask(paths, specCode, 'T-001') 能区分
   * - startTask(paths, 'T-001', specCode) 能区分
   * - completeTask({ paths, taskId: 'T-001', specCode }) 能区分
   */
  function setupTwoL3sWithT001() {
    const l1a = generateSpecCode('auth', 'L1');
    createSpec({ paths, code: l1a, level: 'L1', title: 'Auth L1', topic: 'auth', parentCode: null });
    const l2a = generateSpecCode('auth', 'L2', l1a);
    createSpec({ paths, code: l2a, level: 'L2', title: 'Auth L2', topic: 'auth', parentCode: l1a });
    const l3a = generateSpecCode('auth', 'L3', l2a);
    createSpec({ paths, code: l3a, level: 'L3', title: 'Auth L3', topic: 'auth', parentCode: l2a });
    updateSpec(paths, l3a, { status: 'frozen' });

    const l1b = generateSpecCode('billing', 'L1');
    createSpec({ paths, code: l1b, level: 'L1', title: 'Billing L1', topic: 'billing', parentCode: null });
    const l2b = generateSpecCode('billing', 'L2', l1b);
    createSpec({ paths, code: l2b, level: 'L2', title: 'Billing L2', topic: 'billing', parentCode: l1b });
    const l3b = generateSpecCode('billing', 'L3', l2b);
    createSpec({ paths, code: l3b, level: 'L3', title: 'Billing L3', topic: 'billing', parentCode: l2b });
    updateSpec(paths, l3b, { status: 'frozen' });

    const { task: taskA } = createTask({
      paths, specCode: l3a, autoConfirm: false,
      planJson: { steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'auth step' }] },
    });
    const { task: taskB } = createTask({
      paths, specCode: l3b, autoConfirm: false,
      planJson: { steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'billing step' }] },
    });

    return { l3a, l3b, taskA, taskB };
  }

  it('两个 L3 各有 T-001，findTask 用 specCode 区分', () => {
    const { l3a, l3b, taskA, taskB } = setupTwoL3sWithT001();
    expect(taskA.id).toBe('T-001');
    expect(taskB.id).toBe('T-001');
    // findTask with specCode returns correct task
    const foundA = findTask(paths, l3a, 'T-001');
    const foundB = findTask(paths, l3b, 'T-001');
    expect(foundA).not.toBeNull();
    expect(foundB).not.toBeNull();
    expect(foundA!.specCode).toBe(l3a);
    expect(foundB!.specCode).toBe(l3b);
  });

  it('startTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    startTask(paths, 'T-001', l3a);
    // l3a's T-001 is running, l3b's T-001 is still draft
    const a = findTask(paths, l3a, 'T-001');
    const b = findTask(paths, l3b, 'T-001');
    expect(a!.status).toBe('running');
    expect(b!.status).toBe('draft');
  });

  it('completeTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    startTask(paths, 'T-001', l3a);
    reportStep({ paths, taskId: 'T-001', specCode: l3a, stepNo: 1, status: 'succeeded', outputJson: '{"summary":"ok"}' });
    completeTask({ paths, taskId: 'T-001', specCode: l3a });
    // l3a's T-001 completed, l3b's T-001 still draft
    const a = findTask(paths, l3a, 'T-001');
    const b = findTask(paths, l3b, 'T-001');
    expect(a!.status).toBe('completed');
    expect(b!.status).toBe('draft');
  });

  it('listTasks 按 specCode 过滤', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    const authTasks = listTasks(paths, { specCode: l3a });
    const billingTasks = listTasks(paths, { specCode: l3b });
    expect(authTasks).toHaveLength(1);
    expect(billingTasks).toHaveLength(1);
    expect(authTasks[0].specCode).toBe(l3a);
    expect(billingTasks[0].specCode).toBe(l3b);
  });

  it('showTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    const shownA = showTask(paths, 'T-001', { specCode: l3a });
    const shownB = showTask(paths, 'T-001', { specCode: l3b });
    expect(shownA).not.toBeNull();
    expect(shownB).not.toBeNull();
    expect(shownA!.task.specCode).toBe(l3a);
    expect(shownB!.task.specCode).toBe(l3b);
  });

  it('failTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    startTask(paths, 'T-001', l3a);
    failTask({ paths, taskId: 'T-001', specCode: l3a, errorCode: 'TEST', errorMessage: 'test fail' });
    const a = findTask(paths, l3a, 'T-001');
    const b = findTask(paths, l3b, 'T-001');
    expect(a!.status).toBe('failed');
    expect(b!.status).toBe('draft');
  });

  it('waitTask 用 specCode 区分同名 T-001', () => {
    const { l3a, l3b } = setupTwoL3sWithT001();
    startTask(paths, 'T-001', l3a);
    waitTask({ paths, taskId: 'T-001', specCode: l3a, reason: 'waiting for auth' });
    const a = findTask(paths, l3a, 'T-001');
    const b = findTask(paths, l3b, 'T-001');
    expect(a!.status).toBe('waiting');
    expect(b!.status).toBe('draft');
  });
});
