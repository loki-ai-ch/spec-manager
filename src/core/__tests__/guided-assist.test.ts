import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { addTaskVerification, createTask, findTask, startTask, type TaskRecord } from '../task.js';
import { buildGuidedAssistReport } from '../guided-assist.js';
import { siblingMetaDir } from '../paths.js';
import { findSpecByCode } from '../spec-io.js';
import { TASK_FILE_EXT } from '../constants.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-guided-assist-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

function createDraftSpec(): string {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { content: '# Auth\n\n## 背景\nNeed auth.\n', aiSummary: 'auth' });
  return 'auth-L1';
}

function createFrozenL3(): string {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed', content: '# Auth\n\n## 背景\nNeed auth.\n## 用户故事\nUsers.\n## 验收标准\nAC.\n## 范围边界\nScope.\n', aiSummary: 'auth' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed', content: '# Auth design\n\n## 方案概述\nDesign.\n## 技术决策\nDecision.\n## 受影响模块\nCore.\n## 接口契约\nCLI.\n## L3 裂变计划\nSlice.\n', aiSummary: 'design' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1', {
    status: 'frozen',
    content: [
      '# Auth impl',
      '## 目标',
      'Implement auth.',
      '## 实施步骤',
      '- Edit src/core/auth.ts.',
      '## 受影响模块',
      'Core.',
      '## 验证命令',
      'npm test',
      '## 风险与缓解',
      'Keep stable.',
      '## 文件级改动',
      '- src/core/auth.ts',
    ].join('\n\n'),
    aiSummary: 'impl',
  });
  return 'auth-L3.1.1';
}

function createTaskFor(specCode: string) {
  return createTask({
    paths: project.paths,
    specCode,
    autoConfirm: false,
    planJson: {
        coveredSpecs: [specCode],
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: 'edit src/core/auth.ts' },
        { stepNo: 2, stepType: 'tool_action', name: '验证 npm test' },
      ],
    },
  }).task;
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

describe('buildGuidedAssistReport', () => {
  it('recommends brief for request-only work with a topic', () => {
    const report = buildGuidedAssistReport({ paths: project.paths, request: 'auth login support', topic: 'auth' });

    expect(report.schemaVersion).toBe('guided-assist.v1');
    expect(report.stage).toBe('brief');
    expect(report.nextCommand).toBe('spec-manager assist brief --request "auth login support" --topic auth');
    expect(report.reason).toContain('brief');
  });

  it('recommends critique for a draft spec', () => {
    const specCode = createDraftSpec();

    const report = buildGuidedAssistReport({ paths: project.paths, request: '确认这个 spec', specCode });

    expect(report.stage).toBe('critique');
    expect(report.specCode).toBe(specCode);
    expect(report.nextCommand).toBe(`spec-manager assist critique ${specCode}`);
    expect(report.sourceRefs.map(ref => `${ref.kind}:${ref.id}`)).toContain(`spec:${specCode}`);
  });

  it('recommends task-next for a running task and includes drift alternative when files changed', () => {
    const specCode = createFrozenL3();
    const task = createTaskFor(specCode);
    startTask(project.paths, task.id, specCode);

    const report = buildGuidedAssistReport({
      paths: project.paths,
      request: '继续这个任务',
      specCode,
      taskId: task.id,
      gitReader: () => [{ path: 'src/core/auth.ts', status: 'M' }],
    });

    expect(report.stage).toBe('task-next');
    expect(report.nextCommand).toBe(`spec-manager assist next ${task.id} --spec ${specCode}`);
    expect(report.alternatives.map(item => item.command)).toContain(`spec-manager assist drift ${task.id} --spec ${specCode}`);
  });

  it('recommends drift when the request asks about changed scope', () => {
    const specCode = createFrozenL3();
    const task = createTaskFor(specCode);
    startTask(project.paths, task.id, specCode);

    const report = buildGuidedAssistReport({
      paths: project.paths,
      request: '检查改动范围偏差',
      specCode,
      taskId: task.id,
      gitReader: () => [{ path: 'README.md', status: 'M' }],
    });

    expect(report.stage).toBe('drift');
    expect(report.nextCommand).toBe(`spec-manager assist drift ${task.id} --spec ${specCode}`);
  });

  it('recommends delivery for completed task with delivery intent', () => {
    const specCode = createFrozenL3();
    const task = createTaskFor(specCode);
    startTask(project.paths, task.id, specCode);
    addTaskVerification({
      paths: project.paths,
      specCode,
      taskId: task.id,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
    });
    markTaskCompleted(specCode, task.id);

    const report = buildGuidedAssistReport({
      paths: project.paths,
      request: '准备最终交付总结',
      specCode,
      taskId: task.id,
      gitReader: () => [],
    });

    expect(report.stage).toBe('delivery');
    expect(report.nextCommand).toBe(`spec-manager assist delivery ${task.id} --spec ${specCode}`);
    expect(report.alternatives.map(item => item.command)).toContain(`spec-manager assist acceptance ${task.id} --spec ${specCode}`);
  });

  it('keeps acceptance for completed task with evidence intent', () => {
    const specCode = createFrozenL3();
    const task = createTaskFor(specCode);
    startTask(project.paths, task.id, specCode);
    markTaskCompleted(specCode, task.id);

    const report = buildGuidedAssistReport({
      paths: project.paths,
      request: '查看验收证据覆盖',
      specCode,
      taskId: task.id,
      gitReader: () => [],
    });

    expect(report.stage).toBe('acceptance');
    expect(report.nextCommand).toBe(`spec-manager assist acceptance ${task.id} --spec ${specCode}`);
  });

  it('keeps task-next for running task with delivery intent', () => {
    const specCode = createFrozenL3();
    const task = createTaskFor(specCode);
    startTask(project.paths, task.id, specCode);

    const report = buildGuidedAssistReport({
      paths: project.paths,
      request: '准备交付',
      specCode,
      taskId: task.id,
      gitReader: () => [],
    });

    expect(report.stage).toBe('task-next');
    expect(report.nextCommand).toBe(`spec-manager assist next ${task.id} --spec ${specCode}`);
  });

  it('reports needs-input for missing request or task without spec', () => {
    expect(buildGuidedAssistReport({ paths: project.paths, request: '   ' }).stage).toBe('needs-input');
    const report = buildGuidedAssistReport({ paths: project.paths, request: 'continue', taskId: 'T-001' });

    expect(report.stage).toBe('needs-input');
    expect(report.findings.map(finding => finding.id)).toContain('guided-assist.task.spec-required');
  });

  it('throws stable errors for missing spec and task', () => {
    expect(() => buildGuidedAssistReport({ paths: project.paths, request: 'review', specCode: 'missing-L1' })).toThrow(/SPEC_NOT_FOUND: missing-L1/);
    const specCode = createFrozenL3();
    expect(() => buildGuidedAssistReport({ paths: project.paths, request: 'continue', specCode, taskId: 'T-404' })).toThrow(/TASK_NOT_FOUND: T-404/);
  });
});
