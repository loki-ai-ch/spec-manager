import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import {
  buildHarnessTaskContext,
  normalizeHarnessTaskReportPayload,
  normalizeHarnessTaskVerificationPayload,
  recordHarnessTaskVerification,
  renderHarnessTaskContextText,
  reportHarnessTaskStep,
} from '../harness.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { addTaskVerification, createTask, startTask } from '../task.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-harness-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

function createHierarchy(opts?: { frozen?: boolean }): string {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1-login', level: 'L3', title: 'Login', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1-login', {
    content: `# Login

## 目标

- Add login task context.

## 验收标准

1. **AC-1**: Given frozen L3, When context is built, Then output SHALL include status gate.
2. **AC-2**: Given JSON format, When rendered, Then fields SHALL be stable.

## 关键验收标准

- AC-1

## 验证命令

\`\`\`bash
# targeted
npm test -- --run src/core/__tests__/harness.test.ts
npm run build
\`\`\`
`,
    aiSummary: 'Login context summary',
    changeSummary: 'test fixture content',
  });
  if (opts?.frozen ?? true) {
    updateSpec(project.paths, 'auth-L3.1.1-login', { status: 'frozen' });
  }
  return 'auth-L3.1.1-login';
}

function createTaskForReport(): string {
  const specCode = createHierarchy();
  createTask({
    paths: project.paths,
    specCode,
    autoConfirm: false,
    planJson: {
      coveredSpecs: [specCode],
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: 'inspect source files' },
        { stepNo: 2, stepType: 'tool_action', name: 'run verify test' },
      ],
    },
  });
  startTask(project.paths, 'T-001', specCode);
  return specCode;
}

describe('harness task context', () => {
  it('builds context for frozen L3', () => {
    const code = createHierarchy();

    const context = buildHarnessTaskContext(project.paths, code);

    expect(context.statusGate.allowed).toBe(true);
    expect(context.specCode).toBe(code);
    expect(context.summary).toBe('Login context summary');
    expect(context.acceptanceCriteria).toHaveLength(2);
    expect(context.acceptanceCriteria[0]).toContain('AC-1');
    expect(context.criticalAcceptanceCriteria).toEqual(['AC-1: Given frozen L3, When context is built, Then output SHALL include status gate.']);
    expect(context.workflowProfile).toBe('legacy');
    expect(context.suggestedVerification).toContain('npm run build');
    expect(context.nextCommands).toContain(`spec-manager task create ${code} --plan ./plan.json`);
  });

  it('rejects draft L3', () => {
    const code = createHierarchy({ frozen: false });

    expect(() => buildHarnessTaskContext(project.paths, code)).toThrow(/L3_NOT_FROZEN/);
  });

  it('rejects non-L3 specs', () => {
    createHierarchy();

    expect(() => buildHarnessTaskContext(project.paths, 'auth-L2.1')).toThrow(/SPEC_NOT_L3/);
  });

  it('rejects missing specs', () => {
    expect(() => buildHarnessTaskContext(project.paths, 'missing-L3.1.1')).toThrow(/SPEC_NOT_FOUND/);
  });

  it('renders text context sections', () => {
    const code = createHierarchy();
    const context = buildHarnessTaskContext(project.paths, code);

    const rendered = renderHarnessTaskContextText(context);

    expect(rendered).toContain('Task Context');
    expect(rendered).toContain('Status Gate');
    expect(rendered).toContain('Acceptance Criteria');
    expect(rendered).toContain('Critical Acceptance Criteria');
    expect(rendered).toContain('Workflow Profile: legacy');
    expect(rendered).toContain('Next');
  });

  it('includes evidence coverage when a task exists', () => {
    const specCode = createTaskForReport();
    addTaskVerification({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      coversAc: ['AC-1'],
    });

    const context = buildHarnessTaskContext(project.paths, specCode);
    const rendered = renderHarnessTaskContextText(context);

    expect(context.evidenceCoverage?.summary).toEqual({ required: 1, covered: 1, failed: 0, uncovered: 0 });
    expect(context.evidenceCoverage?.criteria).toEqual([{ id: 'AC-1', status: 'covered', verificationIds: ['V-001'] }]);
    expect(rendered).toContain('Evidence Coverage: 1/1 critical AC covered');
    expect(rendered).toContain('- AC-1: covered (V-001)');
  });
});

