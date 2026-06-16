import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { createTask, reportStep, startTask } from '../../core/task.js';
import { createSpec, updateSpec } from '../../core/spec-io.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';

const selectMock = vi.hoisted(() => vi.fn());

vi.mock('@inquirer/prompts', () => ({
  select: selectMock,
}));

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-view-');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  selectMock.mockReset();
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

async function makeProgram(): Promise<Command> {
  const { registerViewCommands } = await import('../view.js');
  const program = new Command();
  program.exitOverride();
  registerViewCommands(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function createViewFixture(): { l3: string; taskId: string } {
  const l1 = 'auth-L1';
  const l2 = 'auth-L2.1';
  const l3 = 'auth-L3.1.1-login';
  createSpec({ paths: project.paths, code: l1, level: 'L1', title: 'Auth PRD', topic: 'auth', parentCode: null });
  updateSpec(project.paths, l1, {
    status: 'confirmed',
    content: '# Auth PRD\n\n## 目标\n\nAuth work\n',
    aiSummary: 'auth summary',
  });
  createSpec({ paths: project.paths, code: l2, level: 'L2', title: 'Auth Design', topic: 'auth', parentCode: l1 });
  updateSpec(project.paths, l2, {
    status: 'confirmed',
    content: '# Auth Design\n\n## 方案概述\n\nAuth design\n',
    aiSummary: 'design summary',
  });
  createSpec({ paths: project.paths, code: l3, level: 'L3', title: 'Login Impl', topic: 'auth', parentCode: l2 });
  updateSpec(project.paths, l3, {
    status: 'confirmed',
    content: '# Login Impl\n\n## 目标\n\nLogin implementation\n',
    aiSummary: 'login summary',
  });
  updateSpec(project.paths, l3, { status: 'frozen' });
  const planJson = {
    coveredSpecs: [l3],
    steps: [
      { stepNo: 1, stepType: 'tool_action' as const, name: 'inspect source files' },
      { stepNo: 2, stepType: 'tool_action' as const, name: 'run verify test' },
    ],
  };
  const { task } = createTask({ paths: project.paths, specCode: l3, autoConfirm: false, planJson });
  startTask(project.paths, task.id, l3);
  reportStep({
    paths: project.paths,
    specCode: l3,
    taskId: task.id,
    stepNo: 1,
    status: 'succeeded',
    outputJson: '{"summary":"ok"}',
  });
  return { l3, taskId: task.id };
}

describe('view CLI', () => {
  it('prints topic summary after prompt selection', async () => {
    createViewFixture();
    selectMock.mockResolvedValueOnce('summary');

    await (await makeProgram()).parseAsync(['view', '--topic', 'auth'], { from: 'user' });

    expect(output()).toContain('Topic: auth');
    expect(output()).toContain('specs: 3');
    expect(output()).toContain('Next:');
    expect(output()).toContain('spec-manager task step');
  });

  it('prints spec details and next command', async () => {
    const { l3 } = createViewFixture();
    selectMock.mockResolvedValueOnce('specs').mockResolvedValueOnce(l3);

    await (await makeProgram()).parseAsync(['view', '--topic', 'auth'], { from: 'user' });

    expect(output()).toContain(`Spec: ${l3}`);
    expect(output()).toContain('status: frozen');
    expect(output()).toContain('aiSummary: login summary');
    expect(output()).toContain('Next:');
  });

  it('prints task details and shown step counts', async () => {
    const { l3, taskId } = createViewFixture();
    selectMock.mockResolvedValueOnce('tasks').mockResolvedValueOnce(`${l3}\t${taskId}`);

    await (await makeProgram()).parseAsync(['view', '--topic', 'auth'], { from: 'user' });

    expect(output()).toContain(`Task: ${taskId}`);
    expect(output()).toContain(`specCode: ${l3}`);
    expect(output()).toContain('status: running');
    expect(output()).toContain('shownSteps: 2');
    expect(output()).toContain('totalSteps: 2');
  });

  it('throws for a missing topic', async () => {
    await expect((await makeProgram()).parseAsync(['view', '--topic', 'missing'], { from: 'user' }))
      .rejects.toThrow('TOPIC_NOT_FOUND: missing');
  });

  it('registers view in command help', async () => {
    const program = await makeProgram();

    expect(program.helpInformation()).toContain('view');
  });
});
