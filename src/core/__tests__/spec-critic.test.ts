import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createTestProject, type TestProject } from './project-fixture.js';
import { buildSpecCritique, parseSections } from '../spec-critic.js';
import { createSpec, updateSpec } from '../spec-io.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-spec-critic-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

describe('parseSections', () => {
  it('extracts second-level sections with normalized headings', () => {
    const sections = parseSections('# Title\n\n## 背景：\nBody\n\n## Test Strategy\nTests\n');

    expect(sections.get('背景')).toBe('Body');
    expect(sections.get('test strategy')).toBe('Tests');
  });
});

describe('buildSpecCritique', () => {
  it('reports blocking findings for missing L1 quality sections', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { content: '# Auth\n\n## 背景\nNeed auth.\n', aiSummary: 'auth' });

    const report = buildSpecCritique(project.paths, 'auth-L1');

    expect(report.schemaVersion).toBe('spec-critique.v1');
    expect(report.level).toBe('L1');
    expect(report.summary.blocking).toBeGreaterThan(0);
    expect(report.findings.map(finding => finding.id)).toContain('l1.acceptance.missing');
    expect(report.findings[0]?.sourceRefs[0]).toEqual(expect.objectContaining({ kind: 'spec', id: 'auth-L1' }));
  });

  it('reports L2 contract and split plan gaps', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', {
      content: '# Auth design\n\n## 方案概述\nDesign.\n\n## 受影响模块\nCore.\n',
      aiSummary: 'auth design',
    });

    const report = buildSpecCritique(project.paths, 'auth-L2.1');

    expect(report.findings.map(finding => finding.id)).toContain('l2.contracts.missing');
    expect(report.findings.map(finding => finding.id)).toContain('l2.split.missing');
    expect(report.summary.blocking).toBeGreaterThanOrEqual(2);
  });

  it('reports L3 verification gap and scope advisory', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L3.1.1', level: 'L3', title: 'Auth impl', topic: 'auth', parentCode: 'auth-L2.1' });
    updateSpec(project.paths, 'auth-L3.1.1', {
      content: '# Auth impl\n\n## 目标\nShip.\n\n## 实施步骤\n1. Edit file.\n\n## 风险与缓解\nLow.\n',
      aiSummary: 'auth impl',
    });

    const report = buildSpecCritique(project.paths, 'auth-L3.1.1');

    expect(report.findings.map(finding => finding.id)).toContain('l3.verification.missing');
    expect(report.findings.map(finding => finding.id)).toContain('l3.scope.advisory');
  });

  it('returns no findings for a complete L2 fixture', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
    updateSpec(project.paths, 'auth-L2.1', {
      content: [
        '# Auth design',
        '## 方案概述',
        'Design.',
        '## 技术决策',
        'Decision.',
        '## 受影响模块',
        'Core.',
        '## 接口契约',
        'CLI.',
        '## 兼容性',
        'No breakage.',
        '## 测试策略',
        'Tests.',
        '## L3 裂变计划',
        'One slice.',
      ].join('\n\n'),
      aiSummary: 'auth design',
    });

    const report = buildSpecCritique(project.paths, 'auth-L2.1');

    expect(report.summary).toEqual({ blocking: 0, warning: 0, advisory: 0 });
    expect(report.findings).toEqual([]);
  });

  it('reports a design philosophy advisory for UI implementation specs', () => {
    createSpec({ paths: project.paths, code: 'ui-L1', level: 'L1', title: 'UI', topic: 'ui', parentCode: null });
    updateSpec(project.paths, 'ui-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'ui-L2.1', level: 'L2', title: 'UI design', topic: 'ui', parentCode: 'ui-L1' });
    updateSpec(project.paths, 'ui-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'ui-L3.1.1', level: 'L3', title: 'UI impl', topic: 'ui', parentCode: 'ui-L2.1' });
    updateSpec(project.paths, 'ui-L3.1.1', {
      content: [
        '# UI impl',
        '## 目标',
        'Update frontend visual styling.',
        '## 实施步骤',
        '1. Edit UI files.',
        '## 验证命令',
        'npm test',
        '## 风险与缓解',
        'Low risk.',
        '## 范围',
        '不做 backend changes.',
      ].join('\n\n'),
      aiSummary: 'ui impl',
    });

    const report = buildSpecCritique(project.paths, 'ui-L3.1.1');

    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'design.philosophy.guidance.missing',
        severity: 'advisory',
      }),
    ]));
  });

  it('uses spec title and topic when detecting design philosophy advisory', () => {
    createSpec({ paths: project.paths, code: 'ui-L1', level: 'L1', title: 'UI', topic: 'ui', parentCode: null });
    updateSpec(project.paths, 'ui-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'ui-L2.1', level: 'L2', title: 'Interface plan', topic: 'ui', parentCode: 'ui-L1' });
    updateSpec(project.paths, 'ui-L2.1', {
      content: [
        '# Interface plan',
        '## 方案概述',
        'Ship the screen.',
        '## 技术决策',
        'Decision.',
        '## 受影响模块',
        'Frontend.',
        '## 接口契约',
        'CLI.',
        '## 兼容性',
        'No breakage.',
        '## 测试策略',
        'Tests.',
        '## L3 裂变计划',
        'One slice.',
      ].join('\n\n'),
      aiSummary: 'interface plan',
    });

    const report = buildSpecCritique(project.paths, 'ui-L2.1');

    expect(report.findings.map(finding => finding.id)).toContain('design.philosophy.guidance.missing');
  });

  it('does not report design philosophy advisory when prose guidance is explicit', () => {
    createSpec({ paths: project.paths, code: 'ui-L1', level: 'L1', title: 'UI', topic: 'ui', parentCode: null });
    updateSpec(project.paths, 'ui-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'ui-L2.1', level: 'L2', title: 'UI design', topic: 'ui', parentCode: 'ui-L1' });
    updateSpec(project.paths, 'ui-L2.1', {
      content: [
        '# UI design',
        '## 方案概述',
        'Use DESIGN.md prose-first guidance for frontend design.',
        '## 技术决策',
        'Decision.',
        '## 受影响模块',
        'Frontend.',
        '## 接口契约',
        'CLI.',
        '## 兼容性',
        'No breakage.',
        '## 测试策略',
        'Tests.',
        '## L3 裂变计划',
        'One slice.',
      ].join('\n\n'),
      aiSummary: 'ui design',
    });

    const report = buildSpecCritique(project.paths, 'ui-L2.1');

    expect(report.findings.map(finding => finding.id)).not.toContain('design.philosophy.guidance.missing');
  });

  it('throws SPEC_NOT_FOUND for missing specs', () => {
    expect(() => buildSpecCritique(project.paths, 'missing-L1')).toThrow(/SPEC_NOT_FOUND/);
  });
});
