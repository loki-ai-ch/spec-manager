import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, updateSpec } from '../../core/spec-io.js';
import { createTask, findTask, startTask } from '../../core/task.js';
import type { CliActionContext } from '../common.js';
import {
  printTaskReportResult,
  printTaskVerifyResult,
  runTaskReportCommand,
  runTaskVerifyCommand,
} from '../task-handlers.js';

let project: TestProject;
let context: CliActionContext & { logs: string[]; errors: string[]; exits: number[] };

beforeEach(() => {
  project = createTestProject('spec-mgr-task-handlers-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  context = createContext();
  createFrozenL3WithTask();
});

afterEach(() => {
  project.cleanup();
});

function createContext(): CliActionContext & { logs: string[]; errors: string[]; exits: number[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  const exits: number[] = [];
  return {
    paths: project.paths,
    stdout: { write: () => true },
    log: (message: string) => logs.push(message),
    error: (message: string) => errors.push(message),
    exit: (code: number): never => {
      exits.push(code);
      throw new Error(`exit:${code}`);
    },
    logs,
    errors,
    exits,
  };
}

function createFrozenL3WithTask(): void {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1-login', level: 'L3', title: 'Login', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1-login', {
    status: 'frozen',
    content: '# Login\n\n## 验证命令\n\n```bash\nnpm test\n```\n',
    aiSummary: 'login',
  });
  createTask({
    paths: project.paths,
    specCode: 'auth-L3.1.1-login',
    autoConfirm: false,
    planJson: {
      coveredSpecs: ['auth-L3.1.1-login'],
      steps: [
        { stepNo: 1, stepType: 'mcp_tool', name: 'inspect login' },
        { stepNo: 2, stepType: 'mcp_tool', name: '验证 login' },
      ],
    },
  });
  startTask(project.paths, 'T-001', 'auth-L3.1.1-login');
}

describe('task CLI handlers', () => {
  it('reports a task step from flags', () => {
    const result = runTaskReportCommand({
      context,
      taskId: 'T-001',
      opts: {
        spec: 'auth-L3.1.1-login',
        summary: 'Implemented report command',
        files: 'src/core/harness.ts,src/cli/task.ts',
        tests: 'npm test',
        json: false,
      },
    });

    const task = findTask(project.paths, 'auth-L3.1.1-login', 'T-001');
    const payload = JSON.parse(task?.steps?.[0].outputJson ?? '{}');
    expect(result.stepNo).toBe(1);
    expect(task?.steps?.[0].status).toBe('succeeded');
    expect(payload.files).toEqual(['src/core/harness.ts', 'src/cli/task.ts']);
    expect(payload.tests).toEqual(['npm test']);
  });

  it('reports a task step from input json', () => {
    const reportFile = join(project.root, 'report.json');
    writeFileSync(reportFile, JSON.stringify({
      summary: 'Input report',
      stepNo: 2,
      files: ['src/core/harness.ts'],
      tests: ['npm test'],
      risks: ['none'],
    }), 'utf8');

    const result = runTaskReportCommand({
      context,
      taskId: 'T-001',
      opts: { spec: 'auth-L3.1.1-login', input: reportFile, json: true },
    });

    expect(result.stepNo).toBe(2);
    expect(result.task.steps?.[1].status).toBe('succeeded');
  });

  it('rejects report input mixed with flags', () => {
    const reportFile = join(project.root, 'report.json');
    writeFileSync(reportFile, JSON.stringify({ summary: 'Input report' }), 'utf8');

    expect(() => runTaskReportCommand({
      context,
      taskId: 'T-001',
      opts: { spec: 'auth-L3.1.1-login', input: reportFile, summary: 'flag report', json: false },
    })).toThrow(/INVALID_REPORT: .*--input/);
  });

  it('records verification from flags', () => {
    const result = runTaskVerifyCommand({
      context,
      taskId: 'T-001',
      opts: {
        spec: 'auth-L3.1.1-login',
        command: 'npm test',
        exitCode: 0,
        summary: 'passed',
        coversAc: 'AC-1',
        layer: 'smoke',
        json: false,
      },
    });

    expect(result.verification.id).toBe('V-001');
    expect(result.verification.exitCode).toBe(0);
    expect(result.verification.coversAc).toEqual(['AC-1']);
    expect(result.verification.layer).toBe('smoke');
  });

  it('rejects invalid verification layer', () => {
    expect(() => runTaskVerifyCommand({
      context,
      taskId: 'T-001',
      opts: {
        spec: 'auth-L3.1.1-login',
        command: 'npm test',
        exitCode: 0,
        summary: 'passed',
        layer: 'invalid',
        json: false,
      },
    })).toThrow(/INVALID_VERIFICATION: --layer/);
  });

  it('prints report text and json output', () => {
    const result = runTaskReportCommand({
      context,
      taskId: 'T-001',
      opts: { spec: 'auth-L3.1.1-login', summary: 'report', json: false },
    });

    printTaskReportResult(context, result, { json: false });
    expect(context.logs).toEqual(['✓ Task T-001 report written', '  step: 1']);

    context.logs.length = 0;
    printTaskReportResult(context, result, { json: true });
    expect(JSON.parse(context.logs[0]).stepNo).toBe(1);
  });

  it('prints verification text and json output', () => {
    const result = runTaskVerifyCommand({
      context,
      taskId: 'T-001',
      opts: { spec: 'auth-L3.1.1-login', command: 'npm test', exitCode: 0, summary: 'passed', json: false },
    });

    printTaskVerifyResult(context, result, { json: false });
    expect(context.logs).toEqual([
      '✓ Task T-001 verification V-001 recorded',
      '  exitCode: 0',
      '  taskStatus: running',
    ]);

    context.logs.length = 0;
    printTaskVerifyResult(context, result, { json: true });
    expect(JSON.parse(context.logs[0]).verification.id).toBe('V-001');
  });
});
