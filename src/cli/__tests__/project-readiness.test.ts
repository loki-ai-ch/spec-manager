import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerProject } from '../project.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, generateSpecCode, updateSpec } from '../../core/spec-io.js';

let project: TestProject;
let oldRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-readiness-');
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

describe('project readiness critical CLI', () => {
  it('prints text report with totals, gaps, reason, and suggestion', async () => {
    createFrozenL3('readiness-ready-cli', specContent({ critical: ['AC-1'] }));
    const missing = createFrozenL3('readiness-missing-cli', specContent({ critical: null }));
    const unknown = createFrozenL3('readiness-unknown-cli', specContent({ critical: ['AC-9'] }));

    await program().parseAsync(['project', 'readiness', 'critical'], { from: 'user' });

    expect(output()).toContain('Critical AC Readiness:');
    expect(output()).toContain('schemaVersion: critical-readiness.experimental.v1');
    expect(output()).toContain('activeL3: 3');
    expect(output()).toContain('ready: 1');
    expect(output()).toContain(`${missing}: missing`);
    expect(output()).toContain('reason: missing critical acceptance criteria section');
    expect(output()).toContain('suggestion: Read the L3 context');
    expect(output()).toContain(`${unknown}: unknown`);
    expect(output()).toContain('unknownCriticalIds: AC-9');
    expect(output()).toContain('readyForGovernedDefault: false');
  });

  it('prints json report filtered by topic', async () => {
    const included = createFrozenL3('readiness-included-cli', specContent({ critical: ['AC-1', 'AC-2'] }));
    createFrozenL3('readiness-excluded-cli', specContent({ critical: null }));

    await program().parseAsync([
      'project', 'readiness', 'critical',
      '--topic', 'readiness-included-cli',
      '--json',
    ], { from: 'user' });

    const parsed = JSON.parse(output());
    expect(parsed.schemaVersion).toBe('critical-readiness.experimental.v1');
    expect(parsed.topic).toBe('readiness-included-cli');
    expect(parsed.totals).toMatchObject({ activeL3: 1, ready: 1, missing: 0 });
    expect(parsed.items.map((item: { specCode: string }) => item.specCode)).toEqual([included]);
    expect(parsed.governedUpgrade.readyForGovernedDefault).toBe(false);
    expect(parsed.governedUpgrade.note).toContain('topic-filtered report only describes scoped readiness');
  });

  it('maps invalid topic errors to exit code 2', async () => {
    await expect(program().parseAsync(['project', 'readiness', 'critical', '--topic', '../bad'], { from: 'user' }))
      .rejects.toThrow('process.exit:2');

    expect(stderr()).toContain('INVALID_CRITICAL_READINESS_TOPIC');
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

function createFrozenL3(topic: string, content: string): string {
  const l1Code = generateSpecCode(topic, 'L1');
  createSpec({ paths: project.paths, code: l1Code, level: 'L1', title: `${topic} L1`, topic, parentCode: null });
  updateSpec(project.paths, l1Code, { status: 'confirmed' });
  const l2Code = generateSpecCode(topic, 'L2', l1Code);
  createSpec({ paths: project.paths, code: l2Code, level: 'L2', title: `${topic} L2`, topic, parentCode: l1Code });
  updateSpec(project.paths, l2Code, { status: 'confirmed' });
  const l3Code = generateSpecCode(topic, 'L3', l2Code);
  createSpec({ paths: project.paths, code: l3Code, level: 'L3', title: `${topic} L3`, topic, parentCode: l2Code });
  updateSpec(project.paths, l3Code, { content, aiSummary: 'Critical readiness CLI fixture' });
  updateSpec(project.paths, l3Code, { status: 'frozen' });
  return l3Code;
}

function specContent(opts: { critical: string[] | null }): string {
  return `# Readiness CLI L3

## 目标

Test readiness CLI.

## 实施步骤

- Implement.

## 验收标准

1. **AC-1**: first critical behavior
2. **AC-2**: second critical behavior

${opts.critical === null ? '' : `## 关键验收标准

${opts.critical.map(id => `- ${id}`).join('\n')}
`}
## 验证命令

\`\`\`bash
npm test
\`\`\`

## planJson (final)

\`\`\`json
{"coveredSpecs":["x"],"steps":[{"stepNo":1,"stepType":"tool_action","name":"run verify test"}]}
\`\`\`

## 回滚方案

Rollback.
`;
}
