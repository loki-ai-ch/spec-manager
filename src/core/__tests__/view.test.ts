import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask, reportStep, startTask } from '../task.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { buildViewModel } from '../view.js';
import { createTestProject, type TestProject } from './project-fixture.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-view-');
});

afterEach(() => {
  project.cleanup();
});

function createAuthSpecs(): { l1: string; l2: string; l3: string } {
  const l1 = 'auth-L1';
  const l2 = 'auth-L2.1';
  const l3 = 'auth-L3.1.1-login';
  createSpec({ paths: project.paths, code: l1, level: 'L1', title: 'Auth PRD', topic: 'auth', parentCode: null });
  updateSpec(project.paths, l1, {
    status: 'confirmed',
    content: '# Auth PRD\n\n## 目标\n\nAuth work\n',
    aiSummary: 'auth summary',
  });
  createSpec({ paths: project.paths, code: l2, level: 'L2', title: 'Auth Design', topic: 'auth', parentCode: l1 });
  updateSpec(project.paths, l2, {
    status: 'confirmed',
    content: '# Auth Design\n\n## 方案概述\n\nAuth design\n',
    aiSummary: 'design summary',
  });
  createSpec({ paths: project.paths, code: l3, level: 'L3', title: 'Login Impl', topic: 'auth', parentCode: l2 });
  updateSpec(project.paths, l3, {
    status: 'confirmed',
    content: '# Login Impl\n\n## 目标\n\nLogin implementation\n',
    aiSummary: 'login summary',
  });
  updateSpec(project.paths, l3, { status: 'frozen' });
  return { l1, l2, l3 };
}

function createBillingSpec(): void {
  createSpec({
    paths: project.paths,
    code: 'billing-L1',
    level: 'L1',
    title: 'Billing PRD',
    topic: 'billing',
    parentCode: null,
  });
  updateSpec(project.paths, 'billing-L1', {
    content: '# Billing PRD\n\n## 目标\n\nBilling work\n',
    aiSummary: 'billing summary',
  });
}

describe('buildViewModel', () => {
  it('returns topic, spec, task summaries and next action', () => {
    const { l3 } = createAuthSpecs();
    createBillingSpec();
    const planJson = {
      coveredSpecs: [l3],
      steps: [
        { stepNo: 1, stepType: 'tool_action' as const, name: 'inspect source files' },
        { stepNo: 2, stepType: 'tool_action' as const, name: 'run verify test' },
      ],
    };
    const { task } = createTask({ paths: project.paths, specCode: l3, autoConfirm: false, planJson });
    startTask(project.paths, task.id, l3);
    reportStep({
      paths: project.paths,
      specCode: l3,
      taskId: task.id,
      stepNo: 1,
      status: 'succeeded',
      outputJson: '{"summary":"ok"}',
    });

    const model = buildViewModel(project.paths);
    const auth = model.topics.find((topic) => topic.topic === 'auth');

    expect(model.topics.map((topic) => topic.topic)).toEqual(['auth', 'billing']);
    expect(auth?.specCount).toBe(3);
    expect(auth?.taskCount).toBe(1);
    expect(auth?.nextAction).toContain('spec-manager task step');
    expect(auth?.specs.find((spec) => spec.code === l3)).toMatchObject({
      level: 'L3',
      status: 'frozen',
      title: 'Login Impl',
      parentCode: 'auth-L2.1',
      aiSummary: 'login summary',
    });
    expect(auth?.tasks[0]).toMatchObject({
      id: task.id,
      specCode: l3,
      status: 'running',
      totalSteps: 2,
      succeededSteps: 1,
    });
  });

  it('filters by topic', () => {
    createAuthSpecs();
    createBillingSpec();

    const model = buildViewModel(project.paths, { topic: 'billing' });

    expect(model.topics).toHaveLength(1);
    expect(model.topics[0].topic).toBe('billing');
    expect(model.topics[0].specs.map((spec) => spec.code)).toEqual(['billing-L1']);
  });

  it('throws for an unknown topic', () => {
    expect(() => buildViewModel(project.paths, { topic: 'missing' })).toThrow('TOPIC_NOT_FOUND: missing');
  });
});