describe('harness task report', () => {
  it('normalizes report payload', () => {
    const payload = normalizeHarnessTaskReportPayload({
      summary: ' implemented report ',
      stepNo: '2',
      files: ['src/core/harness.ts'],
      tests: ['npm test'],
      risks: ['none'],
      ignored: true,
    });

    expect(payload).toEqual({
      summary: 'implemented report',
      stepNo: '2',
      files: ['src/core/harness.ts'],
      tests: ['npm test'],
      risks: ['none'],
    });
  });

  it('rejects invalid report payload', () => {
    expect(() => normalizeHarnessTaskReportPayload({ files: [] })).toThrow(/INVALID_REPORT/);
    expect(() => normalizeHarnessTaskReportPayload({ summary: 'ok', files: 'src/core/harness.ts' })).toThrow(/INVALID_REPORT.*files/);
  });

  it('reports next pending task step', () => {
    const specCode = createTaskForReport();

    const result = reportHarnessTaskStep({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      payload: {
        summary: 'Implemented report adapter',
        files: ['src/core/harness.ts'],
        tests: ['npm test'],
        risks: [],
      },
    });

    expect(result.stepNo).toBe(1);
    expect(result.task.steps?.[0].status).toBe('succeeded');
    const output = JSON.parse(result.task.steps?.[0].outputJson ?? '{}');
    expect(output.summary).toBe('Implemented report adapter');
    expect(output.files).toEqual(['src/core/harness.ts']);
    expect(output.tests).toEqual(['npm test']);
    expect(output.risks).toEqual([]);
  });

  it('reports specified task step', () => {
    const specCode = createTaskForReport();

    const result = reportHarnessTaskStep({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      payload: { stepNo: 2, summary: 'Verification completed' },
    });

    expect(result.stepNo).toBe(2);
    expect(result.task.steps?.[1].status).toBe('succeeded');
  });

  it('rejects report when no pending or running step exists', () => {
    const specCode = createTaskForReport();
    reportHarnessTaskStep({ paths: project.paths, taskId: 'T-001', specCode, payload: { summary: 'first' } });
    reportHarnessTaskStep({ paths: project.paths, taskId: 'T-001', specCode, payload: { summary: 'second' } });

    expect(() => reportHarnessTaskStep({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      payload: { summary: 'third' },
    })).toThrow(/NO_REPORTABLE_STEP/);
  });
});

describe('harness task verification', () => {
  it('normalizes verification payload', () => {
    const payload = normalizeHarnessTaskVerificationPayload({
      command: ' npm test ',
      exitCode: 0,
      summary: ' passed ',
      artifacts: ['coverage/index.html'],
      coversAc: ['AC-1'],
      ignored: true,
    });

    expect(payload).toEqual({
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: ['coverage/index.html'],
      coversAc: ['AC-1'],
    });
  });

  it('rejects invalid verification payload', () => {
    expect(() => normalizeHarnessTaskVerificationPayload({ exitCode: 0, summary: 'ok' })).toThrow(/INVALID_VERIFICATION.*command/);
    expect(() => normalizeHarnessTaskVerificationPayload({ command: 'npm test', exitCode: '0', summary: 'ok' })).toThrow(/INVALID_VERIFICATION.*exitCode/);
    expect(() => normalizeHarnessTaskVerificationPayload({ command: 'npm test', exitCode: 0, summary: 'ok', artifacts: 'coverage' })).toThrow(/INVALID_VERIFICATION.*artifacts/);
  });

  it('records successful verification evidence', () => {
    const specCode = createTaskForReport();

    const result = recordHarnessTaskVerification({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      payload: {
        command: 'npm test',
        exitCode: 0,
        summary: 'All tests passed',
        artifacts: ['coverage/index.html'],
        coversAc: ['AC-1'],
      },
    });

    expect(result.verification.id).toBe('V-001');
    expect(result.verification.command).toBe('npm test');
    expect(result.verification.exitCode).toBe(0);
    expect(result.verification.coversAc).toEqual(['AC-1']);
    expect(result.task.verifications?.[0].summary).toBe('All tests passed');
  });

  it('records failed verification without changing task status', () => {
    const specCode = createTaskForReport();

    const result = recordHarnessTaskVerification({
      paths: project.paths,
      taskId: 'T-001',
      specCode,
      payload: {
        command: 'npm test',
        exitCode: 1,
        summary: 'Tests failed',
      },
    });

    expect(result.verification.exitCode).toBe(1);
    expect(result.task.status).toBe('running');
  });
});
