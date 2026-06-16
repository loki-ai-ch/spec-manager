import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSpec, updateSpec } from '../spec-io.js';
import { createTask } from '../task.js';
import { createDecision } from '../decision.js';
import { createTaskLinkedChangeProposal } from '../delta.js';
import { inspectProjectIntegrity } from '../integrity.js';
import { assessImplementationReadiness } from '../lifecycle.js';
import { getFlowStatus } from '../usability.js';
import { buildViewModel } from '../view.js';
import { buildProjectSnapshot, taskKey } from '../project-snapshot.js';
import { createTestProject, type TestProject } from './project-fixture.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-snapshot-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
});

afterEach(() => {
  project.cleanup();
});

function createAuthGraph(): { l1: string; l2: string; l3: string; taskId: string; decisionId: string; changeName: string } {
  const l1 = 'auth-L1';
  const l2 = 'auth-L2.1';
  const l3 = 'auth-L3.1.1-login';
  createSpec({ paths: project.paths, code: l1, level: 'L1', title: 'Auth PRD', topic: 'auth', parentCode: null });
  updateSpec(project.paths, l1, { status: 'confirmed', content: '# Auth\n', aiSummary: 'auth' });
  const decision = createDecision({
    paths: project.paths,
    docCode: l1,
    topic: 'auth',
    what: 'Use ProjectSnapshot',
    why: 'Keep read paths consistent',
  });
  createSpec({ paths: project.paths, code: l2, level: 'L2', title: 'Auth Design', topic: 'auth', parentCode: l1 });
  updateSpec(project.paths, l2, { status: 'confirmed', content: '# Auth Design\n', aiSummary: 'design' });
  createSpec({ paths: project.paths, code: l3, level: 'L3', title: 'Login', topic: 'auth', parentCode: l2 });
  updateSpec(project.paths, l3, { status: 'frozen', content: '# Login\n', aiSummary: 'login' });
  const { task } = createTask({
    paths: project.paths,
    specCode: l3,
    autoConfirm: false,
    planJson: {
      coveredSpecs: [l3],
      steps: [{ stepNo: 1, stepType: 'tool_action', name: 'run snapshot test' }],
    },
  });
  const change = createTaskLinkedChangeProposal({
    paths: project.paths,
    specCode: l3,
    taskCode: task.id,
    reason: 'snapshot follow-up',
    impact: 'read model',
  });
  return { l1, l2, l3, taskId: task.id, decisionId: decision.id, changeName: change.name };
}

function createBillingSpec(): void {
  createSpec({ paths: project.paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
  updateSpec(project.paths, 'billing-L1', { content: '# Billing\n', aiSummary: 'billing' });
}

describe('buildProjectSnapshot', () => {
  it('builds read collections and common indexes', () => {
    const fixture = createAuthGraph();

    const snapshot = buildProjectSnapshot(project.paths);

    expect(snapshot.indexes.specByCode.get(fixture.l3)?.fm.title).toBe('Login');
    expect(snapshot.indexes.childrenByParent.get(fixture.l1)?.map(spec => spec.fm.code)).toEqual([fixture.l2]);
    expect(snapshot.indexes.tasksBySpec.get(fixture.l3)?.map(task => task.id)).toEqual([fixture.taskId]);
    expect(snapshot.indexes.taskByKey.get(taskKey(fixture.l3, fixture.taskId))?.specCode).toBe(fixture.l3);
    expect(snapshot.indexes.decisionsByDocCode.get(fixture.l1)?.map(decision => decision.id)).toEqual([fixture.decisionId]);
    expect(snapshot.indexes.decisionById.get(fixture.decisionId)?.fm.docCode).toBe(fixture.l1);
    expect(snapshot.indexes.changesByTaskKey.get(taskKey(fixture.l3, fixture.taskId))?.map(change => change.name)).toEqual([fixture.changeName]);
  });

  it('filters collections by topic', () => {
    createAuthGraph();
    createBillingSpec();

    const snapshot = buildProjectSnapshot(project.paths, { topic: 'billing' });

    expect(snapshot.specs.map(spec => spec.fm.code)).toEqual(['billing-L1']);
    expect(snapshot.tasks).toEqual([]);
    expect(snapshot.decisions).toEqual([]);
    expect(snapshot.changes).toEqual([]);
    expect([...snapshot.indexes.specByCode.keys()]).toEqual(['billing-L1']);
  });

  it('keeps omitted include collections and indexes empty', () => {
    createAuthGraph();

    const snapshot = buildProjectSnapshot(project.paths, { include: ['specs'] });

    expect(snapshot.specs.length).toBeGreaterThan(0);
    expect(snapshot.tasks).toEqual([]);
    expect(snapshot.decisions).toEqual([]);
    expect(snapshot.incidents).toEqual([]);
    expect(snapshot.changes).toEqual([]);
    expect(snapshot.indexes.tasksBySpec.size).toBe(0);
    expect(snapshot.indexes.decisionById.size).toBe(0);
    expect(snapshot.indexes.changesByTaskKey.size).toBe(0);
  });

  it('exposes the include and topic scope used to build the snapshot', () => {
    createAuthGraph();

    const snapshot = buildProjectSnapshot(project.paths, { include: ['specs', 'tasks'], topic: 'auth' });

    expect(snapshot.scope).toEqual({
      include: ['specs', 'tasks'],
      topic: 'auth',
    });
  });
});

describe('ProjectSnapshot consumers', () => {
  it('keeps integrity, flow, view and readiness outputs compatible', () => {
    const fixture = createAuthGraph();

    expect(inspectProjectIntegrity(project.paths)).toEqual([]);
    expect(getFlowStatus(project.paths, { topic: 'auth' })[0].nextAction).toContain('task start');
    expect(buildViewModel(project.paths, { topic: 'auth' }).topics[0]).toMatchObject({
      topic: 'auth',
      specCount: 3,
      taskCount: 1,
    });
    expect(assessImplementationReadiness(project.paths, fixture.l3, 'task-complete')).toMatchObject({
      ready: true,
      blockers: [],
    });
  });

  it('rebuilds a full snapshot before running integrity checks', () => {
    const fixture = createAuthGraph();
    createBillingSpec();
    updateSpec(project.paths, 'billing-L1', { addRelation: { type: 'references', target: fixture.l1 } });
    const topicSnapshot = buildProjectSnapshot(project.paths, { topic: 'billing' });
    const specsOnlySnapshot = buildProjectSnapshot(project.paths, { include: ['specs'] });

    expect(inspectProjectIntegrity(project.paths, { snapshot: topicSnapshot })).toEqual([]);
    expect(inspectProjectIntegrity(project.paths, { snapshot: specsOnlySnapshot })).toEqual([]);
  });

  it('rebuilds snapshots that do not cover readiness and flow requests', () => {
    const fixture = createAuthGraph();
    createBillingSpec();
    const billingSnapshot = buildProjectSnapshot(project.paths, { topic: 'billing' });
    const specsOnlySnapshot = buildProjectSnapshot(project.paths, { include: ['specs'], topic: 'auth' });

    expect(assessImplementationReadiness(project.paths, fixture.l3, 'task-complete', billingSnapshot)).toMatchObject({
      ready: true,
      blockers: [],
    });
    expect(getFlowStatus(project.paths, { topic: 'auth', snapshot: specsOnlySnapshot })[0].nextAction).toContain('task start');
  });
});
