import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerTaskCommands } from '../task.js';
import { registerSpec } from '../spec.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';
import { addTaskVerification, createTask, findTask, reportStep, startTask } from '../../core/task.js';
import { writeAdaptiveWorkflowConfig } from '../../core/workflow-profile.js';

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

function makeProgramWithSpec(): Command {
  const program = makeProgram();
  registerSpec(program);
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
        stepType: 'tool_action' as const,
        name: i === 7 ? 'run verify test' : `inspect file ${i + 1}`,
      })),
    },
  });
  startTask(project.paths, 'T-001', 'auth-L3.1.1-login');
  return 'auth-L3.1.1-login';
}

function createFrozenL3WithoutTask(opts?: { critical?: boolean }): string {
  createSpec({ paths: project.paths, code: 'profile-L1', level: 'L1', title: 'Profile', topic: 'profile', parentCode: null });
  updateSpec(project.paths, 'profile-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'profile-L2.1', level: 'L2', title: 'Profile design', topic: 'profile', parentCode: 'profile-L1' });
  updateSpec(project.paths, 'profile-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'profile-L3.1.1-work', level: 'L3', title: 'Profile work', topic: 'profile', parentCode: 'profile-L2.1' });
  updateSpec(project.paths, 'profile-L3.1.1-work', {
    content: `# Profile work

## 目标
\`src/core/task.ts\`

## 实施步骤
steps

## 验收标准
1. **AC-1**: Given task creation, When profile is resolved, Then task SHALL store profile.

${opts?.critical === false ? '' : `## 关键验收标准
- AC-1
`}
## 验证命令
\`\`\`bash
npm test
\`\`\`
`,
    aiSummary: 'Profile work summary',
  });
  updateSpec(project.paths, 'profile-L3.1.1-work', { status: 'frozen' });
  return 'profile-L3.1.1-work';
}

function writePlanFile(specCode: string): string {
  const planFile = join(project.root, 'plan.json');
  writeFileSync(planFile, JSON.stringify({
    coveredSpecs: [specCode],
    steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }],
  }), 'utf8');
  return planFile;
}

