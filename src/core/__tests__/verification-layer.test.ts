import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, updateSpec, generateSpecCode } from '../spec-io.js';
import { addTaskVerification, createTask, startTask, showTask } from '../task.js';
import { assertTaskHasSuccessfulVerification } from '../invariants.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'verification-layer-'));
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
  steps: [{ stepNo: 1, stepType: 'mcp_tool' as const, name: 'run test' }],
};

describe('addTaskVerification — AC-4 layer 参数', () => {
  it('不传 layer 时默认 functional', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    const result = addTaskVerification({
      paths, taskId: task.id, specCode: l3Code,
      command: 'npm test', exitCode: 0, summary: 'passed',
    });

    expect(result.verification.layer).toBe('functional');
  });

  it('指定 layer 为 compile', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    const result = addTaskVerification({
      paths, taskId: task.id, specCode: l3Code,
      command: 'npm run lint', exitCode: 0, summary: 'lint passed',
      layer: 'compile',
    });

    expect(result.verification.layer).toBe('compile');
  });

  it('指定 layer 为 smoke', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    const result = addTaskVerification({
      paths, taskId: task.id, specCode: l3Code,
      command: 'node dist/cli/index.js --help', exitCode: 0, summary: 'smoke passed',
      layer: 'smoke',
    });

    expect(result.verification.layer).toBe('smoke');
  });
});

describe('showTask — verification 按 layer 分组', () => {
  it('不同 layer 的 verification 分组显示', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    addTaskVerification({
      paths, taskId: task.id, specCode: l3Code,
      command: 'npm run lint', exitCode: 0, summary: 'lint ok', layer: 'compile',
    });
    addTaskVerification({
      paths, taskId: task.id, specCode: l3Code,
      command: 'npm test', exitCode: 0, summary: 'test ok', layer: 'functional',
    });
    addTaskVerification({
      paths, taskId: task.id, specCode: l3Code,
      command: 'node dist/cli/index.js --help', exitCode: 0, summary: 'smoke ok', layer: 'smoke',
    });

    const result = showTask(paths, task.id, { specCode: l3Code });
    expect(result).not.toBeNull();
    expect(result!.verificationsByLayer['compile']).toHaveLength(1);
    expect(result!.verificationsByLayer['functional']).toHaveLength(1);
    expect(result!.verificationsByLayer['smoke']).toHaveLength(1);
    expect(result!.verificationsByLayer['compile'][0].command).toBe('npm run lint');
    expect(result!.verificationsByLayer['functional'][0].command).toBe('npm test');
    expect(result!.verificationsByLayer['smoke'][0].command).toBe('node dist/cli/index.js --help');
  });

  it('旧 verification 无 layer 时归入 functional', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    addTaskVerification({
      paths, taskId: task.id, specCode: l3Code,
      command: 'npm test', exitCode: 0, summary: 'passed',
    });

    const result = showTask(paths, task.id, { specCode: l3Code });
    expect(result).not.toBeNull();
    expect(result!.verificationsByLayer['functional']).toHaveLength(1);
  });
});

describe('assertTaskHasSuccessfulVerification — 按 layer 检查', () => {
  it('不传 layer 时检查所有 verification', () => {
    const l3Code = createFrozenL3();
    const planJson = { ...plan, coveredSpecs: [l3Code] };
    const { task } = createTask({ paths, specCode: l3Code, autoConfirm: false, planJson });
    startTask(paths, task.id);

    addTaskVerification({
      paths, taskId: task.id, specCode: l3Code,
      command: 'npm test', exitCode: 0, summary: 'passed', layer: 'functional',
    });

    const updated = { ...task, verifications: [{ id: 'V-001', command: 'npm test', exitCode: 0, summary: 'passed', artifacts: [], coversAc: [], created: new Date().toISOString(), layer: 'functional' as const }] };
    expect(() => assertTaskHasSuccessfulVerification(updated)).not.toThrow();
  });

  it('指定 layer 时仅检查该 layer', () => {
    const task = {
      id: 'T-001',
      specCode: 'test-L3',
      status: 'running' as const,
      autoConfirm: false,
      startedAt: null,
      finishedAt: null,
      created: new Date().toISOString(),
      waitReason: null,
      errorCode: null,
      errorMessage: null,
      lastFailedOutput: null,
      verifications: [
        { id: 'V-001', command: 'npm run lint', exitCode: 0, summary: 'ok', artifacts: [], coversAc: [], created: new Date().toISOString(), layer: 'compile' as const },
      ],
    };

    // compile layer 有成功 verification
    expect(() => assertTaskHasSuccessfulVerification(task, { layer: 'compile' })).not.toThrow();

    // functional layer 没有 verification
    expect(() => assertTaskHasSuccessfulVerification(task, { layer: 'functional' })).toThrow(/VERIFICATION_REQUIRED/);
  });
});
