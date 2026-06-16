import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, writeSpec } from '../spec-io.js';
import { inspectProjectIntegrity } from '../integrity.js';
import { writeIntegrityExemptions } from '../integrity-exemptions.js';
import { createDecision, setDecisionPartial } from '../decision.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-integrity-');
});

afterEach(() => {
  project.cleanup();
});

describe('inspectProjectIntegrity', () => {
  it('detects dangling parent and missing decision', () => {
    const spec = createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    writeSpec({ ...spec, fm: { ...spec.fm, parentCode: 'missing-L0', status: 'implemented' } });
    const issues = inspectProjectIntegrity(project.paths);
    expect(issues.some(issue => issue.kind === 'dangling-reference' && issue.targetId === 'missing-L0')).toBe(true);
    expect(issues.some(issue => issue.kind === 'missing-decision' && issue.sourceId === 'auth-L1')).toBe(true);
  });

  it('treats a partial decision as missing for implemented L1 integrity', () => {
    const spec = createSpec({ paths: project.paths, code: 'partial-L1', level: 'L1', title: 'Partial', topic: 'partial', parentCode: null });
    writeSpec({ ...spec, fm: { ...spec.fm, status: 'implemented' } });
    const decision = createDecision({ paths: project.paths, docCode: 'partial-L1', topic: 'partial', what: 'Legacy choice' });
    setDecisionPartial({ paths: project.paths, id: decision.id, reason: 'No longer current' });

    expect(inspectProjectIntegrity(project.paths).some(issue => issue.kind === 'missing-decision' && issue.sourceId === 'partial-L1')).toBe(true);
  });

  it('detects legacy completed task without successful verification', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    const taskDir = join(project.paths.specsDir, 'auth', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, 'auth-L1-T-001.json'), JSON.stringify({
      id: 'T-001',
      specCode: 'auth-L1',
      status: 'completed',
      steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'verify', status: 'succeeded' }],
      created: new Date().toISOString(),
    }), 'utf8');
    expect(inspectProjectIntegrity(project.paths).some(issue => issue.kind === 'missing-verification')).toBe(true);
  });

  it('detects completed governed task without full critical AC coverage', () => {
    writeGovernedEvidenceFixture('governed-integrity-L3.1.1', { coversAc: [] });

    const issues = inspectProjectIntegrity(project.paths);

    expect(issues.some(issue =>
      issue.kind === 'missing-evidence-coverage' &&
      issue.sourceId === 'governed-integrity-L3.1.1:T-001' &&
      issue.message.includes('AC-1'),
    )).toBe(true);
  });

  it('does not report legacy completed task missing critical AC coverage as evidence violation', () => {
    writeGovernedEvidenceFixture('legacy-integrity-L3.1.1', { profile: 'legacy', coversAc: [] });

    const issues = inspectProjectIntegrity(project.paths);

    expect(issues.some(issue => issue.kind === 'missing-evidence-coverage')).toBe(false);
  });

  it('suppresses only an exact valid legacy verification exemption', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    writeLegacyTask('auth-L1', 'T-001');
    writeLegacyTask('auth-L1', 'T-002');
    writeIntegrityExemptions(project.paths, {
      version: 1,
      exemptions: [{
        id: 'migration:auth-L1:T-001',
        kind: 'legacy-missing-verification',
        specCode: 'auth-L1',
        taskId: 'T-001',
        reason: 'legacy task',
        createdAt: new Date().toISOString(),
        migrationId: 'migration',
      }],
    });
    const issues = inspectProjectIntegrity(project.paths);
    expect(issues.some(issue => issue.kind === 'missing-verification' && issue.sourceId === 'auth-L1:T-001')).toBe(false);
    expect(issues.some(issue => issue.kind === 'missing-verification' && issue.sourceId === 'auth-L1:T-002')).toBe(true);
  });

  it('reports exemptions that do not reference an eligible task', () => {
    writeIntegrityExemptions(project.paths, {
      version: 1,
      exemptions: [{
        id: 'migration:missing-L3.1.1:T-001',
        kind: 'legacy-missing-verification',
        specCode: 'missing-L3.1.1',
        taskId: 'T-001',
        reason: 'legacy task',
        createdAt: new Date().toISOString(),
        migrationId: 'migration',
      }],
    });
    expect(inspectProjectIntegrity(project.paths).some(issue => issue.kind === 'invalid-exemption')).toBe(true);
  });

  it('reports only confirmed parents whose direct children are all implemented', () => {
    const parent = createSpec({ paths: project.paths, code: 'done-L1', level: 'L1', title: 'Done', topic: 'done', parentCode: null });
    writeSpec({ ...parent, fm: { ...parent.fm, status: 'confirmed' } });
    const child = createSpec({ paths: project.paths, code: 'done-L2.1', level: 'L2', title: 'Done design', topic: 'done', parentCode: 'done-L1' });
    writeSpec({ ...child, fm: { ...child.fm, status: 'implemented' } });
    expect(inspectProjectIntegrity(project.paths).some(issue => issue.kind === 'stale-confirmed-parent' && issue.sourceId === 'done-L1')).toBe(true);

    const empty = createSpec({ paths: project.paths, code: 'empty-L1', level: 'L1', title: 'Empty', topic: 'empty', parentCode: null });
    writeSpec({ ...empty, fm: { ...empty.fm, status: 'confirmed' } });
    expect(inspectProjectIntegrity(project.paths).some(issue => issue.kind === 'stale-confirmed-parent' && issue.sourceId === 'empty-L1')).toBe(false);
  });
});

