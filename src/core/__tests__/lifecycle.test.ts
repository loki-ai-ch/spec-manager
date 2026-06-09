import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProject, type TestProject } from './project-fixture.js';
import { assessImplementationReadiness, cascadeImplementedHierarchy } from '../lifecycle.js';
import { createSpec, findSpecByCode, updateSpec, writeSpec } from '../spec-io.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-lifecycle-');
});

afterEach(() => {
  project.cleanup();
});

describe('implementation lifecycle', () => {
  it('requires task-complete authority and frozen status for L3', () => {
    const { l3 } = hierarchy();
    expect(assessImplementationReadiness(project.paths, l3, 'project-reconcile').blockers).toContain('authority-not-allowed');
    expect(assessImplementationReadiness(project.paths, l3, 'task-complete').blockers).toContain('wrong-status');
    updateSpec(project.paths, l3, { status: 'frozen' });
    expect(assessImplementationReadiness(project.paths, l3, 'task-complete').ready).toBe(true);
  });

  it('requires confirmed L1/L2 with at least one implemented direct child', () => {
    const { l1, l2, l3 } = hierarchy();
    expect(assessImplementationReadiness(project.paths, l1, 'project-reconcile').blockers).toContain('children-incomplete');
    expect(assessImplementationReadiness(project.paths, l2, 'project-reconcile').blockers).toContain('children-incomplete');
    writeImplemented(l3);
    expect(assessImplementationReadiness(project.paths, l2, 'project-reconcile').ready).toBe(true);
    expect(assessImplementationReadiness(project.paths, l1, 'project-reconcile').blockers).toContain('children-incomplete');
  });

  it('rejects confirmed parents without children and ordinary confirmed-to-implemented updates', () => {
    createSpec({ paths: project.paths, code: 'empty-L1', level: 'L1', title: 'Empty', topic: 'empty', parentCode: null });
    updateSpec(project.paths, 'empty-L1', { status: 'confirmed' });
    expect(assessImplementationReadiness(project.paths, 'empty-L1', 'project-reconcile').blockers).toContain('no-children');
    expect(() => updateSpec(project.paths, 'empty-L1', { status: 'implemented' })).toThrow('状态非法');
  });

  it('cascades frozen L3 through confirmed L2 and L1', () => {
    const { l1, l2, l3 } = hierarchy();
    updateSpec(project.paths, l3, { status: 'frozen' });
    const result = cascadeImplementedHierarchy({
      paths: project.paths,
      startSpecCode: l3,
      authority: 'task-complete',
    });
    expect(result.cascadedSpecs.map(item => item.code)).toEqual([l3, l2, l1]);
    expect(findSpecByCode(project.paths, l1)?.fm.status).toBe('implemented');
    expect(findSpecByCode(project.paths, l2)?.fm.status).toBe('implemented');
  });
});

function hierarchy(): { l1: string; l2: string; l3: string } {
  const l1 = 'auth-L1';
  const l2 = 'auth-L2.1';
  const l3 = 'auth-L3.1.1';
  createSpec({ paths: project.paths, code: l1, level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, l1, { status: 'confirmed' });
  createSpec({ paths: project.paths, code: l2, level: 'L2', title: 'Design', topic: 'auth', parentCode: l1 });
  updateSpec(project.paths, l2, { status: 'confirmed' });
  createSpec({ paths: project.paths, code: l3, level: 'L3', title: 'Impl', topic: 'auth', parentCode: l2 });
  return { l1, l2, l3 };
}

function writeImplemented(code: string): void {
  const spec = findSpecByCode(project.paths, code);
  if (!spec) throw new Error(`missing test spec ${code}`);
  writeSpec({ ...spec, fm: { ...spec.fm, status: 'implemented' } });
}
