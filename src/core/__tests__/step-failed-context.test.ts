import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, updateSpec, generateSpecCode } from '../spec-io.js';
import { createTask, startTask, reportStep, findTask } from '../task.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'step-failed-context-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function createFrozenL3(): string {
  const l1Code = generateSpecCode('test', 'L1');
  createSpec({ paths, code: l1Code, level: 'L1', title: 'L1', topic: 'test', parentCode: null });
  updateSpec(paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode('test', 'L2', l1Code);
  createSpec({ paths, code: l2Code, level: 'L2', title: 'L2', topic: 'test', parentCode: l1Code });
  updateSpec(paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode('test', 'L3', l2Code);
  createSpec({ paths, code: l3Code, level: 'L3', title: 'L3', topic: 'test', parentCode: l2Code });
  updateSpec(paths, l3Code, { status: 'frozen' });
  return l3Code;
}

const plan = {
  coveredSpecs: ['test-L3'],
  steps: [
    { stepNo: 1, stepType: 'tool_action' as const, name: 'step one' },
    { stepNo: 2, stepType: 'tool_action' as const, name: 'step two' },
    { stepNo: 3, stepType: 'tool_action' as const, name: 'run verify test' },
  ],
};

describe('reportStep — AC-3 step failed 上下文注入', () => {
  it('step failed 时 lastFailedOutput 被持久化', () => {
    const l3Code = createFrozenL3();
    // 用 l3Code 替换 plan 中的 coveredSpecs
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    const failedOutput = JSON.stringify({ summary: '编译错误: Cannot find module', error: 'TS2307' });
    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'failed', outputJson: failedOutput });

    const updated = findTask(paths, l3Code, task.id);
    expect(updated?.lastFailedOutput).toBe(failedOutput);
  });

  it('无 outputJson 的 failed step 不改变 lastFailedOutput', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'failed' });

    const updated = findTask(paths, l3Code, task.id);
    expect(updated?.lastFailedOutput).toBeNull();
  });

  it('下次 step 调用在 warnings 中包含上次失败摘要', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    const failedOutput = JSON.stringify({ summary: '编译错误: TS2307' });
    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'failed', outputJson: failedOutput });

    // 下次 reportStep（不同 step）
    const result = reportStep({ paths, taskId: task.id, stepNo: 2, status: 'succeeded', outputJson: '{"summary":"ok"}' });

    expect(result.warnings.some(w => w.includes('上次 step 失败摘要'))).toBe(true);
    expect(result.warnings.some(w => w.includes('编译错误'))).toBe(true);
  });

  it('长 outputJson 在 warnings 中被截断', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    const longOutput = 'x'.repeat(500);
    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'failed', outputJson: longOutput });

    const result = reportStep({ paths, taskId: task.id, stepNo: 2, status: 'succeeded', outputJson: '{"summary":"ok"}' });

    const warning = result.warnings.find(w => w.includes('上次 step 失败摘要'));
    expect(warning).toBeDefined();
    expect(warning!.length).toBeLessThan(500); // 截断到 200 + prefix
  });

  it('成功 step 不清除 lastFailedOutput', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    reportStep({ paths, taskId: task.id, stepNo: 1, status: 'failed', outputJson: '{"error":"fail"}' });
    reportStep({ paths, taskId: task.id, stepNo: 2, status: 'succeeded', outputJson: '{"summary":"ok"}' });

    const updated = findTask(paths, l3Code, task.id);
    expect(updated?.lastFailedOutput).toBe('{"error":"fail"}');
  });
});
