import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, generateSpecCode, updateSpec } from '../../core/spec-io.js';
import { createTask, type TaskRecord } from '../../core/task.js';
import { writeAdaptiveWorkflowConfig } from '../../core/workflow-profile.js';

let project: TestProject;
let oldRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-profile-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw new Error(`process.exit:${code}`);
  }) as never);
});

afterEach(() => {
  if (oldRoot === undefined) delete process.env.SPEC_MANAGER_ROOT;
  else process.env.SPEC_MANAGER_ROOT = oldRoot;
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  project.cleanup();
});

describe('project profile recommend CLI', () => {
  it('prints text recommendation with legacy compatibility note', async () => {
    await program().parseAsync(['project', 'profile', 'recommend', '--request', 'Add CLI tests'], { from: 'user' });

    expect(output()).toContain('Recommended Profile: standard');
    expect(output()).toContain('Adaptive Workflow:');
    expect(output()).toContain('legacy completion semantics');
    expect(output()).toContain('Risk Factors:');
    expect(output()).toContain('Override:');
    expect(readFileSync(project.paths.configFile, 'utf8')).toBe('project_name: test\n');
  });

  it('prints governed recommendation as json for high-risk request', async () => {
    await program().parseAsync([
      'project', 'profile', 'recommend',
      '--request', 'Change auth token permission checks',
      '--files', 'src/core/task-completion.ts, docs/methodology.md',
      '--json',
    ], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.schemaVersion).toBe('profile-recommendation.experimental.v1');
    expect(parsed.recommendedProfile).toBe('governed');
    expect(parsed.riskFactors.some((factor: { id: string }) => factor.id === 'workflow_core')).toBe(true);
  });

  it('prints quick recommendation for low-risk text work', async () => {
    await program().parseAsync([
      'project', 'profile', 'recommend',
      '--request', 'Fix typo in docs copy',
      '--files', 'README.md',
    ], { from: 'user' });

    expect(output()).toContain('Recommended Profile: quick');
    expect(output()).toContain('Quick is limited');
  });

  it('maps empty request errors to exit code 2', async () => {
    await expect(program().parseAsync(['project', 'profile', 'recommend', '--request', '   '], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('PROFILE_RECOMMENDATION_REQUEST_REQUIRED');
  });
});

describe('project profile metrics CLI', () => {
  it('prints text metrics with legacy compatibility note without writing config', async () => {
    const specCode = createFrozenL3('cli-metrics-legacy');
    createTask({ paths: project.paths, specCode, planJson: planFor(specCode), autoConfirm: false });

    await program().parseAsync(['project', 'profile', 'metrics'], { from: 'user' });

    expect(output()).toContain('Profile Metrics:');
    expect(output()).toContain('schemaVersion: profile-metrics.experimental.v1');
    expect(output()).toContain('legacy completion semantics');
    expect(output()).toContain('- legacy: tasks=1');
    expect(readFileSync(project.paths.configFile, 'utf8')).toBe('project_name: test\n');
  });

  it('prints json metrics filtered by topic with explicit overrides', async () => {
    writeAdaptiveWorkflowConfig(project.paths, { enabled: true, defaultProfile: 'standard' });
    const includedSpec = createFrozenL3('cli-metrics-included');
    const { task } = createTask({
      paths: project.paths,
      specCode: includedSpec,
      planJson: planFor(includedSpec),
      autoConfirm: false,
      profile: 'governed',
      profileOverrideReason: 'release risk',
    });
    writeTask({ ...task, status: 'completed', finishedAt: '2026-06-16T00:00:00.000Z' });
    const excludedSpec = createFrozenL3('cli-metrics-excluded');
    createTask({ paths: project.paths, specCode: excludedSpec, planJson: planFor(excludedSpec), autoConfirm: false });

    await program().parseAsync([
      'project', 'profile', 'metrics',
      '--topic', 'cli-metrics-included',
      '--json',
    ], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.schemaVersion).toBe('profile-metrics.experimental.v1');
    expect(parsed.topic).toBe('cli-metrics-included');
    expect(parsed.totals.tasks).toBe(1);
    expect(parsed.byProfile.governed.completed).toBe(1);
    expect(parsed.overrides).toEqual([{
      specCode: includedSpec,
      taskId: task.id,
      profile: 'governed',
      profileSource: 'explicit',
      reason: 'release risk',
    }]);
    expect(parsed.evidence.governed.completedWithGaps).toEqual([{
      specCode: includedSpec,
      taskId: task.id,
      missing: ['AC-1', 'AC-2'],
    }]);
  });

  it('maps invalid topic errors to exit code 2', async () => {
    await expect(program().parseAsync(['project', 'profile', 'metrics', '--topic', '../bad'], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('INVALID_PROFILE_METRICS_TOPIC');
  });
});

function program(): Command {
  const command = new Command();
  command.exitOverride();
  registerProject(command);
  return command;
}

function output(): string {
  return logSpy.mock.calls.map(call => String(call[0])).join('\n');
}

function stderr(): string {
  return errorSpy.mock.calls.map(call => String(call[0])).join('\n');
}

function planFor(specCode: string) {
  return {
    coveredSpecs: [specCode],
    steps: [{ stepNo: 1, stepType: 'mcp_tool' as const, name: 'run verify test' }],
  };
}

function createFrozenL3(topic: string): string {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths: project.paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(project.paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths: project.paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(project.paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths: project.paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(project.paths, l3Code, { content: specContent(), aiSummary: 'Profile metrics CLI fixture' });
  updateSpec(project.paths, l3Code, { status: 'frozen' });
  return l3Code;
}

function specContent(): string {
  return `# Metrics CLI L3

## 目标

Test profile metrics CLI.

## 实施步骤

- Implement.

## 验收标准

1. **AC-1**: first critical behavior
2. **AC-2**: second critical behavior

## 关键验收标准

- AC-1
- AC-2

## 验证命令

\`\`\`bash
npm test
\`\`\`

## planJson (final)

\`\`\`json
{"coveredSpecs":["x"],"steps":[{"stepNo":1,"stepType":"mcp_tool","name":"验证 test"}]}
\`\`\`

## 回滚方案

Rollback.
`;
}

function taskPath(specCode: string, taskId: string): string {
  const topic = specCode.split('-L')[0];
  return join(project.paths.specsDir, topic, 'tasks', `${specCode}-${taskId}.json`);
}

function writeTask(task: TaskRecord): void {
  writeFileSync(taskPath(task.specCode, task.id), JSON.stringify(task, null, 2), 'utf8');
}
