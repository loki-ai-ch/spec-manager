import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerChangeCommands } from '../change.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, updateSpec } from '../../core/spec-io.js';
import { createTask } from '../../core/task.js';
import { readTaskLinkedChangeProposal } from '../../core/delta.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-change-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
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
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerChangeCommands(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function stderr(): string {
  return errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function createFrozenL3WithTask(): string {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1-login', level: 'L3', title: 'Login', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1-login', { status: 'confirmed' });
  updateSpec(project.paths, 'auth-L3.1.1-login', {
    content: `# Login

## 目标

- Implement login.

## 验收标准

1. **AC-1**: Given login task, When complete, Then evidence SHALL exist.
`,
    aiSummary: 'Login summary',
    changeSummary: 'test fixture content',
  });
  updateSpec(project.paths, 'auth-L3.1.1-login', { status: 'frozen' });
  createTask({
    paths: project.paths,
    specCode: 'auth-L3.1.1-login',
    autoConfirm: false,
    planJson: {
      coveredSpecs: ['auth-L3.1.1-login'],
      steps: [{ stepNo: 1, stepType: 'tool_action' as const, name: '运行验证' }],
    },
  });
  return 'auth-L3.1.1-login';
}

describe('change CLI task-linked proposals', () => {
  it('creates proposal from flags', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync([
      'change', 'propose',
      '--task', 'T-001',
      '--spec', specCode,
      '--reason', 'implementation drift',
      '--impact', 'L3 AC',
    ], { from: 'user' });

    expect(output()).toContain('Change proposal created: auth-l3-1-1-login-t-001-proposal');
    const proposal = readTaskLinkedChangeProposal(project.paths, 'auth-l3-1-1-login-t-001-proposal');
    expect(proposal?.status).toBe('unresolved');
  });

  it('prints proposal json', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync([
      'change', 'propose',
      '--task', 'T-001',
      '--spec', specCode,
      '--reason', 'implementation drift',
      '--impact', 'L3 AC',
      '--json',
    ], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.name).toBe('auth-l3-1-1-login-t-001-proposal');
    expect(parsed.status).toBe('unresolved');
    expect(parsed.taskCode).toBe('T-001');
  });

  it('lists and shows task-linked proposal metadata', async () => {
    const specCode = createFrozenL3WithTask();
    await makeProgram().parseAsync([
      'change', 'propose',
      '--task', 'T-001',
      '--spec', specCode,
      '--reason', 'implementation drift',
      '--impact', 'L3 AC',
    ], { from: 'user' });
    logSpy.mockClear();

    await makeProgram().parseAsync(['change', 'list'], { from: 'user' });
    expect(output()).toContain('auth-l3-1-1-login-t-001-proposal  unresolved  task=T-001');
    logSpy.mockClear();

    await makeProgram().parseAsync(['change', 'show', 'auth-l3-1-1-login-t-001-proposal', '--json'], { from: 'user' });
    const parsed = JSON.parse(output());
    expect(parsed.changes).toEqual([]);
    expect(parsed.proposal.status).toBe('unresolved');
  });

  it('resolves task-linked proposal', async () => {
    const specCode = createFrozenL3WithTask();
    await makeProgram().parseAsync([
      'change', 'propose',
      '--task', 'T-001',
      '--spec', specCode,
      '--reason', 'implementation drift',
      '--impact', 'L3 AC',
    ], { from: 'user' });
    logSpy.mockClear();

    await makeProgram().parseAsync(['change', 'resolve', 'auth-l3-1-1-login-t-001-proposal'], { from: 'user' });

    expect(output()).toContain('Change proposal resolved: auth-l3-1-1-login-t-001-proposal');
    expect(readTaskLinkedChangeProposal(project.paths, 'auth-l3-1-1-login-t-001-proposal')?.status).toBe('resolved');
  });

  it('reports validation errors with exit code 2', async () => {
    const specCode = createFrozenL3WithTask();

    await expect(makeProgram().parseAsync([
      'change', 'propose',
      '--task', 'T-999',
      '--spec', specCode,
      '--reason', 'implementation drift',
      '--impact', 'L3 AC',
    ], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('TASK_NOT_FOUND');
  });
});
