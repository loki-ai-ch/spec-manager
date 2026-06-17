import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerCapabilityCommands } from '../capability.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';
import { addTaskVerification, createTask, findTask, startTask, type TaskRecord } from '../../core/task.js';
import { siblingMetaDir } from '../../core/paths.js';
import { TASK_FILE_EXT } from '../../core/constants.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-capability-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit:${code}`);
  });
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) delete process.env.SPEC_MANAGER_ROOT;
  else process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerCapabilityCommands(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function createAuthTaskForGuide(): { specCode: string; taskId: string } {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1', {
    status: 'frozen',
    content: '# Auth impl\n\n## 目标\nx\n\n## 实施步骤\n1. y\n\n## 验证命令\nnpm test\n',
    aiSummary: 'auth impl',
  });
  const { task } = createTask({
    paths: project.paths,
    specCode: 'auth-L3.1.1',
    autoConfirm: false,
    planJson: {
      coveredSpecs: ['auth-L3.1.1'],
      steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 guide delivery' }],
    },
  });
  startTask(project.paths, task.id, 'auth-L3.1.1');
  markTaskCompleted('auth-L3.1.1', task.id);
  return { specCode: 'auth-L3.1.1', taskId: task.id };
}

function markTaskCompleted(specCode: string, taskId: string): void {
  const task = findTask(project.paths, specCode, taskId);
  if (!task) throw new Error(`missing task ${taskId}`);
  writeFileSync(taskFilePath(specCode, taskId), JSON.stringify({ ...task, status: 'completed', finishedAt: new Date().toISOString() } satisfies TaskRecord, null, 2));
}

function taskFilePath(specCode: string, taskId: string): string {
  const spec = findSpecByCode(project.paths, specCode);
  if (!spec) throw new Error(`missing spec ${specCode}`);
  return join(siblingMetaDir(spec.filePath, 'tasks'), `${specCode}-${taskId}${TASK_FILE_EXT}`);
}

