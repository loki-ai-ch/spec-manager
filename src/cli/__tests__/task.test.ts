import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerTaskCommands } from '../task.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';
import { addTaskVerification, createTask, findTask, reportStep, startTask } from '../../core/task.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let writeSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-task-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
  warnSpy.mockRestore();
  writeSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerTaskCommands(program);
  return program;
}

function output(): string {
  return [
    ...logSpy.mock.calls.map((call) => String(call[0])),
    ...writeSpy.mock.calls.map((call) => String(call[0])),
  ].join('\n');
}

function stderr(): string {
  return errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function warnings(): string {
  return warnSpy.mock.calls.map((call) => String(call[0])).join('\n');
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

- Export context for login.

## 验收标准

1. **AC-1**: Given frozen L3, When context is exported, Then output SHALL contain a status gate.

## 验证命令

\`\`\`bash
npm test -- --run src/cli/__tests__/task.test.ts
\`\`\`
`,
    aiSummary: 'Login context summary',
    changeSummary: 'test fixture content',
  });
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
  startTask(project.paths, 'T-001', 'auth-L3.1.1-login');
  return 'auth-L3.1.1-login';
}

function createDraftL3(): string {
  createSpec({ paths: project.paths, code: 'draft-L1', level: 'L1', title: 'Draft', topic: 'draft', parentCode: null });
  updateSpec(project.paths, 'draft-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'draft-L2.1', level: 'L2', title: 'Draft design', topic: 'draft', parentCode: 'draft-L1' });
  updateSpec(project.paths, 'draft-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'draft-L3.1.1-work', level: 'L3', title: 'Draft work', topic: 'draft', parentCode: 'draft-L2.1' });
  return 'draft-L3.1.1-work';
}

describe('task CLI', () => {
  it('rejects deprecated force and points to scoped bypasses', async () => {
    const specCode = createFrozenL3WithTask();

    await expect(
      makeProgram().parseAsync(['task', 'complete', 'T-001', '--spec', specCode, '--force'], { from: 'user' }),
    ).rejects.toThrow(/DEPRECATED_FORCE.*--skip-r18/);
  });

  it('requires a reason for scoped completion bypasses', async () => {
    const specCode = createFrozenL3WithTask();

    await expect(
      makeProgram().parseAsync(['task', 'complete', 'T-001', '--spec', specCode, '--skip-r18'], { from: 'user' }),
    ).rejects.toThrow(/BYPASS_REASON_REQUIRED/);
  });

  it('prints shownSteps and totalSteps for truncated task show', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync(['task', 'show', 'T-001', '--spec', specCode], { from: 'user' });

    expect(output()).toContain('shownSteps: 5');
    expect(output()).toContain('totalSteps: 8');
    expect(output()).toContain('truncated: true');
  });

  it('prints task context as text', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync(['task', 'context', specCode], { from: 'user' });

    expect(output()).toContain('Task Context');
    expect(output()).toContain('Status Gate');
  });

  it('prints task context as json', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync(['task', 'context', specCode, '--format', 'json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.schemaVersion).toBe('harness-context.experimental.v1');
    expect(parsed.specCode).toBe(specCode);
    expect(parsed.statusGate.allowed).toBe(true);
  });

  it('rejects draft L3 task context', async () => {
    const specCode = createDraftL3();

    await expect(makeProgram().parseAsync(['task', 'context', specCode], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('L3_NOT_FROZEN');
  });

  it('rejects invalid task context format', async () => {
    const specCode = createFrozenL3WithTask();

    await expect(makeProgram().parseAsync(['task', 'context', specCode, '--format', 'xml'], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('task context --format 必须是 text 或 json');
  });

  it('reports task step from flags', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync([
      'task', 'report', 'T-001',
      '--spec', specCode,
      '--summary', 'Implemented report command',
      '--files', 'src/core/harness.ts,src/cli/task.ts',
      '--tests', 'npm test',
    ], { from: 'user' });

    const task = findTask(project.paths, specCode, 'T-001');
    expect(output()).toContain('Task T-001 report written');
    expect(output()).toContain('step: 1');
    expect(task?.steps?.[0].status).toBe('succeeded');
    const payload = JSON.parse(task?.steps?.[0].outputJson ?? '{}');
    expect(payload.files).toEqual(['src/core/harness.ts', 'src/cli/task.ts']);
    expect(payload.tests).toEqual(['npm test']);
  });

  it('prints task report warnings through console.warn without stderr', async () => {
    const specCode = createFrozenL3WithTask();
    reportStep({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      stepNo: 1,
      status: 'failed',
      outputJson: '{"summary":"previous failure"}',
    });

    await makeProgram().parseAsync([
      'task', 'report', 'T-001',
      '--spec', specCode,
      '--step', '2',
      '--summary', 'Recovered report',
    ], { from: 'user' });

    expect(warnings()).toContain('上次 step 失败摘要');
    expect(stderr()).toBe('');
  });

  it('keeps task report json parseable and suppresses warnings', async () => {
    const specCode = createFrozenL3WithTask();
    reportStep({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      stepNo: 1,
      status: 'failed',
      outputJson: '{"summary":"previous failure"}',
    });

    await makeProgram().parseAsync([
      'task', 'report', 'T-001',
      '--spec', specCode,
      '--step', '2',
      '--summary', 'Recovered report',
      '--json',
    ], { from: 'user' });

    expect(JSON.parse(output()).stepNo).toBe('2');
    expect(warnings()).toBe('');
    expect(stderr()).toBe('');
  });

  it('reports task step from input json', async () => {
    const specCode = createFrozenL3WithTask();
    const reportFile = join(project.root, 'report.json');
    writeFileSync(reportFile, JSON.stringify({
      summary: 'Input report',
      stepNo: 2,
      files: ['src/core/harness.ts'],
      tests: ['npm test'],
      risks: ['none'],
    }), 'utf8');

    await makeProgram().parseAsync(['task', 'report', 'T-001', '--spec', specCode, '--input', reportFile, '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.stepNo).toBe(2);
    expect(parsed.task.steps[1].status).toBe('succeeded');
  });

  it('rejects task report without summary', async () => {
    const specCode = createFrozenL3WithTask();

    await expect(makeProgram().parseAsync(['task', 'report', 'T-001', '--spec', specCode], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('INVALID_REPORT');
  });

  it('rejects task report input mixed with flags', async () => {
    const specCode = createFrozenL3WithTask();
    const reportFile = join(project.root, 'report.json');
    writeFileSync(reportFile, JSON.stringify({ summary: 'Input report' }), 'utf8');

    await expect(makeProgram().parseAsync(['task', 'report', 'T-001', '--spec', specCode, '--input', reportFile, '--summary', 'flag report'], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(stderr()).toBe('✗ task report --input 不能与 --summary/--files/--tests/--risks/--step 混用');
  });

  it('reports specified task step from flags', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync(['task', 'report', 'T-001', '--spec', specCode, '--step', '2', '--summary', 'Step 2 report'], { from: 'user' });

    const task = findTask(project.paths, specCode, 'T-001');
    expect(task?.steps?.[0].status).toBe('pending');
    expect(task?.steps?.[1].status).toBe('succeeded');
  });

  it('records verification from flags', async () => {
    const specCode = createFrozenL3WithTask();

    await makeProgram().parseAsync([
      'task', 'verify', 'T-001',
      '--spec', specCode,
      '--command', 'npm test',
      '--exit-code', '0',
      '--summary', 'passed',
      '--covers-ac', 'AC-1',
    ], { from: 'user' });

    const task = findTask(project.paths, specCode, 'T-001');
    expect(output()).toContain('verification V-001 recorded');
    expect(output()).toContain('exitCode: 0');
    expect(task?.verifications?.[0].coversAc).toEqual(['AC-1']);
  });

  it('records verification from input json', async () => {
    const specCode = createFrozenL3WithTask();
    const verificationFile = join(project.root, 'verification.json');
    writeFileSync(verificationFile, JSON.stringify({
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: ['coverage/index.html'],
      coversAc: ['AC-1'],
    }), 'utf8');

    await makeProgram().parseAsync(['task', 'verify', 'T-001', '--spec', specCode, '--input', verificationFile, '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.verification.id).toBe('V-001');
    expect(parsed.verification.artifacts).toEqual(['coverage/index.html']);
  });

  it('rejects invalid verification payload', async () => {
    const specCode = createFrozenL3WithTask();

    await expect(makeProgram().parseAsync(['task', 'verify', 'T-001', '--spec', specCode, '--exit-code', '0', '--summary', 'missing command'], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('INVALID_VERIFICATION');
  });

  it('rejects invalid verification layer with legacy stderr text', async () => {
    const specCode = createFrozenL3WithTask();

    await expect(makeProgram().parseAsync([
      'task', 'verify', 'T-001',
      '--spec', specCode,
      '--command', 'npm test',
      '--exit-code', '0',
      '--summary', 'passed',
      '--layer', 'invalid',
    ], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(stderr()).toBe('✗ --layer 非法: invalid（必须 compile|functional|smoke）');
  });

  it('rejects verification input mixed with flags', async () => {
    const specCode = createFrozenL3WithTask();
    const verificationFile = join(project.root, 'verification.json');
    writeFileSync(verificationFile, JSON.stringify({ command: 'npm test', exitCode: 0, summary: 'passed' }), 'utf8');

    await expect(makeProgram().parseAsync(['task', 'verify', 'T-001', '--spec', specCode, '--input', verificationFile, '--summary', 'flag summary'], { from: 'user' })).rejects.toThrow('process.exit:2');

    expect(stderr()).toBe('✗ task verify --input 不能与 --command/--exit-code/--summary/--artifacts/--covers-ac 混用');
  });

  it('shows verification summary in task show', async () => {
    const specCode = createFrozenL3WithTask();
    await makeProgram().parseAsync(['task', 'verify', 'T-001', '--spec', specCode, '--command', 'npm test', '--exit-code', '0', '--summary', 'passed'], { from: 'user' });
    logSpy.mockClear();
    writeSpy.mockClear();

    await makeProgram().parseAsync(['task', 'show', 'T-001', '--spec', specCode], { from: 'user' });

    expect(output()).toContain('verifications: 1');
    expect(output()).toContain('[functional]');
    expect(output()).toContain('V-001:');
  });

  it('keeps task complete json limited to the legacy result fields', async () => {
    const specCode = createFrozenL3WithTask();
    for (let stepNo = 1; stepNo <= 8; stepNo += 1) {
      reportStep({
        paths: project.paths,
        taskId: 'T-001',
        specCode,
        stepNo,
        status: 'succeeded',
        outputJson: '{"summary":"done"}',
      });
    }
    addTaskVerification({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
    });

    await makeProgram().parseAsync([
      'task', 'complete', 'T-001',
      '--spec', specCode,
      '--skip-r18',
      '--skip-verification',
      '--reason', 'test fixture',
      '--json',
    ], { from: 'user' });

    const result = JSON.parse(output());
    expect(Object.keys(result).sort()).toEqual([
      'cascadedL1Specs',
      'cascadedSpecs',
      'skippedSpecs',
      'task',
    ]);
    expect(result.gateResults).toBeUndefined();
  });

  it('prints successful verification gate summaries', async () => {
    const specCode = createFrozenL3WithTask();
    const spec = findSpecByCode(project.paths, specCode)!;
    updateSpec(project.paths, specCode, {
      content: spec.content.replace('npm test -- --run src/cli/__tests__/task.test.ts', 'echo ok'),
      aiSummary: spec.fm.aiSummary,
    });
    for (let stepNo = 1; stepNo <= 8; stepNo += 1) {
      reportStep({
        paths: project.paths,
        taskId: 'T-001',
        specCode,
        stepNo,
        status: 'succeeded',
        outputJson: '{"summary":"done"}',
      });
    }
    addTaskVerification({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
    });

    await makeProgram().parseAsync([
      'task', 'complete', 'T-001',
      '--spec', specCode,
      '--skip-r18',
      '--reason', 'test fixture',
    ], { from: 'user' });

    expect(output()).toContain('✓ 验证命令通过 (1/1)');
    expect(output()).toContain('✓ @verify 规则通过 (0/0)');
  });
});
