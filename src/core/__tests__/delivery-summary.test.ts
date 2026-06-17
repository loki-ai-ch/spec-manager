import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { addTaskVerification, createTask, findTask, startTask, type TaskRecord } from '../task.js';
import { createSpec, findSpecByCode, updateSpec } from '../spec-io.js';
import { buildDeliverySummary } from '../delivery-summary.js';
import { TASK_FILE_EXT } from '../constants.js';
import { siblingMetaDir } from '../paths.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-delivery-summary-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

function createFrozenL3(topic: string, critical = true): string {
  const l1Code = `${topic}-L1`;
  createSpec({ paths: project.paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(project.paths, l1Code, {
    status: 'confirmed',
    content: `# ${topic} L1\n\n## 背景\n\n## 用户故事\n\n## 验收标准\n\n## 范围边界\n\n## 度量指标\n\n## 风险\n`,
    aiSummary: topic,
  });

  const l2Code = `${topic}-L2.1`;
  createSpec({ paths: project.paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(project.paths, l2Code, {
    status: 'confirmed',
    content: `# ${topic} L2\n\n## 方案概述\n\n## 技术决策\n\n## 受影响模块\n\n## 接口契约\n\n## L3 裂变计划\n`,
    aiSummary: topic,
  });

  const l3Code = `${topic}-L3.1.1`;
  createSpec({ paths: project.paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(project.paths, l3Code, {
    status: 'frozen',
    content: [
      `# ${topic} L3`,
      '## 目标',
      'Implement delivery summary.',
      '## 实施步骤',
      '1. Build projection.',
      '2. Test projection.',
      '## 受影响模块',
      'Core.',
      '## 验收标准',
      '1. **AC-1**: delivery summary evidence is projected',
      '## 关键验收标准',
      critical ? '- AC-1' : '',
      '## 验证命令',
      'npm test',
    ].join('\n\n'),
    aiSummary: topic,
  });
  return l3Code;
}

function createRunningTask(specCode: string, withVerification = true) {
  const { task } = createTask({
    paths: project.paths,
    specCode,
    autoConfirm: false,
    planJson: {
      coveredSpecs: [specCode],
      steps: [
        { stepNo: 1, stepType: 'tool_action', name: 'collect local evidence' },
        { stepNo: 2, stepType: 'tool_action', name: 'run npm test verification' },
      ],
    },
  });
  startTask(project.paths, task.id, specCode);
  if (withVerification) {
    addTaskVerification({
      paths: project.paths,
      taskId: task.id,
      specCode,
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: ['coverage/index.html', 'reports/delivery.json'],
      coversAc: ['AC-1'],
    });
  }
  return task.id;
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

describe('buildDeliverySummary', () => {
  it('builds a delivery summary for a completed task with passed verification', () => {
    const specCode = createFrozenL3('delivery-summary-complete');
    const taskId = createRunningTask(specCode);
    markTaskCompleted(specCode, taskId);

    const report = buildDeliverySummary(project.paths, taskId, specCode);

    expect(report.schemaVersion).toBe('delivery-summary.v1');
    expect(report.taskId).toBe(taskId);
    expect(report.specCode).toBe(specCode);
    expect(report.verifications).toEqual([
      expect.objectContaining({ status: 'passed', command: 'npm test', layer: 'functional' }),
    ]);
    expect(report.artifacts).toEqual(['coverage/index.html', 'reports/delivery.json']);
    expect(report.findings.some(finding => finding.id === 'delivery.task.not-completed')).toBe(false);
    expect(report.summary[0]).toContain('delivery-summary-complete L3');
  });

  it('marks failed verification and emits warning finding', () => {
    const specCode = createFrozenL3('delivery-summary-failed');
    const taskId = createRunningTask(specCode);
    addTaskVerification({
      paths: project.paths,
      taskId,
      specCode,
      command: 'npm run smoke',
      exitCode: 1,
      summary: 'failed',
      artifacts: ['reports/failure.log'],
      coversAc: ['AC-1'],
    });

    const report = buildDeliverySummary(project.paths, taskId, specCode);

    expect(report.verifications.map(item => item.status)).toContain('failed');
    expect(report.findings.some(finding => finding.id === 'delivery.verification.failed')).toBe(true);
    expect(report.nextAction).toBe('Fix failed verification and record a new verification before handoff.');
  });

  it('warns when verification evidence is missing', () => {
    const specCode = createFrozenL3('delivery-summary-missing', false);
    const taskId = createRunningTask(specCode, false);

    const report = buildDeliverySummary(project.paths, taskId, specCode);

    expect(report.verifications).toEqual([]);
    expect(report.findings.some(finding => finding.id === 'delivery.verification.missing')).toBe(true);
    expect(report.nextAction).toContain('task verify');
  });

  it('points incomplete tasks back to assist next', () => {
    const specCode = createFrozenL3('delivery-summary-next');
    const taskId = createRunningTask(specCode);

    const report = buildDeliverySummary(project.paths, taskId, specCode);

    expect(report.findings.some(finding => finding.id === 'delivery.task.not-completed')).toBe(true);
    expect(report.nextAction).toContain('assist next');
  });

  it('throws stable errors for missing spec or task', () => {
    expect(() => buildDeliverySummary(project.paths, 'T-404', 'missing-L3')).toThrow(/SPEC_NOT_FOUND: missing-L3/);
    const specCode = createFrozenL3('delivery-summary-missing-task');
    expect(() => buildDeliverySummary(project.paths, 'T-404', specCode)).toThrow(/TASK_NOT_FOUND: T-404/);
  });

  it('does not mutate task or audit files', () => {
    const specCode = createFrozenL3('delivery-summary-readonly');
    const taskId = createRunningTask(specCode);
    const taskPath = taskFilePath(specCode, taskId);
    const beforeTaskContent = readFileSync(taskPath, 'utf8');
    const beforeAuditContent = readFileSync(project.paths.auditFile, 'utf8');

    buildDeliverySummary(project.paths, taskId, specCode);

    expect(readFileSync(taskPath, 'utf8')).toBe(beforeTaskContent);
    expect(readFileSync(project.paths.auditFile, 'utf8')).toBe(beforeAuditContent);
  });
});
