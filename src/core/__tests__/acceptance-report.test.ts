import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPaths, type ProjectPaths } from '../paths.js';
import { createSpec, generateSpecCode, updateSpec } from '../spec-io.js';
import { addTaskVerification, createTask, startTask } from '../task.js';
import { buildAcceptanceReport } from '../acceptance-report.js';
import { writeAdaptiveWorkflowConfig } from '../workflow-profile.js';

let root: string;
let paths: ProjectPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'spec-mgr-acceptance-report-'));
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  paths = getPaths(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function planFor(specCode: string) {
  return {
    coveredSpecs: [specCode],
    steps: [{ stepNo: 1, stepType: 'tool_action' as const, name: 'run acceptance report test' }],
  };
}

function createFrozenL3(topic: string, content = specContent()): string {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(paths, l3Code, { content, aiSummary: 'Acceptance report fixture' });
  updateSpec(paths, l3Code, { status: 'frozen' });
  return l3Code;
}

function specContent(): string {
  return `# Acceptance L3

## 目标

Test acceptance report projection.

## 实施步骤

- Implement.

## 验收标准

1. **AC-1**: first critical behavior
2. **AC-2**: second critical behavior
3. **AC-3**: non-critical behavior

## 关键验收标准

- AC-1
- AC-2

## 验证命令

\`\`\`bash
npm test
\`\`\`
`;
}

describe('buildAcceptanceReport', () => {
  it('summarizes criteria, verification records, artifacts, human acceptance, and residual risk', () => {
    writeAdaptiveWorkflowConfig(paths, { enabled: true, defaultProfile: 'governed' });
    const specCode = createFrozenL3('acceptance-report');
    const { task } = createTask({ paths, specCode, planJson: planFor(specCode), autoConfirm: false });
    startTask(paths, task.id, specCode);
    addTaskVerification({
      paths,
      specCode,
      taskId: task.id,
      command: 'npm test -- acceptance',
      exitCode: 0,
      summary: 'covered first AC',
      artifacts: ['coverage/index.html', 'reports/acceptance.json'],
      coversAc: ['AC-1'],
    });
    addTaskVerification({
      paths,
      specCode,
      taskId: task.id,
      command: 'npm run smoke',
      exitCode: 1,
      summary: 'failed second AC',
      artifacts: ['reports/acceptance.json'],
      coversAc: ['AC-2'],
    });

    const report = buildAcceptanceReport(paths, task.id, specCode);

    expect(report.schemaVersion).toBe('acceptance-report.v1');
    expect(report.profile).toBe('governed');
    expect(report.criteria.map(item => [item.id, item.status, item.verificationIds])).toEqual([
      ['AC-1', 'covered', ['V-001']],
      ['AC-2', 'failed', ['V-002']],
    ]);
    expect(report.verifications.map(item => item.command)).toEqual(['npm test -- acceptance', 'npm run smoke']);
    expect(report.artifacts).toEqual(['coverage/index.html', 'reports/acceptance.json']);
    expect(report.summary).toEqual({ required: 2, covered: 1, failed: 1, uncovered: 0 });
    expect(report.humanAcceptance.some(finding => finding.id === 'acceptance.failed-criteria')).toBe(true);
    expect(report.residualRisk.some(finding => finding.id === 'acceptance.residual-risk.criteria-gap')).toBe(true);
  });

  it('returns an advisory report when no critical AC is declared', () => {
    const specCode = createFrozenL3('acceptance-no-critical', specContent().replace('## 关键验收标准\n\n- AC-1\n- AC-2\n\n', ''));
    const { task } = createTask({ paths, specCode, planJson: planFor(specCode), autoConfirm: false });

    const report = buildAcceptanceReport(paths, task.id, specCode);

    expect(report.criteria).toEqual([]);
    expect(report.summary).toEqual({ required: 0, covered: 0, failed: 0, uncovered: 0 });
    expect(report.humanAcceptance.some(finding => finding.id === 'acceptance.no-critical-ac')).toBe(true);
    expect(report.residualRisk.some(finding => finding.id === 'acceptance.residual-risk.no-verification')).toBe(true);
  });

  it('throws stable errors for missing resources and unknown critical AC', () => {
    expect(() => buildAcceptanceReport(paths, 'T-404', 'missing-L3')).toThrow(/SPEC_NOT_FOUND: missing-L3/);
    const specCode = createFrozenL3('acceptance-unknown-critical', specContent().replace('- AC-2', '- AC-9'));
    const { task } = createTask({ paths, specCode, planJson: planFor(specCode), autoConfirm: false });
    expect(() => buildAcceptanceReport(paths, task.id, specCode)).toThrow(/UNKNOWN_CRITICAL_AC: AC-9/);
  });
});
