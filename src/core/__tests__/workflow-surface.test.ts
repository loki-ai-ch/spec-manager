import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPaths } from '../paths.js';
import { createSpec, updateSpec } from '../spec-io.js';
import { createTask, startTask } from '../task.js';
import {
  buildWorkflowDashboardProjection,
  buildWorkflowNextProjection,
} from '../workflow-surface.js';
import { createTestProject, type TestProject } from './project-fixture.js';

let project: TestProject;

beforeEach(() => {
  project = createTestProject('spec-mgr-workflow-surface-');
  initProjectFiles();
});

afterEach(() => {
  project.cleanup();
});

describe('buildWorkflowNextProjection', () => {
  it('returns not_initialized and init action for an uninitialized project', () => {
    const uninitialized = createTestProject('spec-mgr-workflow-surface-empty-', { initialized: false });
    try {
      const projection = buildWorkflowNextProjection(uninitialized.paths, { request: 'add auth' });

      expect(projection.initialized).toBe(false);
      expect(projection.status).toBe('not_initialized');
      expect(projection.nextAction).toBe('spec-manager project init --name <project-name>');
      expect(projection.projectRoot).toBe(uninitialized.root);
    } finally {
      uninitialized.cleanup();
    }
  });

  it('returns needs_l1 for an initialized topic without specs', () => {
    const projection = buildWorkflowNextProjection(project.paths, { topic: 'auth' });

    expect(projection.executionRoot).toBe(project.root);
    expect(projection.writeRoot).toBe(project.root);
    expect(projection.writeStore).toMatchObject({ id: 'local', mode: 'write', initialized: true });
    expect(projection.contextSources).toEqual([]);
    expect(projection.storeDiagnostics).toEqual([]);
    expect(projection.status).toBe('needs_l1');
    expect(projection.topic).toBe('auth');
    expect(projection.nextAction).toBe('spec-manager spec new L1 --topic auth --title "..."');
    expect(projection.suggestedCommands).toContain('spec-manager flow status --topic auth');
  });

  it('returns needs_spec_update for a draft placeholder spec', () => {
    createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });

    const projection = buildWorkflowNextProjection(project.paths, { topic: 'auth' });

    expect(projection.status).toBe('needs_spec_update');
    expect(projection.blockingReason).toContain('auth-L1');
    expect(projection.nextAction).toContain('spec-manager spec update auth-L1');
  });

  it('returns needs_user_approval for a draft non-placeholder spec', () => {
    createSpec({ paths: project.paths, code: 'docs-L1', level: 'L1', title: 'Docs', topic: 'docs', parentCode: null });
    updateSpec(project.paths, 'docs-L1', { content: completeL1Content(), aiSummary: 'docs' });

    const projection = buildWorkflowNextProjection(project.paths, { topic: 'docs' });

    expect(projection.status).toBe('needs_user_approval');
    expect(projection.blockingReason).toContain('docs-L1');
    expect(projection.nextAction).toContain('spec-manager spec confirm docs-L1');
  });

  it('returns ready_for_task for a frozen implementation spec without active task', () => {
    const l3 = createFrozenHierarchy('billing');

    const projection = buildWorkflowNextProjection(project.paths, { topic: 'billing' });

    expect(projection.status).toBe('ready_for_task');
    expect(projection.blockingReason).toContain('no active task');
    expect(projection.nextAction).toContain(`spec-manager task create ${l3}`);
  });

  it('returns task_running for a running task', () => {
    const l3 = createFrozenHierarchy('search');
    const { task } = createTask({
      paths: project.paths,
      specCode: l3,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [l3],
        steps: [
          { stepNo: 1, stepType: 'tool_action', name: 'inspect source files' },
          { stepNo: 2, stepType: 'tool_action', name: '验证 npm test' },
        ],
      },
    });
    startTask(project.paths, task.id, l3);

    const projection = buildWorkflowNextProjection(project.paths, { topic: 'search' });

    expect(projection.status).toBe('task_running');
    expect(projection.blockingReason).toBe('Task is running');
    expect(projection.nextAction).toContain(`spec-manager task step ${task.id}`);
  });

  it('includes external write root and context sources from spec store config', () => {
    const writeRoot = createInitializedSibling('product-specs');
    const contextRoot = createInitializedSibling('platform-specs');
    writeFileSync(project.paths.configFile, [
      'project_name: test',
      'specStore:',
      '  id: product-planning',
      '  path: ../product-specs',
      'contextSources:',
      '  - id: platform-specs',
      '    path: ../platform-specs',
      '',
    ].join('\n'), 'utf8');

    const projection = buildWorkflowNextProjection(project.paths, { topic: 'auth' });

    expect(projection.executionRoot).toBe(project.root);
    expect(projection.writeRoot).toBe(writeRoot);
    expect(projection.writeStore).toMatchObject({ id: 'product-planning', path: writeRoot, mode: 'write' });
    expect(projection.contextSources).toEqual([
      expect.objectContaining({ id: 'platform-specs', path: contextRoot, mode: 'read' }),
    ]);
    expect(projection.storeDiagnostics).toEqual([]);
  });

  it('derives next action from specs in the external write root', () => {
    const writeRoot = createInitializedSibling('product-specs');
    const writePaths = getPaths(writeRoot);
    writeFileSync(project.paths.configFile, [
      'project_name: test',
      'specStore:',
      '  id: product-planning',
      '  path: ../product-specs',
      '',
    ].join('\n'), 'utf8');
    createSpec({ paths: writePaths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
    updateSpec(writePaths, 'auth-L1', { content: completeL1Content(), aiSummary: 'auth' });

    const projection = buildWorkflowNextProjection(project.paths, { topic: 'auth' });

    expect(projection.executionRoot).toBe(project.root);
    expect(projection.writeRoot).toBe(writeRoot);
    expect(projection.status).toBe('needs_user_approval');
    expect(projection.nextAction).toContain('spec-manager spec confirm auth-L1');
  });
});