function writeLegacyTask(specCode: string, taskId: string): void {
  const taskDir = join(project.paths.specsDir, 'auth', 'tasks');
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(join(taskDir, `${specCode}-${taskId}.json`), JSON.stringify({
    id: taskId,
    specCode,
    status: 'completed',
    steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'verify', status: 'succeeded' }],
    created: new Date().toISOString(),
  }), 'utf8');
}

function writeGovernedEvidenceFixture(
  specCode: string,
  opts: { profile?: 'legacy' | 'governed'; coversAc: string[] },
): void {
  const topic = specCode.split('-L3')[0];
  const l1Code = `${topic}-L1`;
  const l2Code = `${topic}-L2.1`;
  const l1 = createSpec({ paths: project.paths, code: l1Code, level: 'L1', title: 'Evidence L1', topic, parentCode: null });
  writeSpec({ ...l1, fm: { ...l1.fm, status: 'confirmed' } });
  const l2 = createSpec({ paths: project.paths, code: l2Code, level: 'L2', title: 'Evidence L2', topic, parentCode: l1Code });
  writeSpec({ ...l2, fm: { ...l2.fm, status: 'confirmed' } });
  const spec = createSpec({ paths: project.paths, code: specCode, level: 'L3', title: 'Evidence', topic, parentCode: l2Code });
  writeSpec({
    ...spec,
    fm: { ...spec.fm, status: 'implemented', aiSummary: 'evidence fixture' },
    content: `# Evidence

## 目标
\`src/core/integrity.ts\`

## 实施步骤
steps

## 验收标准
1. **AC-1**: critical behavior

## 关键验收标准
- AC-1

## 验证命令
\`\`\`bash
npm test
\`\`\`
`,
  });
  const taskDir = join(project.paths.specsDir, topic, 'tasks');
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(join(taskDir, `${specCode}-T-001.json`), JSON.stringify({
    id: 'T-001',
    specCode,
    status: 'completed',
    steps: [{ stepNo: 1, stepType: 'mcp_tool', name: 'verify', status: 'succeeded' }],
    verifications: [{
      id: 'V-001',
      command: 'npm test',
      exitCode: 0,
      summary: 'passed',
      artifacts: [],
      coversAc: opts.coversAc,
      created: new Date().toISOString(),
      layer: 'functional',
    }],
    autoConfirm: false,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    created: new Date().toISOString(),
    waitReason: null,
    errorCode: null,
    errorMessage: null,
    lastFailedOutput: null,
    profile: opts.profile ?? 'governed',
    profileSource: opts.profile === 'legacy' ? 'legacy' : 'project-default',
    profileOverrideReason: null,
  }, null, 2), 'utf8');
}
