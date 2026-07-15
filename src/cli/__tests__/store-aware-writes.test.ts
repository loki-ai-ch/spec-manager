import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerDecisionCommands } from '../decision.js';
import { registerSpec } from '../spec.js';
import { registerTaskCommands } from '../task.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { getPaths, specFilePath } from '../../core/paths.js';
import { findDecision } from '../../core/decision.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';
import { findTask } from '../../core/task.js';

let project: TestProject;
let external: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createInitializedProject('spec-mgr-store-exec-');
  external = createInitializedProject('spec-mgr-store-write-');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw new Error(`process.exit:${code}`);
  }) as never);
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) {
    delete process.env.SPEC_MANAGER_ROOT;
  } else {
    process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  }
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  project.cleanup();
  external.cleanup();
});

function createInitializedProject(prefix: string): TestProject {
  const p = createTestProject(prefix);
  mkdirSync(p.paths.specsDir, { recursive: true });
  mkdirSync(p.paths.changesDir, { recursive: true });
  mkdirSync(p.paths.archiveDir, { recursive: true });
  writeFileSync(p.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(p.paths.auditFile, '{}', 'utf8');
  return p;
}

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSpec(program);
  registerTaskCommands(program);
  registerDecisionCommands(program);
  return program;
}

function configureExternalWriteStore(writeRoot = external.root): void {
  writeFileSync(project.paths.configFile, [
    'project_name: execution',
    'specStore:',
    '  id: product-planning',
    `  path: ${JSON.stringify(writeRoot)}`,
    '  mode: write',
    '',
  ].join('\n'), 'utf8');
}

function stderr(): string {
  return errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function createExternalFrozenL3(): string {
  createSpec({ paths: external.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(external.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: external.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(external.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: external.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth task', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(external.paths, 'auth-L3.1.1', {
    status: 'frozen',
    content: `# Auth task

## 目标
Use external store.

## 实施步骤
Run task command.

## 验证命令
npm test
`,
    aiSummary: 'external auth task',
  });
  return 'auth-L3.1.1';
}

function writePlanFile(specCode: string): string {
  const planFile = join(project.root, 'plan.json');
  writeFileSync(planFile, JSON.stringify({
    coveredSpecs: [specCode],
    steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run external store test' }],
  }), 'utf8');
  return planFile;
}

describe('store-aware spec/task/decision writes', () => {
  it('keeps local spec writes when specStore is not configured', async () => {
    await makeProgram().parseAsync(['spec', 'new', 'L1', '--topic', 'local', '--title', 'Local'], { from: 'user' });

    expect(existsSync(specFilePath(project.paths, null, 'local-L1', 'local'))).toBe(true);
    expect(findSpecByCode(project.paths, 'local-L1')?.fm.title).toBe('Local');
  });

  it('keeps the original initialization error when no specStore is configured', async () => {
    const uninitialized = createTestProject('spec-mgr-store-uninit-', { initialized: false });
    process.env.SPEC_MANAGER_ROOT = uninitialized.root;
    try {
      await expect(makeProgram().parseAsync(['spec', 'new', 'L1', '--topic', 'local', '--title', 'Local'], { from: 'user' }))
        .rejects.toThrow('process.exit:1');
    } finally {
      process.env.SPEC_MANAGER_ROOT = project.root;
      uninitialized.cleanup();
    }

    expect(stderr()).toContain('项目未初始化');
    expect(stderr()).not.toContain('SPEC_STORE_WRITE_ROOT_INVALID');
  });

  it('writes spec new output to the configured external write root', async () => {
    configureExternalWriteStore();

    await makeProgram().parseAsync(['spec', 'new', 'L1', '--topic', 'auth', '--title', 'Auth'], { from: 'user' });

    expect(existsSync(specFilePath(external.paths, null, 'auth-L1', 'auth'))).toBe(true);
    expect(existsSync(specFilePath(project.paths, null, 'auth-L1', 'auth'))).toBe(false);
    expect(findSpecByCode(external.paths, 'auth-L1')?.fm.title).toBe('Auth');
  });

  it('creates and starts tasks from specs in the configured external write root', async () => {
    configureExternalWriteStore();
    const specCode = createExternalFrozenL3();

    await makeProgram().parseAsync(['task', 'create', specCode, '--plan', writePlanFile(specCode)], { from: 'user' });
    await makeProgram().parseAsync(['task', 'start', 'T-001', '--spec', specCode], { from: 'user' });

    expect(findTask(external.paths, specCode, 'T-001')?.status).toBe('running');
    expect(findTask(project.paths, specCode, 'T-001')).toBeNull();
  });

  it('runs tasks from specs in the configured external write root', async () => {
    configureExternalWriteStore();
    const specCode = createExternalFrozenL3();

    await makeProgram().parseAsync(['task', 'run', specCode, '--plan', writePlanFile(specCode)], { from: 'user' });

    expect(findTask(external.paths, specCode, 'T-001')?.status).toBe('running');
    expect(findTask(project.paths, specCode, 'T-001')).toBeNull();
  });

  it('creates and lists decisions from the configured external write root', async () => {
    configureExternalWriteStore();
    createSpec({ paths: external.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(external.paths, 'auth-L1', { status: 'confirmed' });

    await makeProgram().parseAsync([
      'decision', 'create', 'auth-L1',
      '--topic', 'auth',
      '--what', 'Use token login',
      '--why', 'It matches product auth needs',
    ], { from: 'user' });
    await makeProgram().parseAsync(['decision', 'list', '--topic', 'auth'], { from: 'user' });

    expect(findDecision(external.paths, 'DC-001')?.fm.what).toBe('Use token login');
    expect(findDecision(project.paths, 'DC-001')).toBeNull();
    expect(logSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('DC-001');
  });

  it('fails fast with a fix when the configured write root is missing', async () => {
    configureExternalWriteStore(join(project.root, 'missing-spec-store'));

    await expect(makeProgram().parseAsync(['spec', 'new', 'L1', '--topic', 'auth', '--title', 'Auth'], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('SPEC_STORE_WRITE_ROOT_INVALID');
    expect(stderr()).toContain('store_path_missing');
    expect(stderr()).toContain('fix:');
    expect(findSpecByCode(getPaths(project.root), 'auth-L1')).toBeNull();
  });
});
