import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { createTask, reportStep, startTask } from '../task.js';
import { buildTaskNextReport } from '../task-next.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-task-next-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

function createFrozenL3(): string {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed', content: '# Auth\n\n## 背景\nNeed auth.\n## 用户故事\nUsers.\n## 验收标准\nAC.\n## 范围边界\nScope.\n## 度量指标\nMetrics.\n## 风险\nRisks.\n', aiSummary: 'auth' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed', content: '# Auth design\n\n## 方案概述\nDesign.\n## 受影响模块\nCore.\n## 接口契约\nCLI.\n## L3 裂变计划\nSlice.\n', aiSummary: 'design' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1', {
    status: 'frozen',
    content: [
      '# Auth impl',
      '## 目标',
      'Implement auth.',
      '## 实施步骤',
      '1. Edit src/core/auth.ts.',
      '2. Run npm test.',
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

describe('buildTaskNextReport', () => {
  it('reports next action, incomplete steps, last failure, and evidence summary', () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });
    const specCode = createFrozenL3();
    const { task } = createTask({
      paths: project.paths,
      specCode,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [specCode],
        steps: [
          { stepNo: 1, stepType: 'tool_action', name: 'edit src/core/auth.ts' },
          { stepNo: 2, stepType: 'tool_action', name: 'run npm test' },
        ],
      },
    });
    startTask(project.paths, task.id, specCode);
    reportStep({
      paths: project.paths,
      specCode,
      taskId: task.id,
      stepNo: 1,
      status: 'failed',
      outputJson: '{"summary":"auth step failed"}',
    });

    const report = buildTaskNextReport(project.paths, task.id, specCode);

    expect(report.schemaVersion).toBe('task-next.v1');
    expect(report.taskStatus).toBe('running');
    expect(report.currentStep).toBe(1);
    expect(report.nextAction).toContain('task step');
    expect(report.incompleteSteps.map(step => step.status)).toContain('failed');
    expect(report.lastFailure).toContain('auth step failed');
    expect(report.evidenceSummary).toMatchObject({ required: 0, covered: 0, failed: 0, uncovered: 0 });
    expect(report.findings.some(finding => finding.id === 'task-next.failed-step')).toBe(true);
    expect(report.findings.some(finding => finding.id === 'task-next.verification.missing')).toBe(true);
  });

  it('reports draft task next action', () => {
    const specCode = createFrozenL3();
    const { task } = createTask({
      paths: project.paths,
      specCode,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [specCode],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 auth task next' }],
      },
    });

    const report = buildTaskNextReport(project.paths, task.id, specCode);

    expect(report.taskStatus).toBe('draft');
    expect(report.nextAction).toContain('task start');
    expect(report.findings.some(finding => finding.id === 'task-next.not-running')).toBe(true);
  });

  it('throws stable errors for missing resources', () => {
    expect(() => buildTaskNextReport(project.paths, 'T-404', 'missing-L3')).toThrow(/SPEC_NOT_FOUND: missing-L3/);
    expect(() => buildTaskNextReport(project.paths, 'T-404', createFrozenL3())).toThrow(/TASK_NOT_FOUND: T-404/);
  });
});
