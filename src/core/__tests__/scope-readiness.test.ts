import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { assessScopePlan, buildScopeReadinessReport, setScopePlan } from '../scope-readiness.js';
import { assessImplementationReadiness } from '../lifecycle.js';

let project: TestProject;
beforeEach(() => { project = createTestProject('spec-mgr-scope-'); });
afterEach(() => project.cleanup());

describe('scope readiness', () => {
  it('blocks open scope', () => {
    createConfirmedL1();
    setScopePlan(project.paths, 'auth-L1', { mode: 'open', plannedChildren: [], leaf: false, reason: 'Still splitting scope.' });
    expect(assessImplementationReadiness(project.paths, 'auth-L1', 'task-complete').blockers).toContain('scope-open');
  });

  it('reports missing planned child', () => {
    createConfirmedL1();
    setScopePlan(project.paths, 'auth-L1', { mode: 'fixed', plannedChildren: [{ code: 'auth-L2.1', title: 'Design', required: true }], leaf: false });
    expect(assessScopePlan(project.paths, 'auth-L1').missingChildren).toEqual(['auth-L2.1']);
  });

  it('keeps legacy behavior', () => {
    createConfirmedL1();
    expect(assessScopePlan(project.paths, 'auth-L1').status).toBe('legacy');
    expect(assessImplementationReadiness(project.paths, 'auth-L1', 'task-complete').blockers).toContain('no-children');
  });

  it('detects observed premature cascade', () => {
    createConfirmedL1();
    setScopePlan(project.paths, 'auth-L1', {
      mode: 'fixed', leaf: false,
      plannedChildren: [
        { code: 'auth-L2.1', title: 'First', required: true },
        { code: 'auth-L2.2', title: 'Second', required: true },
      ],
    });
    createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'First', topic: 'auth', parentCode: 'auth-L1' });
    expect(assessScopePlan(project.paths, 'auth-L1')).toMatchObject({ status: 'blocked', missingChildren: ['auth-L2.2'], incompleteChildren: ['auth-L2.1'] });
    const report = buildScopeReadinessReport(project.paths, 'auth');
    expect(report.summary.blocked).toBe(1);
  });
});

function createConfirmedL1(): void {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
}