function createDraftL3(): string {
  createSpec({ paths: project.paths, code: 'draft-L1', level: 'L1', title: 'Draft', topic: 'draft', parentCode: null });
  updateSpec(project.paths, 'draft-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'draft-L2.1', level: 'L2', title: 'Draft design', topic: 'draft', parentCode: 'draft-L1' });
  updateSpec(project.paths, 'draft-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'draft-L3.1.1-work', level: 'L3', title: 'Draft work', topic: 'draft', parentCode: 'draft-L2.1' });
  return 'draft-L3.1.1-work';
}

function createRunnableDraftL3(): string {
  const specCode = createDraftL3();
  updateSpec(project.paths, specCode, {
    content: `# Draft work

## 目标
\`src/cli/task.ts\`

## 实施步骤
run task

## 验证命令
\`\`\`bash
npm test
\`\`\`
`,
    aiSummary: 'Runnable draft work',
  });
  return specCode;
}

describe('task CLI', () => {
  it('runs draft L3 by freezing, creating, and starting a task', async () => {
    const specCode = createRunnableDraftL3();

    await makeProgram().parseAsync(['task', 'run', specCode, '--plan', writePlanFile(specCode)], { from: 'user' });

    expect(findSpecByCode(project.paths, specCode)?.fm.status).toBe('frozen');
    expect(findTask(project.paths, specCode, 'T-001')?.status).toBe('running');
    expect(output()).toContain(`${specCode}: draft → frozen`);
    expect(output()).toContain(`Task T-001 created and started for ${specCode}`);
    expect(output()).toContain(`spec-manager task step T-001 --spec ${specCode}`);
  });

  it('runs frozen L3 without repeating spec transition', async () => {
    const specCode = createFrozenL3WithoutTask();

    await makeProgram().parseAsync(['task', 'run', specCode, '--plan', writePlanFile(specCode)], { from: 'user' });

    expect(findSpecByCode(project.paths, specCode)?.fm.status).toBe('frozen');
    expect(findTask(project.paths, specCode, 'T-001')?.status).toBe('running');
    expect(output()).toContain(`${specCode}: already frozen`);
  });

  it('prints task run json as a single object', async () => {
    const specCode = createRunnableDraftL3();

    await makeProgram().parseAsync(['task', 'run', specCode, '--plan', writePlanFile(specCode), '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed).toMatchObject({
      spec: {
        code: specCode,
        oldStatus: 'draft',
        newStatus: 'frozen',
        transitioned: true,
      },
      task: {
        id: 'T-001',
        status: 'running',
      },
      nextCommand: `spec-manager task step T-001 --spec ${specCode} --no 1 --status succeeded --output-json '{"summary":"..."}'`,
    });
  });

  it('keeps spec confirm from creating a task', async () => {
    const specCode = createRunnableDraftL3();

    await makeProgramWithSpec().parseAsync(['spec', 'confirm', specCode], { from: 'user' });

    expect(findSpecByCode(project.paths, specCode)?.fm.status).toBe('frozen');
    expect(findTask(project.paths, specCode, 'T-001')).toBeNull();
  });

  it('rejects task run when planJson does not cover the L3 spec', async () => {
    const specCode = createRunnableDraftL3();
    const planFile = join(project.root, 'wrong-plan.json');
    writeFileSync(planFile, JSON.stringify({
      coveredSpecs: ['other-L3.1.1'],
      steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }],
    }), 'utf8');

    await expect(makeProgram().parseAsync(['task', 'run', specCode, '--plan', planFile], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('R12');
    expect(findTask(project.paths, specCode, 'T-001')).toBeNull();
  });

  it('rejects task run when an active task already exists', async () => {
    const specCode = createFrozenL3WithoutTask();
    createTask({ paths: project.paths, specCode, planJson: { coveredSpecs: [specCode], steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }] }, autoConfirm: false });

    await expect(makeProgram().parseAsync(['task', 'run', specCode, '--plan', writePlanFile(specCode)], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('TASK_ALREADY_ACTIVE');
  });

  it('creates legacy task from CLI when adaptive workflow is disabled', async () => {
    const specCode = createFrozenL3WithoutTask();

    await makeProgram().parseAsync(['task', 'create', specCode, '--plan', writePlanFile(specCode)], { from: 'user' });

    expect(output()).toContain('profile: legacy (legacy)');
    expect(findTask(project.paths, specCode, 'T-001')?.profile).toBe('legacy');
  });

  it('creates and starts a task when task create receives --start', async () => {
    const specCode = createFrozenL3WithoutTask();

    await makeProgram().parseAsync([
      'task', 'create', specCode, '--plan', writePlanFile(specCode), '--start',
    ], { from: 'user' });

    const task = findTask(project.paths, specCode, 'T-001');
    expect(task?.status).toBe('running');
    expect(task?.startedAt).toBeTruthy();
    expect(output()).toContain(`Task T-001 created and started for ${specCode}`);
    expect(output()).toContain('status: running');
    expect(output()).toContain(`startedAt: ${task?.startedAt}`);
    expect(output()).toContain(`spec-manager task step T-001 --spec ${specCode}`);
  });

  it('prints running task create --start json with the next command', async () => {
    const specCode = createFrozenL3WithoutTask();

    await makeProgram().parseAsync([
      'task', 'create', specCode, '--plan', writePlanFile(specCode), '--start', '--json',
    ], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed).toMatchObject({
      task: {
        id: 'T-001',
        status: 'running',
      },
      nextCommand: `spec-manager task step T-001 --spec ${specCode} --no 1 --status succeeded --output-json '{"summary":"..."}'`,
    });
    expect(parsed.task.startedAt).toBeTruthy();
    expect(parsed.taskFile).toContain(`${specCode}-T-001.json`);
  });

  it('keeps default task create json in draft without a next command', async () => {
    const specCode = createFrozenL3WithoutTask();

    await makeProgram().parseAsync([
      'task', 'create', specCode, '--plan', writePlanFile(specCode), '--json',
    ], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.task).toMatchObject({ id: 'T-001', status: 'draft', startedAt: null });
    expect(parsed.taskFile).toContain(`${specCode}-T-001.json`);
    expect(parsed).not.toHaveProperty('nextCommand');
    expect(findTask(project.paths, specCode, 'T-001')?.status).toBe('draft');
  });

  it('creates governed task from CLI when enabled and critical AC exists', async () => {
    const specCode = createFrozenL3WithoutTask();
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });

    await makeProgram().parseAsync([
      'task', 'create', specCode,
      '--plan', writePlanFile(specCode),
      '--profile', 'governed',
      '--profile-reason', 'high risk',
    ], { from: 'user' });

    expect(output()).toContain('profile: governed (explicit)');
    expect(findTask(project.paths, specCode, 'T-001')?.profileOverrideReason).toBe('high risk');
  });

  it('rejects governed task from CLI when critical AC is missing', async () => {
    const specCode = createFrozenL3WithoutTask({ critical: false });
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'governed' });

    await expect(makeProgram().parseAsync(['task', 'create', specCode, '--plan', writePlanFile(specCode)], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('GOVERNED_CRITICAL_AC_REQUIRED');
  });

  it('prints actionable diagnostics for legacy planJson fields', async () => {
    const specCode = createFrozenL3WithoutTask();
    const planFile = join(project.root, 'legacy-plan.json');
    writeFileSync(planFile, JSON.stringify({
      coveredSpecs: [specCode],
      steps: [{ no: 1, type: 'tool_action', desc: 'run verify test' }],
    }), 'utf8');

    await expect(makeProgram().parseAsync(['task', 'create', specCode, '--plan', planFile], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('PLAN_JSON_INVALID');
    expect(stderr()).toContain('steps[0].stepNo');
    expect(stderr()).toContain('legacy field "no"');
    expect(stderr()).toContain('Rename "type" to "stepType"');
    expect(stderr()).toContain('Rename "desc" to "name"');
    expect(findTask(project.paths, specCode, 'T-001')).toBeNull();
  });

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
    expect(output()).not.toContain('spec-manager assist delivery');
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

  it('reports multiple task steps from batch input', async () => {
    const specCode = createFrozenL3WithTask();
    const batchFile = join(project.root, 'steps.json');
    writeFileSync(batchFile, JSON.stringify({
      steps: [
        { stepNo: 1, status: 'succeeded', outputJson: '{"summary":"step one"}' },
        { stepNo: 2, status: 'succeeded', outputJson: '{"summary":"step two"}' },
      ],
    }), 'utf8');

    await makeProgram().parseAsync(['task', 'step-batch', 'T-001', '--spec', specCode, '--input', batchFile], { from: 'user' });

    const task = findTask(project.paths, specCode, 'T-001');
    expect(output()).toContain('2 step(s) reported');
    expect(output()).toContain('Step 1: succeeded');
    expect(output()).toContain('Step 2: succeeded');
    expect(task?.steps?.[0].status).toBe('succeeded');
    expect(task?.steps?.[1].status).toBe('succeeded');
    expect(task?.steps?.[0].outputJson).toContain('step one');
    expect(task?.steps?.[1].outputJson).toContain('step two');
  });

  it('preserves R15 warnings during batch step reporting', async () => {
    const specCode = createFrozenL3WithTask();
    const batchFile = join(project.root, 'steps-r15.json');
    writeFileSync(batchFile, JSON.stringify({
      steps: [{ stepNo: 1, status: 'succeeded' }],
    }), 'utf8');

    await makeProgram().parseAsync(['task', 'step-batch', 'T-001', '--spec', specCode, '--input', batchFile], { from: 'user' });

    expect(warnings()).toContain('step 1');
    expect(warnings()).toContain('R15');
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

  it('prints task evidence as text', async () => {
    const specCode = createFrozenL3WithoutTask();
    const { task } = createTask({
      paths: project.paths,
      specCode,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [specCode],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }],
      },
    });
    startTask(project.paths, task.id, specCode);
    addTaskVerification({
      paths: project.paths,
      taskId: task.id,
      specCode,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: ['coverage/index.html'],
      coversAc: ['AC-1'],
    });

    await makeProgram().parseAsync(['task', 'evidence', task.id, '--spec', specCode], { from: 'user' });

    expect(output()).toContain(`Task Evidence: ${specCode} / ${task.id}`);
    expect(output()).toContain('Profile: legacy (legacy)');
    expect(output()).toContain('Coverage: 1/1 critical AC covered');
    expect(output()).toContain('✓ AC-1 covered by V-001');
    expect(output()).toContain('- coverage/index.html');
  });

  it('prints task evidence as json', async () => {
    const specCode = createFrozenL3WithoutTask();
    const { task } = createTask({
      paths: project.paths,
      specCode,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [specCode],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }],
      },
    });

    await makeProgram().parseAsync(['task', 'evidence', task.id, '--spec', specCode, '--format', 'json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.schemaVersion).toBe('task-evidence.experimental.v1');
    expect(parsed.specCode).toBe(specCode);
    expect(parsed.summary).toEqual({ required: 1, covered: 0, failed: 0, uncovered: 1 });
  });

  it('rejects invalid task evidence format', async () => {
    const specCode = createFrozenL3WithoutTask();
    const { task } = createTask({
      paths: project.paths,
      specCode,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [specCode],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }],
      },
    });

    await expect(makeProgram().parseAsync(['task', 'evidence', task.id, '--spec', specCode, '--format', 'xml'], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('task evidence --format 必须是 text 或 json');
  });

  it('maps task evidence projection errors to exit code 2', async () => {
    await expect(makeProgram().parseAsync(['task', 'evidence', 'T-404'], { from: 'user' }))
      .rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('TASK_NOT_FOUND: T-404');
  });

  it('rejects task evidence when critical AC references become invalid', async () => {
    const specCode = createFrozenL3WithoutTask();
    const { task } = createTask({
      paths: project.paths,
      specCode,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [specCode],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run verify test' }],
      },
    });
    const spec = findSpecByCode(project.paths, specCode)!;
    updateSpec(project.paths, specCode, {
      content: spec.content.replace('- AC-1', '- AC-9'),
      aiSummary: spec.fm.aiSummary,
    });

    await expect(makeProgram().parseAsync(['task', 'evidence', task.id, '--spec', specCode], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('UNKNOWN_CRITICAL_AC: AC-9');
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

  it('prints task complete json with delivery next command and legacy fields', async () => {
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
    expect(result.task.id).toBe('T-001');
    expect(result.cascadedSpecs).toEqual(expect.any(Array));
    expect(result.cascadedL1Specs).toEqual(expect.any(Array));
    expect(result.skippedSpecs).toEqual(expect.any(Array));
    expect(result.gateResults).toBeUndefined();
    expect(result.nextCommand).toBe(`spec-manager assist delivery T-001 --spec ${specCode}`);
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
    expect(output()).toContain('Next:');
    expect(output()).toContain(`spec-manager assist delivery T-001 --spec ${specCode}`);
  });
});