describe('assist CLI', () => {
  it('prints guided assist JSON contract', async () => {
    await makeProgram().parseAsync(['assist', 'guide', '--request', 'auth login', '--topic', 'auth', '--json'], { from: 'user' });

    const json = JSON.parse(output());
    expect(json.schemaVersion).toBe('guided-assist.v1');
    expect(json.stage).toBe('brief');
    expect(json.nextCommand).toBe('spec-manager assist brief --request "auth login" --topic auth');
  });

  it('prints guided assist text output', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { content: '# Auth\n\n## 背景\nNeed auth.\n', aiSummary: 'auth' });

    await makeProgram().parseAsync(['assist', 'guide', '--request', '确认这个 spec', '--spec', 'auth-L1'], { from: 'user' });

    expect(output()).toContain('Guided Assist');
    expect(output()).toContain('Stage: critique');
    expect(output()).toContain('Next: spec-manager assist critique auth-L1');
  });

  it('prints guided assist delivery JSON route', async () => {
    const { specCode, taskId } = createAuthTaskForGuide();

    await makeProgram().parseAsync(['assist', 'guide', '--request', '准备最终交付总结', '--spec', specCode, '--task', taskId, '--json'], { from: 'user' });

    const json = JSON.parse(output());
    expect(json.schemaVersion).toBe('guided-assist.v1');
    expect(json.stage).toBe('delivery');
    expect(json.nextCommand).toBe(`spec-manager assist delivery ${taskId} --spec ${specCode}`);
  });

  it('prints guided assist delivery text route', async () => {
    const { specCode, taskId } = createAuthTaskForGuide();

    await makeProgram().parseAsync(['assist', 'guide', '--request', '准备最终交付总结', '--spec', specCode, '--task', taskId], { from: 'user' });

    expect(output()).toContain('Guided Assist');
    expect(output()).toContain('Stage: delivery');
    expect(output()).toContain(`Next: spec-manager assist delivery ${taskId} --spec ${specCode}`);
  });

  it('prints brief JSON contract', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });

    await makeProgram().parseAsync(['assist', 'brief', '--request', 'auth login', '--topic', 'auth', '--json'], { from: 'user' });

    const json = JSON.parse(output());
    expect(json.schemaVersion).toBe('agent-brief.v1');
    expect(json.topic).toBe('auth');
    expect(json.nextCommand).toBe('spec-manager flow status --topic auth');
  });

  it('prints lessons text with advisory when empty', async () => {
    await makeProgram().parseAsync(['assist', 'lessons', '--topic', 'auth'], { from: 'user' });

    expect(output()).toContain('Lessons');
    expect(output()).toContain('No related lessons found');
  });

  it('prints critique JSON contract', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { content: '# Auth\n\n## 背景\nNeed auth.\n', aiSummary: 'auth' });

    await makeProgram().parseAsync(['assist', 'critique', 'auth-L1', '--json'], { from: 'user' });

    const json = JSON.parse(output());
    expect(json.schemaVersion).toBe('spec-critique.v1');
    expect(json.specCode).toBe('auth-L1');
    expect(json.summary.blocking).toBeGreaterThan(0);
  });

  it('prints critique text output', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });

    await makeProgram().parseAsync(['assist', 'critique', 'auth-L1'], { from: 'user' });

    expect(output()).toContain('Spec Critique');
    expect(output()).toContain('Spec: auth-L1');
  });

  it('prints task next JSON contract', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
    updateSpec(project.paths, 'auth-L3.1.1', { status: 'frozen', content: '# Auth impl\n\n## 目标\nx\n## 实施步骤\n1. y\n## 验证命令\nnpm test\n', aiSummary: 'auth impl' });
    const { task } = createTask({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['auth-L3.1.1'],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 task next' }],
      },
    });

    await makeProgram().parseAsync(['assist', 'next', task.id, '--spec', 'auth-L3.1.1', '--json'], { from: 'user' });

    const json = JSON.parse(output());
    expect(json.schemaVersion).toBe('task-next.v1');
    expect(json.taskId).toBe(task.id);
    expect(json.specCode).toBe('auth-L3.1.1');
  });

  it('prints drift text output', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
    updateSpec(project.paths, 'auth-L3.1.1', { status: 'frozen', content: '# Auth impl\n\n## 目标\nx\n## 实施步骤\n- edit src/core/auth.ts\n## 验证命令\nnpm test\n## 文件级改动\n- src/core/auth.ts\n', aiSummary: 'auth impl' });
    const { task } = createTask({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['auth-L3.1.1'],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 drift check' }],
      },
    });

    await makeProgram().parseAsync(['assist', 'drift', task.id, '--spec', 'auth-L3.1.1'], { from: 'user' });

    expect(output()).toContain('Drift Check');
    expect(output()).toContain('Changed Files:');
  });

  it('prints acceptance JSON contract', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
    updateSpec(project.paths, 'auth-L3.1.1', {
      status: 'frozen',
      content: '# Auth impl\n\n## 目标\nx\n\n## 实施步骤\n1. y\n\n## 验收标准\n1. **AC-1**: auth works\n\n## 关键验收标准\n- AC-1\n\n## 验证命令\nnpm test\n',
      aiSummary: 'auth impl',
    });
    const { task } = createTask({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['auth-L3.1.1'],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 acceptance report' }],
      },
    });
    startTask(project.paths, task.id, 'auth-L3.1.1');
    addTaskVerification({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      taskId: task.id,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: ['coverage/index.html'],
      coversAc: ['AC-1'],
    });

    await makeProgram().parseAsync(['assist', 'acceptance', task.id, '--spec', 'auth-L3.1.1', '--json'], { from: 'user' });

    const json = JSON.parse(output());
    expect(json.schemaVersion).toBe('acceptance-report.v1');
    expect(json.taskId).toBe(task.id);
    expect(json.specCode).toBe('auth-L3.1.1');
    expect(json.criteria[0].status).toBe('covered');
    expect(json.artifacts).toEqual(['coverage/index.html']);
  });

  it('prints acceptance text output', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
    updateSpec(project.paths, 'auth-L3.1.1', {
      status: 'frozen',
      content: '# Auth impl\n\n## 目标\nx\n\n## 实施步骤\n1. y\n\n## 验收标准\n1. **AC-1**: auth works\n\n## 关键验收标准\n- AC-1\n\n## 验证命令\nnpm test\n',
      aiSummary: 'auth impl',
    });
    const { task } = createTask({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['auth-L3.1.1'],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 acceptance text' }],
      },
    });

    await makeProgram().parseAsync(['assist', 'acceptance', task.id, '--spec', 'auth-L3.1.1'], { from: 'user' });

    expect(output()).toContain('Acceptance Report');
    expect(output()).toContain('Human Acceptance:');
    expect(output()).toContain('Residual Risk:');
  });

  it('prints delivery summary JSON contract', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
    updateSpec(project.paths, 'auth-L3.1.1', {
      status: 'frozen',
      content: '# Auth impl\n\n## 目标\nx\n\n## 实施步骤\n1. y\n\n## 验收标准\n1. **AC-1**: auth works\n\n## 关键验收标准\n- AC-1\n\n## 验证命令\nnpm test\n',
      aiSummary: 'auth impl',
    });
    const { task } = createTask({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['auth-L3.1.1'],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 delivery summary' }],
      },
    });
    startTask(project.paths, task.id, 'auth-L3.1.1');
    addTaskVerification({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      taskId: task.id,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: ['coverage/index.html'],
      coversAc: ['AC-1'],
    });

    await makeProgram().parseAsync(['assist', 'delivery', task.id, '--spec', 'auth-L3.1.1', '--json'], { from: 'user' });

    const json = JSON.parse(output());
    expect(json.schemaVersion).toBe('delivery-summary.v1');
    expect(json.taskId).toBe(task.id);
    expect(json.specCode).toBe('auth-L3.1.1');
    expect(json.verifications[0].status).toBe('passed');
    expect(json.artifacts).toEqual(['coverage/index.html']);
    expect(json.nextAction).toContain('assist next');
  });

  it('prints delivery summary text output without mutating task state', async () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
    updateSpec(project.paths, 'auth-L3.1.1', {
      status: 'frozen',
      content: '# Auth impl\n\n## 目标\nx\n\n## 实施步骤\n1. y\n\n## 验收标准\n1. **AC-1**: auth works\n\n## 关键验收标准\n- AC-1\n\n## 验证命令\nnpm test\n',
      aiSummary: 'auth impl',
    });
    const { task } = createTask({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      autoConfirm: false,
      planJson: {
        coveredSpecs: ['auth-L3.1.1'],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 delivery text' }],
      },
    });
    startTask(project.paths, task.id, 'auth-L3.1.1');
    addTaskVerification({
      paths: project.paths,
      specCode: 'auth-L3.1.1',
      taskId: task.id,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: ['coverage/index.html'],
      coversAc: ['AC-1'],
    });
    const before = findTask(project.paths, 'auth-L3.1.1', task.id);

    await makeProgram().parseAsync(['assist', 'delivery', task.id, '--spec', 'auth-L3.1.1'], { from: 'user' });

    expect(output()).toContain('Delivery Summary');
    expect(output()).toContain('Summary:');
    expect(output()).toContain('Steps:');
    expect(output()).toContain('Verifications:');
    expect(output()).toContain('Artifacts:');
    expect(output()).toContain('Human Acceptance:');
    expect(output()).toContain('Residual Risk:');
    expect(output()).toContain('Next Action:');
    expect(findTask(project.paths, 'auth-L3.1.1', task.id)).toEqual(before);
  });

  it('rejects empty brief requests', async () => {
    await expect(makeProgram().parseAsync(['assist', 'brief', '--request', '   '], { from: 'user' }))
      .rejects.toThrow('process.exit:2');
    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('AGENT_BRIEF_REQUEST_REQUIRED');
  });

  it('rejects missing critique specs', async () => {
    await expect(makeProgram().parseAsync(['assist', 'critique', 'missing-L1'], { from: 'user' }))
      .rejects.toThrow('process.exit:1');
    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('SPEC_NOT_FOUND');
  });

  it('rejects missing guided assist specs', async () => {
    await expect(makeProgram().parseAsync(['assist', 'guide', '--request', 'review', '--spec', 'missing-L1'], { from: 'user' }))
      .rejects.toThrow('process.exit:1');
    expect(errorSpy.mock.calls.map((call) => String(call[0])).join('\n')).toContain('SPEC_NOT_FOUND');
  });

  it('rejects invalid guided assist input', async () => {
    await expect(makeProgram().parseAsync(['assist', 'guide', '--request', '   '], { from: 'user' }))
      .rejects.toThrow('process.exit:2');
    await expect(makeProgram().parseAsync(['assist', 'guide', '--request', 'continue', '--task', 'T-001'], { from: 'user' }))
      .rejects.toThrow('process.exit:2');
    const stderr = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(stderr).toContain('GUIDED_ASSIST_REQUEST_REQUIRED');
    expect(stderr).toContain('GUIDED_ASSIST_SPEC_REQUIRED');
  });

  it('rejects missing task for next, drift, and acceptance', async () => {
    await expect(makeProgram().parseAsync(['assist', 'next', 'missing', '--spec', 'missing-L3'], { from: 'user' }))
      .rejects.toThrow('process.exit:1');
    await expect(makeProgram().parseAsync(['assist', 'drift', 'missing', '--spec', 'missing-L3'], { from: 'user' }))
      .rejects.toThrow('process.exit:1');
    await expect(makeProgram().parseAsync(['assist', 'acceptance', 'missing', '--spec', 'missing-L3'], { from: 'user' }))
      .rejects.toThrow('process.exit:1');
    await expect(makeProgram().parseAsync(['assist', 'delivery', 'missing', '--spec', 'missing-L3'], { from: 'user' }))
      .rejects.toThrow('process.exit:1');
    await expect(makeProgram().parseAsync(['assist', 'guide', '--request', 'continue', '--task', 'missing', '--spec', 'missing-L3'], { from: 'user' }))
      .rejects.toThrow('process.exit:1');
  });
});
