import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, type TestProject } from './project-fixture.js';
import { createSpec, findSpecByCode, updateSpec, writeSpec } from '../spec-io.js';
import {
  applyLifecycleReconciliation,
  LIFECYCLE_RECONCILIATION_DECISIONS,
  LIFECYCLE_RECONCILIATION_TARGETS,
  planLifecycleReconciliation,
} from '../reconciliation.js';
import { listDecisions } from '../decision.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-reconcile-');
  seedFixedTargets();
});

afterEach(() => {
  project.cleanup();
});

describe('lifecycle reconciliation', () => {
  it('plans six implementations and three decisions without writing', () => {
    const before = targetBytes();
    const plan = planLifecycleReconciliation(project.paths);
    expect(plan.implementationActions.filter(item => item.action === 'implement')).toHaveLength(6);
    expect(plan.decisionActions.filter(item => item.action === 'create')).toHaveLength(3);
    expect(plan.conflicts).toEqual([]);
    expect(targetBytes()).toEqual(before);
  });

  it('applies idempotently and never changes completed task bytes', () => {
    const beforeTask = readFileSync(taskFile(), 'utf8');
    const first = applyLifecycleReconciliation(project.paths);
    expect(first.implementationActions.filter(item => item.action === 'implement')).toHaveLength(6);
    expect(LIFECYCLE_RECONCILIATION_TARGETS.every(code => findSpecByCode(project.paths, code)?.fm.status === 'implemented')).toBe(true);
    expect(listDecisions(project.paths, { includeAll: true })).toHaveLength(3);
    expect(readFileSync(taskFile(), 'utf8')).toBe(beforeTask);
    const second = applyLifecycleReconciliation(project.paths);
    expect([...second.implementationActions, ...second.decisionActions].every(item => item.action === 'skip')).toBe(true);
  });

  it('blocks ready targets outside the fixed scope', () => {
    createSpec({ paths: project.paths, code: 'outside-L1', level: 'L1', title: 'Outside', topic: 'outside', parentCode: null });
    updateSpec(project.paths, 'outside-L1', { status: 'confirmed' });
    const child = createSpec({ paths: project.paths, code: 'outside-L2.1', level: 'L2', title: 'Outside design', topic: 'outside', parentCode: 'outside-L1' });
    writeSpec({ ...child, fm: { ...child.fm, status: 'implemented' } });
    const plan = planLifecycleReconciliation(project.paths);
    expect(plan.conflicts.some(conflict => conflict.target === 'outside-L1')).toBe(true);
    expect(() => applyLifecycleReconciliation(project.paths)).toThrow('RECONCILIATION_CONFLICT');
  });
});

function seedFixedTargets(): void {
  for (const decision of LIFECYCLE_RECONCILIATION_DECISIONS) {
    const l1 = createSpec({ paths: project.paths, code: decision.docCode, level: 'L1', title: decision.docCode, topic: decision.topic, parentCode: null });
    writeSpec({ ...l1, fm: { ...l1.fm, status: 'confirmed' } });
    const l2Code = `${decision.topic}-L2.1`;
    const l2 = createSpec({ paths: project.paths, code: l2Code, level: 'L2', title: l2Code, topic: decision.topic, parentCode: decision.docCode });
    writeSpec({ ...l2, fm: { ...l2.fm, status: 'confirmed' } });
    const l3 = createSpec({ paths: project.paths, code: `${decision.topic}-L3.1.1`, level: 'L3', title: 'Impl', topic: decision.topic, parentCode: l2Code });
    writeSpec({ ...l3, fm: { ...l3.fm, status: 'implemented' } });
  }
  mkdirSync(join(project.paths.specsDir, 'architecture-hardening', 'tasks'), { recursive: true });
  writeFileSync(taskFile(), JSON.stringify({ id: 'T-001', specCode: 'architecture-hardening-L3.1.1', status: 'completed' }), 'utf8');
}

function taskFile(): string {
  return join(project.paths.specsDir, 'architecture-hardening', 'tasks', 'legacy.json');
}

function targetBytes(): Record<string, string> {
  return Object.fromEntries(LIFECYCLE_RECONCILIATION_TARGETS.map(code => {
    const spec = findSpecByCode(project.paths, code);
    if (!spec) throw new Error(`missing target ${code}`);
    return [code, readFileSync(spec.filePath, 'utf8')];
  }));
}
