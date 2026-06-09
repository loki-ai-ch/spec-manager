import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, writeSpec } from '../spec-io.js';
import { inspectProjectIntegrity } from '../integrity.js';
import { writeIntegrityExemptions } from '../integrity-exemptions.js';

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
