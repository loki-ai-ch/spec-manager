import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerSpec } from '../spec.js';
import { createTestProject, type TestProject } from '../../core/__tests__/project-fixture.js';
import { createSpec, findSpecByCode, updateSpec } from '../../core/spec-io.js';

let project: TestProject;
let oldSpecManagerRoot: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = createTestProject('spec-mgr-cli-spec-');
  mkdirSync(project.paths.specsDir, { recursive: true });
  writeFileSync(project.paths.configFile, 'project_name: test\n', 'utf8');
  writeFileSync(project.paths.auditFile, '{}', 'utf8');
  oldSpecManagerRoot = process.env.SPEC_MANAGER_ROOT;
  process.env.SPEC_MANAGER_ROOT = project.root;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit:${code}`);
  });
});

afterEach(() => {
  if (oldSpecManagerRoot === undefined) {
    delete process.env.SPEC_MANAGER_ROOT;
  } else {
    process.env.SPEC_MANAGER_ROOT = oldSpecManagerRoot;
  }
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  project.cleanup();
});

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSpec(program);
  return program;
}

function output(): string {
  return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function stderr(): string {
  return errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

function createL3WithPlan(): string {
  createSpec({ paths: project.paths, code: 'auth-L1', level: 'L1', title: 'Auth', topic: 'auth', parentCode: null });
  updateSpec(project.paths, 'auth-L1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L2.1', level: 'L2', title: 'Auth design', topic: 'auth', parentCode: 'auth-L1' });
  updateSpec(project.paths, 'auth-L2.1', { status: 'confirmed' });
  createSpec({ paths: project.paths, code: 'auth-L3.1.1-login', level: 'L3', title: 'Login', topic: 'auth', parentCode: 'auth-L2.1' });
  updateSpec(project.paths, 'auth-L3.1.1-login', {
    content: `# Login

## 目标
goal

## 实施步骤
steps

## 验证命令
npm test

## 代码调查
\`src/core/auth.ts\`

## planJson (final)

\`\`\`json
{
  "coveredSpecs": ["auth-L3.1.1-login"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 auth-L3.1.1-login 并检查 templates/agent-plan.json"},
    {"stepNo": 2, "stepType": "tool_action", "name": "验证 npm test"}
  ]
}
\`\`\`
`,
    aiSummary: 'login implementation',
  });
  return 'auth-L3.1.1-login';
}