describe('buildWorkflowDashboardProjection', () => {
  it('summarizes topics, draft specs, active tasks and warnings', () => {
    createSpec({ paths: project.paths, code: 'docs-L1', level: 'L1', title: 'Docs', topic: 'docs', parentCode: null });
    const l3 = createFrozenHierarchy('auth');
    const { task } = createTask({
      paths: project.paths,
      specCode: l3,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [l3],
        steps: [
          { stepNo: 1, stepType: 'tool_action', name: 'inspect source files' },
          { stepNo: 2, stepType: 'tool_action', name: '验证 npm test' },
        ],
      },
    });
    startTask(project.paths, task.id, l3);

    const dashboard = buildWorkflowDashboardProjection(project.paths);
    const auth = dashboard.topics.find((topic) => topic.topic === 'auth');
    const docs = dashboard.topics.find((topic) => topic.topic === 'docs');

    expect(dashboard.initialized).toBe(true);
    expect(dashboard.executionRoot).toBe(project.root);
    expect(dashboard.writeRoot).toBe(project.root);
    expect(dashboard.writeStore).toMatchObject({ id: 'local', mode: 'write' });
    expect(dashboard.storeDiagnostics).toEqual([]);
    expect(dashboard.topics.map((topic) => topic.topic)).toEqual(['auth', 'docs']);
    expect(dashboard.activeTaskCount).toBe(1);
    expect(dashboard.draftSpecCount).toBe(1);
    expect(dashboard.warningCount).toBeGreaterThanOrEqual(1);
    expect(dashboard.warnings.some((warning) => warning.includes('AI agent instructions'))).toBe(true);
    expect(auth).toMatchObject({ specCount: 3, taskCount: 1, activeTaskCount: 1, draftSpecCount: 0 });
    expect(docs).toMatchObject({ specCount: 1, taskCount: 0, activeTaskCount: 0, draftSpecCount: 1 });
  });

  it('summarizes topics and tasks from the external write root', () => {
    const writeRoot = createInitializedSibling('product-specs');
    const writePaths = getPaths(writeRoot);
    writeFileSync(project.paths.configFile, [
      'project_name: test',
      'specStore:',
      '  id: product-planning',
      '  path: ../product-specs',
      '',
    ].join('\n'), 'utf8');
    const l3 = createFrozenHierarchy('auth', writePaths);
    const { task } = createTask({
      paths: writePaths,
      specCode: l3,
      autoConfirm: false,
      planJson: {
        coveredSpecs: [l3],
        steps: [{ stepNo: 1, stepType: 'tool_action', name: '验证 external task projection' }],
      },
    });
    startTask(writePaths, task.id, l3);

    const dashboard = buildWorkflowDashboardProjection(project.paths);

    expect(dashboard.executionRoot).toBe(project.root);
    expect(dashboard.writeRoot).toBe(writeRoot);
    expect(dashboard.topics).toHaveLength(1);
    expect(dashboard.topics[0]).toMatchObject({ topic: 'auth', specCount: 3, taskCount: 1, activeTaskCount: 1 });
  });
});

function createInitializedSibling(name: string): string {
  const root = resolve(project.root, '..', name);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, '.spec-manager'), { recursive: true });
  return root;
}

function initProjectFiles(): void {
  mkdirSync(project.paths.specsDir, { recursive: true });
  mkdirSync(project.paths.changesDir, { recursive: true });
  mkdirSync(project.paths.archiveDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
}

function createFrozenHierarchy(topic: string, paths = project.paths): string {
  const l1 = `${topic}-L1`;
  const l2 = `${topic}-L2.1`;
  const l3 = `${topic}-L3.1.1`;
  createSpec({ paths, code: l1, level: 'L1', title: `${topic} PRD`, topic, parentCode: null });
  updateSpec(paths, l1, { content: completeL1Content(), aiSummary: `${topic} prd`, status: 'confirmed' });
  createSpec({ paths, code: l2, level: 'L2', title: `${topic} design`, topic, parentCode: l1 });
  updateSpec(paths, l2, { content: completeL2Content(), aiSummary: `${topic} design`, status: 'confirmed' });
  createSpec({ paths, code: l3, level: 'L3', title: `${topic} impl`, topic, parentCode: l2 });
  updateSpec(paths, l3, { content: completeL3Content(), aiSummary: `${topic} impl`, status: 'frozen' });
  return l3;
}

function completeL1Content(): string {
  return `# Complete L1

## 背景
Document a complete PRD.

## 用户故事
As a maintainer, I want a valid spec.

## 验收标准
1. **AC-1**: Given a valid spec, When validation runs, Then it SHALL pass.

## 范围边界
Only test fixture content.
`;
}

function completeL2Content(): string {
  return `# Complete L2

## 背景
Document a complete design.

## 方案概述
Use existing test helpers.

## 技术决策
Keep fixtures local.

## 受影响模块
Test modules only.

## 接口契约
No runtime contract.

## L3 裂变计划
One implementation spec.
`;
}

function completeL3Content(): string {
  return `# Complete L3

## 背景
Document a complete implementation spec.

## 目标
Cover workflow projection behavior.

## 涉及文件
src/core/workflow-surface.ts

## 实施步骤
1. Implement projection.

## 验收标准
1. **AC-1**: Given projection inputs, When it runs, Then it SHALL return stable status.

## 验证命令
npm test -- src/core/__tests__/workflow-surface.test.ts
`;
}
