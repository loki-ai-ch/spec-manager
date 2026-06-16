import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, generateSpecCode, updateSpec } from '../../core/spec-io.js';
import { createTask } from '../../core/task.js';

let project: TestProject;
let oldRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-workflow-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\ncontext: |\n  Tech stack: TypeScript\n', 'utf8');
  oldRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  if (oldRoot === undefined) delete process.env.SPEC_MANAGER_ROOT;
  else process.env.SPEC_MANAGER_ROOT = oldRoot;
  logSpy.mockRestore();
  project.cleanup();
});

describe('project workflow CLI', () => {
  it('shows legacy compatibility by default', async () => {
    await program().parseAsync(['project', 'workflow', 'show'], { from: 'user' });

    expect(output()).toContain('enabled: false');
    expect(output()).toContain('legacy compatibility');
  });

  it('enables governed profile and preserves config fields', async () => {
    await program().parseAsync(['project', 'workflow', 'enable', '--default-profile', 'governed'], { from: 'user' });

    expect(output()).toContain('Adaptive workflow enabled');
    expect(output()).toContain('Future tasks will record standard/governed profile snapshots.');
    expect(output()).toContain('Historical tasks are not modified.');
    expect(output()).toContain('Audit adoption with `spec-manager project profile metrics`.');
    const parsed = parseYaml(readFileSync(project.paths.configFile, 'utf8')) as Record<string, unknown>;
    expect(parsed.project_name).toBe('test');
    expect(parsed.context).toBe('Tech stack: TypeScript\n');
    expect(parsed.adaptiveWorkflow).toEqual({ enabled: true, defaultProfile: 'governed' });
  });

  it('disables workflow without removing default profile', async () => {
    await program().parseAsync(['project', 'workflow', 'enable', '--default-profile', 'governed'], { from: 'user' });
    logSpy.mockClear();

    await program().parseAsync(['project', 'workflow', 'disable'], { from: 'user' });

    expect(output()).toContain('Adaptive workflow disabled');
    expect(output()).toContain('Only future task profile resolution changes.');
    expect(output()).toContain('Existing task profile snapshots remain unchanged.');
    const parsed = parseYaml(readFileSync(project.paths.configFile, 'utf8')) as Record<string, unknown>;
    expect(parsed.adaptiveWorkflow).toEqual({ enabled: false, defaultProfile: 'governed' });
  });

  it('prints JSON config', async () => {
    await program().parseAsync(['project', 'workflow', 'show', '--json'], { from: 'user' });

    expect(JSON.parse(output())).toEqual({ enabled: false, defaultProfile: 'standard' });
  });

  it('rejects invalid default profile', async () => {
    await expect(
      program().parseAsync(['project', 'workflow', 'enable', '--default-profile', 'strict'], { from: 'user' }),
    ).rejects.toThrow(/INVALID_WORKFLOW_PROFILE/);
  });

  it('prints adoption preview text without writing config', async () => {
    const readySpec = createFrozenL3('workflow-preview-ready', specContent({ critical: true }));
    createTask({ paths: project.paths, specCode: readySpec, planJson: planFor(readySpec), autoConfirm: false });
    createFrozenL3('workflow-preview-gap', specContent({ critical: false }));

    await program().parseAsync(['project', 'workflow', 'preview'], { from: 'user' });

    expect(output()).toContain('Adaptive Workflow Adoption Preview:');
    expect(output()).toContain('enabled: false');
    expect(output()).toContain('legacyTasks: 1');
    expect(output()).toContain('withoutCriticalAcceptanceCriteria: 1');
    expect(output()).toContain('workflow-preview-gap-L3.1.1');
    expect(output()).toContain('recommendedDefaultProfile: standard');
    expect(output()).toContain('mutatesHistoricalTasks: false');
    expect(readFileSync(project.paths.configFile, 'utf8')).toBe('project_name: test\ncontext: |\n  Tech stack: TypeScript\n');
  });

  it('prints adoption preview json and recommends governed when ready', async () => {
    createFrozenL3('workflow-preview-all-ready', specContent({ critical: true }));

    await program().parseAsync(['project', 'workflow', 'preview', '--json'], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.schemaVersion).toBe('adaptive-workflow-adoption-preview.experimental.v1');
    expect(parsed.governedReadiness).toMatchObject({
      activeL3Specs: 1,
      withCriticalAcceptanceCriteria: 1,
      withoutCriticalAcceptanceCriteria: 0,
      readyForGovernedDefault: true,
    });
    expect(parsed.recommendation.recommendedDefaultProfile).toBe('governed');
    expect(parsed.historyPolicy.mutatesHistoricalTasks).toBe(false);
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

function planFor(specCode: string) {
  return {
    coveredSpecs: [specCode],
    steps: [{ stepNo: 1, stepType: 'tool_action' as const, name: 'run verify test' }],
  };
}

function createFrozenL3(topic: string, content: string): string {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths: project.paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(project.paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths: project.paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(project.paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths: project.paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(project.paths, l3Code, { content, aiSummary: 'Workflow preview fixture' });
  updateSpec(project.paths, l3Code, { status: 'frozen' });
  return l3Code;
}

function specContent(opts: { critical: boolean }): string {
  return `# Workflow Preview L3

## 目标

Test workflow preview.

## 实施步骤

- Implement.

## 验收标准

1. **AC-1**: first critical behavior
2. **AC-2**: second critical behavior

${opts.critical ? `## 关键验收标准

- AC-1
- AC-2
` : ''}
## 验证命令

\`\`\`bash
npm test
\`\`\`

## planJson (final)

\`\`\`json
{"coveredSpecs":["x"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"验证 test"}]}
\`\`\`

## 回滚方案

Rollback.
`;
}