describe('spec CLI', () => {
  it('attaches, sets, and shows history disposition', async () => {
    createSpec({ paths: project.paths, code: 'source-L1', level: 'L1', title: 'Source', topic: 'source', parentCode: null });
    createSpec({ paths: project.paths, code: 'target-L1', level: 'L1', title: 'Target', topic: 'target', parentCode: null });
    updateSpec(project.paths, 'target-L1', {
      content: '# Target\n\n## 验收标准\n\n1. **AC-1**: target\n',
      aiSummary: 'target',
    });
    await makeProgram().parseAsync(['spec', 'history', 'attach', 'target-L1', '--sources', 'spec:source-L1'], { from: 'user' });
    await makeProgram().parseAsync([
      'spec', 'history', 'set', 'target-L1', '--source', 'spec:source-L1',
      '--action', 'change', '--reason', 'Narrowed.', '--criteria', 'AC-1',
    ], { from: 'user' });
    await makeProgram().parseAsync(['spec', 'history', 'show', 'target-L1', '--json'], { from: 'user' });
    expect(output()).toContain('"action": "change"');
    expect(output()).toContain('"AC-1"');
  });

  it('records an explicit no-history reason', async () => {
    createSpec({ paths: project.paths, code: 'target-L1', level: 'L1', title: 'Target', topic: 'target', parentCode: null });
    await makeProgram().parseAsync([
      'spec', 'history', 'attach', 'target-L1', '--reason-if-empty', 'No related local history.',
    ], { from: 'user' });
    expect(findSpecByCode(project.paths, 'target-L1')?.fm.historyReview?.noRelevantHistoryReason)
      .toBe('No related local history.');
  });
  it('freezes a draft L3 with one confirm approval', async () => {
    const code = createL3WithPlan();

    await makeProgram().parseAsync(['spec', 'confirm', code], { from: 'user' });

    expect(findSpecByCode(project.paths, code)?.fm.status).toBe('frozen');
    expect(output()).toContain('draft → frozen');
  });

  it('keeps draft L1 confirmation at confirmed', async () => {
    createSpec({ paths: project.paths, code: 'billing-L1', level: 'L1', title: 'Billing', topic: 'billing', parentCode: null });
    updateSpec(project.paths, 'billing-L1', { content: '# Billing\n', aiSummary: 'billing' });

    await makeProgram().parseAsync(['spec', 'confirm', 'billing-L1'], { from: 'user' });

    expect(findSpecByCode(project.paths, 'billing-L1')?.fm.status).toBe('confirmed');
    expect(output()).toContain('draft → confirmed');
  });

  it('keeps historical confirmed L3 compatible with freeze', async () => {
    const code = createL3WithPlan();
    updateSpec(project.paths, code, { status: 'confirmed' });

    await makeProgram().parseAsync(['spec', 'freeze', code], { from: 'user' });

    expect(findSpecByCode(project.paths, code)?.fm.status).toBe('frozen');
  });

  it('rejects freezing a draft L1', async () => {
    createSpec({ paths: project.paths, code: 'draft-L1', level: 'L1', title: 'Draft', topic: 'draft', parentCode: null });
    updateSpec(project.paths, 'draft-L1', { content: '# Draft\n', aiSummary: 'draft' });

    await expect(makeProgram().parseAsync(['spec', 'freeze', 'draft-L1'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('L1/L2 请先使用 spec-manager spec confirm');
  });

  it('rejects confirming a placeholder draft L3', async () => {
    createSpec({ paths: project.paths, code: 'placeholder-L1', level: 'L1', title: 'Placeholder', topic: 'placeholder', parentCode: null });
    updateSpec(project.paths, 'placeholder-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'placeholder-L2', level: 'L2', title: 'Placeholder design', topic: 'placeholder', parentCode: 'placeholder-L1' });
    updateSpec(project.paths, 'placeholder-L2', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'placeholder-L3', level: 'L3', title: 'Placeholder', topic: 'placeholder', parentCode: 'placeholder-L2' });

    await expect(makeProgram().parseAsync(['spec', 'confirm', 'placeholder-L3'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('R22');
  });

  it('validates planJson from an L3 spec markdown', async () => {
    const code = createL3WithPlan();

    await makeProgram().parseAsync(['spec', 'validate-plan', '--from-spec', code], { from: 'user' });

    expect(output()).toContain('planJson 校验通过');
  });

  it('prints actionable diagnostics during validate-plan', async () => {
    const planFile = `${project.root}/legacy-plan.json`;
    writeFileSync(planFile, JSON.stringify({
      steps: [{ no: 1, type: 'tool_action', desc: 'run verify test' }],
    }), 'utf8');

    await makeProgram().parseAsync(['spec', 'validate-plan', planFile], { from: 'user' });

    expect(output()).toContain('[plan_diagnostic] steps[0].stepNo');
    expect(output()).toContain('legacy field "no"');
    expect(output()).toContain('Rename "type" to "stepType"');
    expect(output()).toContain('Rename "desc" to "name"');
  });

  it('prints section alias diagnostics during validate-plan from spec', async () => {
    createSpec({ paths: project.paths, code: 'alias-L1', level: 'L1', title: 'Alias', topic: 'alias', parentCode: null });
    updateSpec(project.paths, 'alias-L1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'alias-L2.1', level: 'L2', title: 'Alias design', topic: 'alias', parentCode: 'alias-L1' });
    updateSpec(project.paths, 'alias-L2.1', { status: 'confirmed' });
    createSpec({ paths: project.paths, code: 'alias-L3.1.1', level: 'L3', title: 'Alias impl', topic: 'alias', parentCode: 'alias-L2.1' });
    updateSpec(project.paths, 'alias-L3.1.1', {
      content: `# Alias impl

## 目标
goal

## 实施计划
steps

## 验证方式
npm test

## 代码调查
\`src/core/spec-sections.ts\`

## planJson (final)

\`\`\`json
{
  "coveredSpecs": ["alias-L3.1.1"],
  "steps": [
    {"stepNo": 1, "stepType": "tool_action", "name": "读取 alias-L3.1.1 并检查 src/core/spec-sections.ts"},
    {"stepNo": 2, "stepType": "tool_action", "name": "运行验证 npm test"}
  ]
}
\`\`\`
`,
      aiSummary: 'alias impl',
    });

    await makeProgram().parseAsync(['spec', 'validate-plan', '--from-spec', 'alias-L3.1.1'], { from: 'user' });

    expect(output()).toContain('[section_alias]');
    expect(output()).toContain('检测到 "## 实施计划"');
    expect(output()).toContain('规范段名应为 "## 实施步骤"');
    expect(output()).toContain('检测到 "## 验证方式"');
    expect(output()).not.toContain('[plan_diagnostic]');
  });

  it('rejects validate-plan without file or from-spec', async () => {
    await expect(makeProgram().parseAsync(['spec', 'validate-plan'], { from: 'user' })).rejects.toThrow('process.exit:2');
    expect(stderr()).toContain('validate-plan 需要 <file> 或 --from-spec <code>');
  });

  it('prints placeholder marker warning during spec validate', async () => {
    createSpec({ paths: project.paths, code: 'placeholder-L1', level: 'L1', title: 'Placeholder', topic: 'placeholder', parentCode: null });

    await makeProgram().parseAsync(['spec', 'validate', 'placeholder-L1'], { from: 'user' });

    expect(output()).toContain('[placeholder_marker]');
  });

  it('does not print placeholder warning for a complete marker example', async () => {
    createSpec({ paths: project.paths, code: 'docs-L1', level: 'L1', title: 'Docs', topic: 'docs', parentCode: null });
    updateSpec(project.paths, 'docs-L1', {
      content: `# Placeholder validation

## 背景
This complete specification documents placeholder validation behavior across validate, guide, flow, and doctor.

## 用户故事
As a maintainer, I want examples such as <!-- 在此粘贴正文 --> to remain valid documentation.

## 验收标准
1. **AC-1**: Given a complete specification, When it references the marker, Then validation SHALL not report a placeholder.

## 范围边界
The real scaffold marker in a short, otherwise empty specification remains blocked by R22.
`,
      aiSummary: 'documents placeholder behavior',
    });

    await makeProgram().parseAsync(['spec', 'validate', 'docs-L1'], { from: 'user' });

    expect(output()).not.toContain('[placeholder_marker]');
  });
});
