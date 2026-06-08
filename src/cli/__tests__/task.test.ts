import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerTaskCommands } from '../task.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, updateSpec } from '../../core/spec-io.js';
import { createTask } from '../../core/task.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-task-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) {
    delete process.env.SPEC_MANAGER_ROOT;
  } else {
    process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  }
  logSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerTaskCommands(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function createFrozenL3WithTask(): string {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1-login', level: 'L3', title: 'Login', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1-login', { status: 'confirmed' });
  updateSpec(project.paths, 'auth-L3.1.1-login', { status: 'frozen' });
  createTask({
    paths: project.paths,
    specCode: 'auth-L3.1.1-login',
    autoConfirm: false,
    planJson: {
      coveredSpecs: ['auth-L3.1.1-login'],
      steps: Array.from({ length: 8 }, (_, i) => ({
        stepNo: i + 1,
        stepType: 'mcp_tool' as const,
        name: i === 7 ? 'run verify test' : `inspect file ${i + 1}`,
      })),
    },
  });
  return 'auth-L3.1.1-login';
}

describe('task CLI', () => {
  it('prints shownSteps and totalSteps for truncated task show', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync(['task', 'show', 'T-001', '--spec', specCode], { from: 'user' });

    expect(output()).toContain('shownSteps: 5');
    expect(output()).toContain('totalSteps: 8');
    expect(output()).toContain('truncated: true');
  });
});
