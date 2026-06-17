import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { createTask } from '../task.js';
import { buildDriftCheckReport } from '../drift-check.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-drift-check-');
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
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed', content: '# Auth\n\n## 背景\nNeed auth.\n## 用户故事\nUsers.\n## 验收标准\nAC.\n## 范围边界\nScope.\n', aiSummary: 'auth' });
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
      '- Edit src/core/auth.ts.',
      '- Run npm test.',
      '## 受影响模块',
      'Core.',
      '## 验证命令',
      'npm test',
      '## 文件级改动',
      '- src/core/auth.ts',
      '## 风险与缓解',
      'Keep stable.',
    ].join('\n\n'),
    aiSummary: 'impl',
  });
  return 'auth-L3.1.1';
}

describe('buildDriftCheckReport', () => {
  it('reports undeclared changed files', () => {
    const specCode = createFrozenL3();
    const { task } = createTask({
      paths: project.paths,
      specCode,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [specCode],
        steps: [
          { stepNo: 1, stepType: 'tool_action', name: 'edit src/core/auth.ts' },
          { stepNo: 2, stepType: 'tool_action', name: '验证 drift check' },
        ],
      },
    });

    const report = buildDriftCheckReport(project.paths, task.id, specCode, {
      gitReader: () => [
        { path: 'src/core/auth.ts', status: 'M' },
        { path: 'README.md', status: 'M' },
      ],
    });

    expect(report.schemaVersion).toBe('drift-check.v1');
    expect(report.changedFiles.map(item => item.path)).toEqual(['src/core/auth.ts', 'README.md']);
    expect(report.declaredFiles).toContain('src/core/auth.ts');
    expect(report.undeclaredFiles).toEqual(['README.md']);
    expect(report.findings.some(finding => finding.id === 'drift.undeclared-files')).toBe(true);
  });

  it('reports advisory when declared scope is unavailable', () => {
    const specCode = createFrozenL3();
    updateSpec(project.paths, specCode, {
      content: [
        '# Auth impl',
        '## 目标',
        'Implement auth.',
        '## 实施步骤',
        '- Run validation.',
        '## 受影响模块',
        'Core.',
        '## 验证命令',
        'npm test',
        '## 风险与缓解',
        'Keep stable.',
      ].join('\n\n'),
      aiSummary: 'impl without declared files',
    });
    const { task } = createTask({
      paths: project.paths,
      specCode,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [specCode],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 drift check' }],
      },
    });

    const report = buildDriftCheckReport(project.paths, task.id, specCode, {
      gitReader: () => [{ path: 'src/core/auth.ts', status: 'M' }],
    });

    expect(report.declaredFiles).toEqual([]);
    expect(report.findings.some(finding => finding.id === 'drift.scope.unavailable')).toBe(true);
  });

  it('throws stable errors for missing resources', () => {
    expect(() => buildDriftCheckReport(project.paths, 'T-404', 'missing-L3')).toThrow(/SPEC_NOT_FOUND: missing-L3/);
  });
});
